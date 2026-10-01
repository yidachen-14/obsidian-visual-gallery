import { ItemView, Notice, Platform, TAbstractFile, TFile, TFolder, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import { renderGalleryIcon } from "./Icons";
import { draggedItems, planCardMoves, startCardDrag } from "./CardDrag";
import { CardSelection } from "./Selection";
import { RenameModal } from "./RenameModal";
import { MarqueeSelection } from "./MarqueeSelection";
import { CreateItemModal } from "./CreateItemModal";
import { canRevealItem, deleteGalleryItem, revealGalleryItem } from "./ItemActions";
import { cardMenu, creationMenu, sortMenu } from "./Menus";
import {
  getBreadcrumbFolders,
  listGalleryEntries,
  validSort,
  type GalleryEntry,
  type GalleryFilter,
  type GallerySort,
} from "../browser/VaultBrowser";
import { sortLabel, translate, type UiLanguage } from "../i18n";
import type { VisualGallerySettings } from "../settings";
import type { ThumbnailService } from "../thumbnails/ThumbnailService";

export const GALLERY_VIEW_TYPE = "visual-gallery-view";

interface GalleryViewState extends Record<string, unknown> {
  folderPath?: string;
  filter?: GalleryFilter;
  sort?: GallerySort;
}

const GALLERY_FILTERS: GalleryFilter[] = ["all", "canvas", "notes", "images", "pdf"];

export class GalleryView extends ItemView {
  private folderPath = "";
  private filter: GalleryFilter;
  private sort: GallerySort;
  private renderVersion = 0;
  private refreshTimer: number | null = null;
  private observer: IntersectionObserver | null = null;
  private readonly selection = new CardSelection();
  private order: string[] = [];
  private dragging = false;
  private moving = false;
  private marquee: MarqueeSelection | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly getThumbnailService: () => ThumbnailService | null,
    private readonly getSettings: () => VisualGallerySettings,
  ) {
    super(leaf);
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
    await super.setState(state, result);
    if (isGalleryViewState(state)) {
      if (typeof state.folderPath === "string") this.folderPath = state.folderPath;
      if (state.filter && GALLERY_FILTERS.includes(state.filter)) this.filter = state.filter;
      if (state.sort) this.sort = validSort(state.sort, this.sort);
    }
    if (this.contentEl.isConnected) this.render();
  }

  protected async onOpen(): Promise<void> {
    this.contentEl.addClass("visual-gallery-view");
    this.contentEl.tabIndex = -1;
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
      const folder = this.resolveFolder();
      const language = this.getSettings().language;
      creationMenu(language, kind => new CreateItemModal(this.app, folder, kind, language, item => {
        if (this.folderPath === folder.path) { this.render(); this.selectCard(item.path); }
        else this.scheduleRefresh();
        if (item instanceof TFile) void this.app.workspace.getLeaf("tab").openFile(item);
      }).open()).showAtMouseEvent(event);
    });
    this.registerEvent(this.app.vault.on("create", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("delete", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("rename", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("modify", () => this.scheduleRefresh()));
    this.render();
  }

  protected async onClose(): Promise<void> {
    this.marquee?.dispose();
    this.marquee = null;
    this.renderVersion += 1;
    this.observer?.disconnect();
    this.observer = null;
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
  }

  refreshFromSettings(): void {
    this.render();
  }

  private render(): void {
    this.marquee?.cancel();
    const version = ++this.renderVersion;
    this.observer?.disconnect();
    this.observer = null;
    this.contentEl.empty();

    const folder = this.resolveFolder();
    this.folderPath = folder.path;
    const settings = this.getSettings();
    const language = settings.language;
    for (const key of ["lightStart", "lightEnd", "darkStart", "darkEnd"] as const) {
      this.contentEl.style.setProperty(`--vg-${key}`, settings[key]);
    }
    const shell = this.contentEl.createDiv({ cls: "visual-gallery-shell" });
    shell.style.setProperty("--vg-card-width", `${settings.cardWidth}px`);
    const header = shell.createDiv({ cls: "visual-gallery-header" });
    const titleArea = header.createDiv({ cls: "visual-gallery-title-area" });
    titleArea.createEl("h2", { text: folder.isRoot() ? settings.galleryTitle.trim() || translate(language, "viewTitle") : folder.name });
    titleArea.createDiv({
      cls: "visual-gallery-count",
      text: translate(language, "itemCount", { count: folder.children.length }),
    });
    this.renderControls(header, language);
    this.renderBreadcrumbs(shell, folder);

    const grid = shell.createDiv({ cls: "visual-gallery-grid" });
    const entries = listGalleryEntries(folder, this.filter, this.sort);
    this.order = entries.map(entry => entry.item.path);
    this.selection.retain(this.order);
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
    const controls = header.createDiv({ cls: "visual-gallery-controls" });
    const filter = controls.createEl("select", { cls: "dropdown visual-gallery-select" });
    filter.setAttr("aria-label", translate(language, "filterAria"));
    for (const value of GALLERY_FILTERS) {
      const option = filter.createEl("option", { text: filterLabel(language, value) });
      option.value = value;
      option.selected = value === this.filter;
    }
    filter.addEventListener("change", () => {
      this.filter = filter.value as GalleryFilter;
      this.render();
    });

    const sort = controls.createEl("button", { cls: "visual-gallery-sort", text: sortLabel(language, this.sort), attr: { type: "button", "aria-haspopup": "menu" } });
    sort.setAttr("aria-label", translate(language, "sortAria"));
    sort.addEventListener("click", () => {
      const bounds = sort.getBoundingClientRect();
      sortMenu(language, this.sort, value => { this.sort = value; this.render(); })
        .setParentElement(sort).showAtPosition({ x: bounds.left, y: bounds.bottom }, sort.ownerDocument);
    });
  }

  private renderBreadcrumbs(shell: HTMLElement, folder: TFolder): void {
    const breadcrumbs = shell.createDiv({ cls: "visual-gallery-breadcrumbs" });
    for (const [index, crumb] of getBreadcrumbFolders(folder).entries()) {
      if (index > 0) breadcrumbs.createSpan({ cls: "visual-gallery-crumb-separator", text: "/" });
      const button = breadcrumbs.createEl("button", {
        cls: "clickable-icon visual-gallery-crumb",
        text: crumb.isRoot() ? this.app.vault.getName() : crumb.name,
      });
      button.addEventListener("click", () => this.navigateTo(crumb));
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
    if (end < entries.length) {
      window.setTimeout(() => this.renderChunk(entries, grid, end, version), 0);
    }
  }

  private createCard(grid: HTMLElement, entry: GalleryEntry, index: number): HTMLElement {
    const card = grid.createEl("button", { cls: "visual-gallery-card" });
    card.draggable = true;
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
      this.selection.select(entry.item.path, this.order, event);
      this.updateSelection();
    });
    card.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.openEntry(entry);
    });
    card.addEventListener("dragstart", (event) => {
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
      if (!this.selection.paths.has(entry.item.path)) this.selectCard(entry.item.path);
      const language = this.getSettings().language;
      cardMenu(language, Platform.isMacOS, canRevealItem(this.app),
        () => new RenameModal(this.app, entry.item, language).open(),
        () => void deleteGalleryItem(this.app, entry.item).then(deleted => {
          if (deleted) { this.selection.paths.delete(entry.item.path); this.scheduleRefresh(); }
        }).catch(error => { console.error("[Visual Gallery] Delete failed", error); new Notice(translate(language, "deleteFailed")); }),
        () => {
          try { revealGalleryItem(this.app, entry.item); }
          catch (error) { console.error("[Visual Gallery] Reveal failed", error); new Notice(translate(language, "revealFailed")); }
        }).showAtMouseEvent(event);
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

  private navigateTo(folder: TFolder): void {
    this.selection.clear();
    this.folderPath = folder.path;
    this.render();
  }

  private clearDropHighlights(): void {
    this.contentEl.querySelectorAll(".is-drop-target").forEach(el => el.classList.remove("is-drop-target"));
  }

  private registerFolderDrop(element: HTMLElement, folder: TFolder): void {
    element.addEventListener("dragover", (event) => {
      const items = draggedItems(this.app);
      if (!items.length) return;
      event.preventDefault();
      event.stopPropagation();
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
      event.stopPropagation();
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
    if (entry.item instanceof TFolder) this.navigateTo(entry.item);
    else void this.app.workspace.getLeaf(false).openFile(entry.item);
  }

  private selectCard(path: string | null): void {
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
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!(event.target instanceof HTMLElement) || event.target.closest("input,select,textarea,[contenteditable=true]")) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
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

function filterLabel(language: UiLanguage, filter: GalleryFilter): string {
  if (filter === "canvas") return translate(language, "filterCanvas");
  if (filter === "notes") return translate(language, "filterNotes");
  if (filter === "images") return translate(language, "filterImages");
  if (filter === "pdf") return translate(language, "filterPdf");
  return translate(language, "filterAll");
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
