import { ItemView, Notice, Platform, TAbstractFile, TFile, TFolder, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import { renderGalleryIcon } from "./Icons";
import { draggedItems, planCardMoves, startCardDrag } from "./CardDrag";
import { CardSelection } from "./Selection";
import { RenameModal } from "./RenameModal";
import { MarqueeSelection } from "./MarqueeSelection";
import { CreateItemModal } from "./CreateItemModal";
import { canRevealItem, deleteGalleryItem, revealGalleryItem, type NewItemKind } from "./ItemActions";
import { cardMenu, creationMenu, filterMenu, sortMenu, mobileCardMenu } from "./Menus";
import { TouchInteraction } from "./TouchInteraction";
import { MoveModal } from "./MoveModal";
import { renderGalleryToolbar } from "./Toolbar";
import { syncGalleryLayout } from "./Layout";
import { COVER_COLOR_KEYS } from "../SettingsModel";
import {
  getBreadcrumbFolders,
  GALLERY_FILTERS,
  listGalleryEntries,
  validSort,
  type GalleryEntry,
  type GalleryFilter,
  type GallerySort,
} from "../browser/VaultBrowser";
import { translate, type UiLanguage } from "../i18n";
import type { VisualGallerySettings } from "../settings";
import type { ThumbnailService } from "../thumbnails/ThumbnailService";

export const GALLERY_VIEW_TYPE = "visual-gallery-view";

interface GalleryViewState extends Record<string, unknown> {
  folderPath?: string;
  filter?: GalleryFilter;
  sort?: GallerySort;
}

export class GalleryView extends ItemView {
  private folderPath = "";
  private filter: GalleryFilter;
  private sort: GallerySort;
  private renderVersion = 0;
  private refreshTimer: number | null = null;
  private observer: IntersectionObserver | null = null;
  private layoutObserver: ResizeObserver | null = null;
  private readonly selection = new CardSelection();
  private order: string[] = [];
  private pendingRevealPath: string | null = null;
  private dragging = false;
  private moving = false;
  private marquee: MarqueeSelection | null = null;
  private touch: TouchInteraction | null = null;
  private touchSelecting = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly getThumbnailService: () => ThumbnailService | null,
    private readonly getSettings: () => VisualGallerySettings,
  ) {
    super(leaf);
    this.navigation = true;
    const settings = this.getSettings();
    this.filter = settings.defaultFilter;
    this.sort = settings.defaultSort;
  }

  getViewType(): string {
    return GALLERY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return translate(this.getSettings().language, "viewTitle");
  }

  getIcon(): string {
    return this.getSettings().navigationIcon;
  }

  getState(): GalleryViewState {
    return { folderPath: this.folderPath, filter: this.filter, sort: this.sort };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const previousFolder = this.folderPath;
    this.pendingRevealPath = null;
    await super.setState(state, result);
    if (isGalleryViewState(state)) {
      if (typeof state.folderPath === "string") this.folderPath = state.folderPath;
      if (state.filter && GALLERY_FILTERS.includes(state.filter)) this.filter = state.filter;
      if (state.sort) this.sort = validSort(state.sort, this.sort);
    }
    // The public history flag lets the leaf update its native arrows/side keys.
    // Obsidian suppresses recording when restoring a back/forward (popstate).
    this.folderPath = this.resolveFolder().path;
    if (this.folderPath !== previousFolder) {
      result.history = true;
      this.selection.clear();
      this.touchSelecting = false;
      this.contentEl.scrollTop = 0;
    }
    if (this.contentEl.isConnected) this.render();
  }

  protected async onOpen(): Promise<void> {
    this.contentEl.addClass("visual-gallery-view");
    this.contentEl.toggleClass("visual-gallery-mobile", Platform.isMobile);
    this.contentEl.tabIndex = -1;
    if (Platform.isMobile) {
      this.touch = new TouchInteraction(this.contentEl, (card, x, y) => {
        const item = this.app.vault.getAbstractFileByPath(card.dataset.itemPath ?? "");
        if (!item || !this.order.includes(item.path)) return;
        this.touchSelecting = true;
        if (!this.selection.paths.has(item.path)) this.selection.select(item.path, this.order, { ctrlKey: true });
        this.updateSelection();
        this.showCardMenu(item, { x, y });
      });
      this.registerDomEvent(this.contentEl, "click", event => {
        if (event.target instanceof Element && !event.target.closest(".visual-gallery-card,button,input,select,textarea,a,[contenteditable=true],.visual-gallery-header")) this.selectCard(null);
      });
    }
    this.marquee = new MarqueeSelection(this.contentEl, () => this.selection.paths, paths => {
      this.selection.clear();
      paths.forEach(path => this.selection.paths.add(path));
      this.selection.anchor = this.order.find(path => paths.has(path)) ?? null;
      this.updateSelection();
    });
    this.registerDomEvent(this.contentEl, "keydown", event => this.onKeyDown(event));
    this.registerDomEvent(this.contentEl, "contextmenu", event => {
      if (!(event.target instanceof Element) || event.target.closest(".visual-gallery-card,button,input,select,textarea,a,[contenteditable=true]")) return;
      event.preventDefault();
      this.marquee?.cancel();
      this.selectCard(null);
      const language = this.getSettings().language;
      creationMenu(language, kind => this.createItem(kind)).showAtMouseEvent(event);
    });
    this.registerEvent(this.app.vault.on("create", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("delete", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("rename", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("modify", () => this.scheduleRefresh()));
    this.render();
  }

  protected async onClose(): Promise<void> {
    this.pendingRevealPath = null;
    this.touch?.dispose();
    this.touch = null;
    this.marquee?.dispose();
    this.marquee = null;
    this.renderVersion += 1;
    this.observer?.disconnect();
    this.observer = null;
    this.layoutObserver?.disconnect();
    this.layoutObserver = null;
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
  }

  refreshFromSettings(): void {
    this.render();
  }

  /** The requested card may not exist yet in a later progressive-render chunk. */
  revealItem(path: string): void {
    if (!this.order.includes(path)) return;
    this.selectCard(path);
    this.pendingRevealPath = path;
    this.scrollToRevealedItem();
  }

  private scrollToRevealedItem(): void {
    if (!this.pendingRevealPath) return;
    const card = Array.from(this.contentEl.querySelectorAll<HTMLElement>(".visual-gallery-card"))
      .find(element => element.dataset.itemPath === this.pendingRevealPath);
    if (!card) return;
    this.pendingRevealPath = null;
    card.scrollIntoView({ block: "nearest" });
    card.focus({ preventScroll: true });
  }

  private render(): void {
    this.marquee?.cancel();
    this.touch?.reset();
    const version = ++this.renderVersion;
    this.observer?.disconnect();
    this.observer = null;
    this.layoutObserver?.disconnect();
    this.layoutObserver = null;
    this.contentEl.empty();

    const folder = this.resolveFolder();
    this.folderPath = folder.path;
    const settings = this.getSettings();
    const language = settings.language;
    for (const key of COVER_COLOR_KEYS) {
      this.contentEl.style.setProperty(`--vg-${key}`, settings[key]);
    }
    const shell = this.contentEl.createDiv({ cls: "visual-gallery-shell" });
    shell.style.setProperty("--vg-card-width", `${settings.cardWidth}px`);
    const layout = shell.createDiv({ cls: "visual-gallery-layout" });
    const header = layout.createDiv({ cls: "visual-gallery-header" });
    const titleArea = header.createDiv({ cls: "visual-gallery-title-area" });
    titleArea.createEl("h2", { text: folder.isRoot() ? settings.galleryTitle.trim() || translate(language, "viewTitle") : folder.name });
    titleArea.createDiv({
      cls: "visual-gallery-count",
      text: translate(language, "itemCount", { count: folder.children.length }),
    });
    this.renderControls(header, language);
    this.renderBreadcrumbs(layout, folder);

    const grid = layout.createDiv({ cls: "visual-gallery-grid" });
    const entries = listGalleryEntries(folder, this.filter, this.sort);
    const syncLayout = () => syncGalleryLayout(shell, layout, grid, entries.length, settings.cardWidth);
    syncLayout();
    this.layoutObserver = new ResizeObserver(syncLayout);
    this.layoutObserver.observe(shell);
    this.order = entries.map(entry => entry.item.path);
    if (this.pendingRevealPath && !this.order.includes(this.pendingRevealPath)) this.pendingRevealPath = null;
    this.selection.retain(this.order);
    if (!this.selection.paths.size) this.touchSelecting = false;
    if (entries.length === 0) {
      grid.createDiv({ cls: "visual-gallery-empty", text: translate(language, "noMatches") });
      return;
    }

    this.observer = new IntersectionObserver((observations) => {
      for (const observation of observations) {
        if (!observation.isIntersecting) continue;
        const card = observation.target as HTMLElement;
        this.observer?.unobserve(card);
        const index = Number(card.dataset.entryIndex);
        const entry = entries[index];
        if (entry) void this.loadThumbnail(card, entry, version);
      }
    }, { root: this.contentEl, rootMargin: "500px 0px" });

    this.renderChunk(entries, grid, 0, version);
  }

  private renderControls(header: HTMLElement, language: UiLanguage): void {
    renderGalleryToolbar(header, language, this.filter, this.sort, (action, button) => {
      const menu = action === "sort"
        ? sortMenu(language, this.sort, value => { this.sort = value; this.render(); })
        : action === "filter"
          ? filterMenu(language, this.filter, value => { this.filter = value; this.render(); })
          : creationMenu(language, kind => this.createItem(kind));
      const bounds = button.getBoundingClientRect();
      menu.setParentElement(button).showAtPosition({ x: bounds.left, y: bounds.bottom }, button.ownerDocument);
    });
  }

  private createItem(kind: NewItemKind): void {
    const folder = this.resolveFolder();
    new CreateItemModal(this.app, folder, kind, this.getSettings().language, item => {
      if (this.folderPath === folder.path) { this.render(); this.selectCard(item.path); }
      else this.scheduleRefresh();
      if (item instanceof TFile) void this.app.workspace.getLeaf("tab").openFile(item);
    }).open();
  }

  private renderBreadcrumbs(shell: HTMLElement, folder: TFolder): void {
    const breadcrumbs = shell.createDiv({ cls: "visual-gallery-breadcrumbs" });
    for (const [index, crumb] of getBreadcrumbFolders(folder).entries()) {
      if (index > 0) breadcrumbs.createSpan({ cls: "visual-gallery-crumb-separator", text: "/" });
      const button = breadcrumbs.createEl("button", {
        cls: "clickable-icon visual-gallery-crumb",
        text: crumb.isRoot() ? this.app.vault.getName() : crumb.name,
      });
      button.addEventListener("click", () => void this.navigateTo(crumb));
      this.registerFolderDrop(button, crumb);
    }
  }

  private renderChunk(entries: GalleryEntry[], grid: HTMLElement, start: number, version: number): void {
    if (version !== this.renderVersion) return;
    const end = Math.min(start + 30, entries.length);
    for (let index = start; index < end; index += 1) {
      const entry = entries[index];
      if (!entry) continue;
      const card = this.createCard(grid, entry, index);
      this.observer?.observe(card);
    }
    this.scrollToRevealedItem();
    if (Platform.isMobile) this.updateSelection();
    if (end < entries.length) {
      window.setTimeout(() => this.renderChunk(entries, grid, end, version), 0);
    }
  }

  private createCard(grid: HTMLElement, entry: GalleryEntry, index: number): HTMLElement {
    const card = grid.createEl("button", { cls: "visual-gallery-card" });
    card.draggable = !Platform.isMobile;
    card.dataset.entryIndex = String(index);
    card.dataset.itemPath = entry.item.path;
    card.toggleClass("is-selected", this.selection.paths.has(entry.item.path));
    card.setAttr("aria-pressed", String(this.selection.paths.has(entry.item.path)));
    const surface = card.createDiv({ cls: "visual-gallery-card-surface" });
    const preview = surface.createDiv({ cls: `visual-gallery-preview is-${entry.kind}` });
    if (entry.kind === "folder") {
      const icon = preview.createDiv({ cls: "visual-gallery-placeholder-icon visual-gallery-folder-icon" });
      renderGalleryIcon(icon, this.getSettings().folderIcon);
    } else if (entry.kind === "pdf") {
      preview.createDiv({ cls: "visual-gallery-placeholder-icon", text: "PDF" });
    } else {
      preview.createDiv({ cls: "visual-gallery-preview-loading" });
    }
    const details = surface.createDiv({ cls: "visual-gallery-card-details" });
    details.createDiv({
      cls: "visual-gallery-card-title",
      text: entry.item instanceof TFile ? entry.item.basename : entry.item.name,
    });
    if (this.getSettings().showMetadata) {
      const metadata = entry.item instanceof TFile
        ? `${kindLabel(this.getSettings().language, entry.kind)} · ${formatModified(entry.item.stat.mtime, this.getSettings().language)}`
        : kindLabel(this.getSettings().language, "folder");
      details.createDiv({ cls: "visual-gallery-card-meta", text: metadata });
    }
    card.addEventListener("click", (event) => {
      event.stopPropagation();
      if (Platform.isMobile && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
        if (!this.touchSelecting) { this.openEntry(entry); return; }
        this.selection.select(entry.item.path, this.order, { ctrlKey: true });
        if (this.selection.paths.size === 0) this.touchSelecting = false;
        this.updateSelection();
        return;
      }
      this.selection.select(entry.item.path, this.order, event);
      this.updateSelection();
    });
    card.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!Platform.isMobile) this.openEntry(entry);
    });
    card.addEventListener("dragstart", (event) => {
      if (Platform.isMobile) { event.preventDefault(); return; }
      if (!this.selection.paths.has(entry.item.path)) this.selectCard(entry.item.path);
      if (!startCardDrag(this.app, event, this.selectedItems())) {
        event.preventDefault();
        new Notice(translate(this.getSettings().language, "dragUnavailable"));
        return;
      }
      this.dragging = true;
      this.contentEl.querySelectorAll(".is-selected").forEach(el => el.classList.add("is-dragging"));
    });
    card.addEventListener("dragend", () => {
      this.dragging = false;
      this.contentEl.querySelectorAll(".is-dragging").forEach(el => el.classList.remove("is-dragging"));
      this.clearDropHighlights();
      this.scheduleRefresh();
    });
    card.addEventListener("contextmenu", event => {
      event.preventDefault();
      event.stopPropagation();
      this.showCardMenu(entry.item, { x: event.clientX, y: event.clientY });
    });
    if (entry.item instanceof TFolder) this.registerFolderDrop(card, entry.item);
    return card;
  }

  private async loadThumbnail(card: HTMLElement, entry: GalleryEntry, version: number): Promise<void> {
    if (!(entry.item instanceof TFile) || entry.kind === "folder" || version !== this.renderVersion) return;
    const preview = card.querySelector<HTMLElement>(".visual-gallery-preview");
    if (!preview) return;
    try {
      const service = this.getThumbnailService();
      const thumbnail = service ? await service.getThumbnail(entry.item, entry.kind) : null;
      if (version !== this.renderVersion || !card.isConnected) return;
      preview.empty();
      if (thumbnail?.resourceUrl) {
        preview.toggleClass("is-contain", thumbnail.fit === "contain");
        preview.toggleClass("is-cover", thumbnail.fit === "cover");
        const image = preview.createEl("img");
        image.alt = "";
        image.draggable = false;
        image.loading = "lazy";
        image.src = thumbnail.resourceUrl;
      } else if (thumbnail?.textPreview) {
        const note = preview.createDiv({ cls: "visual-gallery-note-preview" });
        note.createDiv({
          cls: "visual-gallery-note-label",
          text: kindLabel(this.getSettings().language, "notes"),
        });
        note.createDiv({ cls: "visual-gallery-note-excerpt", text: thumbnail.textPreview });
      } else {
        preview.createDiv({
          cls: "visual-gallery-placeholder-icon",
          text: entry.kind === "notes" ? "Aa" : kindLabel(this.getSettings().language, entry.kind),
        });
      }
    } catch (error) {
      console.error(`[Visual Gallery] Could not load ${entry.item.path}.`, error);
      if (version === this.renderVersion && card.isConnected) {
        preview.empty();
        preview.createDiv({ cls: "visual-gallery-placeholder-icon", text: "!" });
      }
    }
  }

  private async navigateTo(folder: TFolder): Promise<void> {
    const current = folder.isRoot() ? this.app.vault.getRoot() : this.app.vault.getAbstractFileByPath(folder.path);
    if (current !== folder || folder.path === this.folderPath) return;
    // Do not mutate before setViewState: the host must snapshot the OLD page.
    await this.leaf.setViewState({
      type: GALLERY_VIEW_TYPE,
      active: true,
      state: { ...this.getState(), folderPath: folder.path },
    });
  }

  private clearDropHighlights(): void {
    this.contentEl.querySelectorAll(".is-drop-target").forEach(el => el.classList.remove("is-drop-target"));
  }

  private registerFolderDrop(element: HTMLElement, folder: TFolder): void {
    element.addEventListener("dragover", (event) => {
      const items = draggedItems(this.app);
      if (!items.length) return;
      event.preventDefault();
      // Keep bubbling: Obsidian's window listener moves its native drag ghost.
      // preventDefault claims the target so ancestor drop handlers skip it.
      const plan = planCardMoves(items, folder, path => !!this.app.vault.getAbstractFileByPath(path));
      const allowed = !this.moving && !plan.error && plan.moves.length > 0;
      if (event.dataTransfer) event.dataTransfer.dropEffect = allowed ? "move" : "none";
      this.clearDropHighlights();
      element.toggleClass("is-drop-target", allowed);
    });
    element.addEventListener("dragleave", (event) => {
      if (!(event.relatedTarget instanceof Node) || !element.contains(event.relatedTarget)) {
        element.removeClass("is-drop-target");
      }
    });
    element.addEventListener("drop", (event) => {
      const items = draggedItems(this.app);
      if (!items.length) return;
      event.preventDefault();
      // The native window drop listener must also receive this for cleanup.
      this.clearDropHighlights();
      if (this.moving) return;
      const currentFolder = folder.isRoot() ? this.app.vault.getRoot() : this.app.vault.getAbstractFileByPath(folder.path);
      if (currentFolder !== folder) return;
      const plan = planCardMoves(items, folder, path => !!this.app.vault.getAbstractFileByPath(path));
      if (plan.error) {
        new Notice(translate(this.getSettings().language, plan.error));
        return;
      }
      this.moving = true;
      void (async () => {
        let moved = 0;
        try {
          // Preflight the whole selection before starting; never overwrite.
          for (const move of plan.moves) {
            if (this.app.vault.getAbstractFileByPath(move.path)) throw new Error("Destination changed");
            await this.app.fileManager.renameFile(move.item, move.path);
            moved++;
          }
          this.selection.clear();
          if (moved) new Notice(translate(this.getSettings().language, "movedCount", { count: moved, folder: folder.isRoot() ? this.app.vault.getName() : folder.path }));
        } catch (error) {
          console.error("[Visual Gallery] Batch move stopped", error);
          new Notice(translate(this.getSettings().language, "partialMove", { count: moved, total: plan.moves.length }));
        }
      })().finally(() => {
        this.moving = false;
        this.scheduleRefresh();
      });
    });
  }

  private openEntry(entry: GalleryEntry): void {
    if (this.app.vault.getAbstractFileByPath(entry.item.path) !== entry.item) return;
    if (entry.item instanceof TFolder) void this.navigateTo(entry.item);
    else void this.app.workspace.getLeaf(false).openFile(entry.item);
  }

  private selectCard(path: string | null): void {
    if (!path) this.touchSelecting = false;
    this.pendingRevealPath = null;
    this.selection.clear();
    if (path) this.selection.select(path, this.order);
    this.updateSelection();
  }

  private selectedItems(): TAbstractFile[] {
    return this.order.filter(path => this.selection.paths.has(path))
      .map(path => this.app.vault.getAbstractFileByPath(path)).filter((item): item is TAbstractFile => !!item);
  }

  private updateSelection(): void {
    for (const card of Array.from(this.contentEl.querySelectorAll<HTMLElement>(".visual-gallery-card"))) {
      const selected = this.selection.paths.has(card.dataset.itemPath ?? "");
      card.toggleClass("is-selected", selected);
      card.setAttr("aria-pressed", String(selected));
    }
    if (Platform.isMobile) {
      const folder = this.resolveFolder();
      this.contentEl.querySelector<HTMLElement>(".visual-gallery-count")?.setText(this.touchSelecting
        ? translate(this.getSettings().language, "selectedCount", { count: this.selection.paths.size })
        : translate(this.getSettings().language, "itemCount", { count: folder.children.length }));
    }
  }

  private showCardMenu(item: TAbstractFile, position: { x: number; y: number }): void {
    if (this.app.vault.getAbstractFileByPath(item.path) !== item) return;
    if (!this.selection.paths.has(item.path)) this.selectCard(item.path);
    if (Platform.isMobile) { this.touchSelecting = true; this.updateSelection(); }
    const language = this.getSettings().language;
    const rename = this.selection.paths.size === 1 ? () => new RenameModal(this.app, item, language).open() : null;
    const remove = () => void deleteGalleryItem(this.app, item).then(deleted => {
      if (deleted) { this.selection.paths.delete(item.path); this.scheduleRefresh(); }
    }).catch(error => { console.error("[Visual Gallery] Delete failed", error); new Notice(translate(language, "deleteFailed")); });
    const menu = Platform.isMobile ? mobileCardMenu(language, this.selection.paths.size, {
      open: () => { this.selectCard(null); if (item instanceof TFolder) void this.navigateTo(item); else if (item instanceof TFile) void this.app.workspace.getLeaf(false).openFile(item); },
      selectAll: () => { this.touchSelecting = true; this.order.forEach(path => this.selection.paths.add(path)); this.updateSelection(); },
      clear: () => this.selectCard(null), move: () => this.chooseMoveFolder(), rename, remove,
    }) : cardMenu(language, Platform.isMacOS, canRevealItem(this.app), rename, remove, () => {
      try { revealGalleryItem(this.app, item); }
      catch (error) { console.error("[Visual Gallery] Reveal failed", error); new Notice(translate(language, "revealFailed")); }
    });
    menu.showAtPosition(position, this.contentEl.ownerDocument);
  }

  private chooseMoveFolder(): void {
    const items = this.selectedItems();
    if (!items.length || this.moving) return;
    const current = (folder: TFolder) => (folder.isRoot() ? this.app.vault.getRoot() : this.app.vault.getAbstractFileByPath(folder.path)) === folder
      && items.every(item => this.app.vault.getAbstractFileByPath(item.path) === item);
    const plan = (folder: TFolder) => planCardMoves(items, folder, path => !!this.app.vault.getAbstractFileByPath(path));
    new MoveModal(this.app, this.getSettings().language, folder => {
      const result = plan(folder);
      return !this.moving && current(folder) && !result.error && result.moves.length > 0;
    }, async folder => {
      if (this.moving || !current(folder)) return false;
      const result = plan(folder);
      if (result.error || !result.moves.length) return false;
      this.moving = true;
      let moved = 0;
      try {
        for (const move of result.moves) {
          if (!current(folder) || this.app.vault.getAbstractFileByPath(move.path)) throw new Error("Destination changed");
          await this.app.fileManager.renameFile(move.item, move.path);
          moved++;
        }
        this.selectCard(null);
        new Notice(translate(this.getSettings().language, "movedCount", { count: moved, folder: folder.isRoot() ? this.app.vault.getName() : folder.path }));
        return true;
      } catch (error) {
        console.error("[Visual Gallery] Touch batch move stopped", error);
        new Notice(translate(this.getSettings().language, "partialMove", { count: moved, total: result.moves.length }));
        return false;
      } finally { this.moving = false; this.scheduleRefresh(); }
    }).open();
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!(event.target instanceof HTMLElement) || event.target.closest("input,select,textarea,[contenteditable=true]")) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      if (Platform.isMobile) this.touchSelecting = true;
      this.order.forEach(path => this.selection.paths.add(path));
      this.updateSelection();
    } else if (event.key === "Escape") {
      this.marquee?.cancel();
      this.selectCard(null);
    }
    else if (event.key === "F2" && this.selection.paths.size === 1) {
      event.preventDefault();
      const item = this.selectedItems()[0];
      if (item) new RenameModal(this.app, item, this.getSettings().language).open();
    } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      const card = event.target.closest<HTMLElement>(".visual-gallery-card");
      if (!card) return;
      event.preventDefault();
      const grid = card.parentElement!;
      const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
      const step = event.key === "ArrowUp" ? -columns : event.key === "ArrowDown" ? columns : event.key === "ArrowLeft" ? -1 : 1;
      const index = Math.max(0, Math.min(this.order.length - 1, this.order.indexOf(card.dataset.itemPath ?? "") + step));
      const path = this.order[index];
      if (!path) return;
      this.selection.select(path, this.order, event);
      this.updateSelection();
      this.contentEl.querySelectorAll<HTMLElement>(".visual-gallery-card")[index]?.focus();
    }
  }

  private resolveFolder(): TFolder {
    if (!this.folderPath) return this.app.vault.getRoot();
    const candidate = this.app.vault.getAbstractFileByPath(this.folderPath);
    return candidate instanceof TFolder ? candidate : this.app.vault.getRoot();
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      if (this.dragging) return; // dragend schedules the deferred refresh.
      this.render();
    }, 250);
  }
}

function isGalleryViewState(value: unknown): value is GalleryViewState {
  return typeof value === "object" && value !== null;
}

function kindLabel(language: UiLanguage, kind: GalleryEntry["kind"]): string {
  if (kind === "canvas") return translate(language, "kindCanvas");
  if (kind === "notes") return translate(language, "kindNote");
  if (kind === "images") return translate(language, "kindImage");
  if (kind === "pdf") return translate(language, "kindPdf");
  return translate(language, "kindFolder");
}

function formatModified(timestamp: number, language: UiLanguage): string {
  return new Intl.DateTimeFormat(language, { month: "short", day: "numeric" }).format(new Date(timestamp));
}
