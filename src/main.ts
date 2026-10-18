import { Notice, Platform, Plugin, TAbstractFile, TFile, normalizePath, setIcon, setTooltip, type Command, TFolder } from "obsidian";
import { ThumbnailCache } from "./cache/ThumbnailCache";
import { CanvasRenderer } from "./canvas/CanvasRenderer";
import { GALLERY_VIEW_TYPE, GalleryView } from "./gallery/GalleryView";
import { explorerGalleryTarget } from "./gallery/ExplorerNavigation";
import { createGalleryExplorer, GALLERY_EXPLORER_TYPE, nativeExplorerFactory } from "./gallery/GalleryExplorer";
import { installExplorerAppearance } from "./gallery/ExplorerAppearance";
import type { ExplorerTranslationKey } from "./i18n-explorer";
import { translate, type TranslationKey } from "./i18n";
import {
  DEFAULT_SETTINGS,
  VisualGallerySettingTab,
  type VisualGallerySettings,
} from "./settings";
import { CANVAS_RENDERER_VERSION, CanvasThumbnailProvider } from "./thumbnails/CanvasThumbnailProvider";
import { PdfThumbnailProvider } from "./thumbnails/PdfThumbnailProvider";
import { ThumbnailService } from "./thumbnails/ThumbnailService";
import { loadGallerySettings } from "./SettingsModel";
import { SettingsSync } from "./state/SettingsSync";
import { SHARED_KEYS } from "./state/SharedState";
import { installLocalExplorerState, localDevice, parseBrowserState, validCardWidth, type LocalBrowsing } from "./state/LocalState";
import { installExplorerFavorites } from "./gallery/ExplorerFavorites";

export default class VisualGalleryPlugin extends Plugin {
  private thumbnails: ThumbnailService | null = null;
  private gallerySettings: VisualGallerySettings = DEFAULT_SETTINGS;
  private readonly invalidationTimers = new Map<string, number>();
  private cleanupTimer: number | null = null;
  private cleaning: Promise<void> | null = null;
  private ribbon: HTMLElement | null = null;
  private readonly commandLabels: { command: Command; key: TranslationKey | ExplorerTranslationKey; prefix: string }[] = [];
  private openingExplorer: Promise<void> | null = null;
  private explorerNavigation: Promise<void> = Promise.resolve();

  private sync: SettingsSync | null = null;
  private localBrowsing: LocalBrowsing | null = null;
  private readonly favoriteRefreshers = new Set<() => void>();

  async onload(): Promise<void> {
    const saved = (await this.loadData() ?? {}) as Partial<VisualGallerySettings>;
    this.gallerySettings = loadGallerySettings(saved);
    const pluginDirectory = this.manifest.dir
      ?? normalizePath(`${this.app.vault.configDir}/plugins/${this.manifest.id}`);
    const device = localDevice(this.app);
    const width = this.app.loadLocalStorage("visual-gallery-card-width");
    this.gallerySettings.cardWidth = validCardWidth(width ?? saved.cardWidth);
    this.app.saveLocalStorage("visual-gallery-card-width", this.gallerySettings.cardWidth);
    this.localBrowsing = {
      device,
      read: () => parseBrowserState(this.app.loadLocalStorage("visual-gallery-browser")),
      save: state => this.app.saveLocalStorage("visual-gallery-browser", state),
    };
    this.sync = new SettingsSync({
      files: this.app.vault.adapter, directory: `${pluginDirectory}/sync-state`, device,
      cached: this.app.loadLocalStorage("visual-gallery-shared-cache"),
      cache: state => this.app.saveLocalStorage("visual-gallery-shared-cache", state),
      readData: () => this.loadData(),
      mirror: settings => this.saveData(settings),
      changed: () => {
        if (!this.sync) return;
        this.gallerySettings = { ...this.sync.settings(), cardWidth: this.gallerySettings.cardWidth };
        void this.refreshSettingsUI();
      },
    });
    await this.sync.load(saved);
    this.registerInterval(window.setInterval(() => void this.onExternalSettingsChange(), 5000));
    const canvasCache = new ThumbnailCache(this.app.vault.adapter, pluginDirectory, CANVAS_RENDERER_VERSION);
    const pdfCache = new ThumbnailCache(
      this.app.vault.adapter,
      pluginDirectory,
      PdfThumbnailProvider.rendererVersion(),
      "pdf",
    );
    await Promise.all([canvasCache.load(), pdfCache.load()]);
    const canvas = new CanvasThumbnailProvider(this.app, new CanvasRenderer(this.app, Platform.isMobile ? { maxDimension: 1024, maxNestedDepth: 1 } : {}), canvasCache, Platform.isMobile ? 1 : 2);
    const pdf = new PdfThumbnailProvider(this.app, pdfCache);
    this.thumbnails = new ThumbnailService(this.app, canvas, pdf);

    this.registerView(
      GALLERY_VIEW_TYPE,
      (leaf) => new GalleryView(leaf, () => this.thumbnails, () => this.gallerySettings, this.localBrowsing ?? undefined),
    );
    this.registerView(GALLERY_EXPLORER_TYPE, leaf => {
      const navigate = (folder: TFolder) => {
        // The host ignores setViewState calls while a leaf is opening. Queue
        // sidebar destinations so a rapid second click is never lost.
        const navigation = this.explorerNavigation.then(() => this.openGallery(folder, false));
        this.explorerNavigation = navigation.catch(() => {});
        return navigation;
      };
      const onError = (error: unknown) => this.explorerError(error);
      const view = createGalleryExplorer(this.app, leaf, () => this.t("explorerTitle"), navigate, onError);
      installExplorerAppearance(this.app, view, () => `${this.t("iconHome")} · ${this.app.vault.getName()}`, navigate, onError);
      installLocalExplorerState(this.app, view, device);
      const refresh = installExplorerFavorites(this.app, view, {
        paths: () => this.sync?.favorites() ?? [],
        toggle: path => this.toggleFavorite(path), label: key => this.t(key), navigate, error: onError,
      });
      this.favoriteRefreshers.add(refresh);
      view.register(() => this.favoriteRefreshers.delete(refresh));
      return view;
    });
    this.addLocalizedCommand("commandExplorer", {
      id: "open-gallery-explorer",
      callback: () => void this.openExplorer(true),
    });
    this.app.workspace.onLayoutReady(() => {
      // registerView restores unloaded views asynchronously on plugin reload.
      // Let that restoration finish before deciding whether a tab is missing.
      const timer = window.setTimeout(() => void this.openExplorer(false), 0);
      this.register(() => window.clearTimeout(timer));
    });
    this.addSettingTab(new VisualGallerySettingTab(
      this.app,
      this,
      () => this.gallerySettings,
      (settings) => this.updateSettings(settings),
      `${pluginDirectory}/thumbnail-cache`,
      () => this.clearThumbnailCache(),
    ));
    this.ribbon = this.addRibbonIcon(this.gallerySettings.navigationIcon, this.t("commandOpen"), () => void this.openGallery());
    this.addLocalizedCommand("commandOpen", {
      id: "open-gallery",
      callback: () => void this.openGallery(),
    });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, item, source) => {
      if (source !== "file-explorer-context-menu" || !explorerGalleryTarget(this.app, item)) return;
      if (item instanceof TFolder && !item.isRoot()) {
        const pinned = this.sync?.favorites().includes(item.path) ?? false;
        menu.addItem(entry => entry.setTitle(this.t(pinned ? "unpinFolder" : "pinFolder")).setIcon(pinned ? "pin-off" : "pin")
          .onClick(() => {
            if (this.app.vault.getAbstractFileByPath(item.path) === item) void this.toggleFavorite(item.path);
          }));
      }
      menu.addItem(entry => entry.setTitle(this.t("showInGallery")).setIcon(this.gallerySettings.navigationIcon)
        .onClick(() => void this.openGallery(item)));
    }));

    this.addLocalizedCommand("commandRebuild", {
      id: "rebuild-all-canvas-thumbnails",
      callback: () => void this.rebuildAllCanvasThumbnails(),
    });

    this.addLocalizedCommand("commandClear", {
      id: "clear-thumbnail-cache",
      callback: () => void this.clearThumbnailCache(),
    });

    this.addLocalizedCommand("commandGenerate", {
      id: "generate-canvas-thumbnail",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const available = file instanceof TFile && file.extension.toLowerCase() === "canvas";
        if (available && !checking && file) void this.generateActiveCanvasThumbnail(file);
        return available;
      },
    });

    this.registerEvent(this.app.vault.on("modify", (file) => this.scheduleInvalidation(file)));
    this.registerEvent(this.app.vault.on("modify", () => this.scheduleCleanup()));
    this.registerEvent(this.app.vault.on("rename", () => this.scheduleCleanup()));
    this.registerEvent(this.app.vault.on("delete", () => this.scheduleCleanup()));
    this.app.workspace.onLayoutReady(() => this.scheduleCleanup());
    this.registerInterval(window.setInterval(() => this.scheduleCleanup(), 10 * 60 * 1000));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (file instanceof TFolder) void this.sync?.relocate(oldPath, file.path).catch(error => this.syncError(error));
      if (oldPath.toLowerCase().endsWith(".canvas")) void this.thumbnails?.canvas.invalidate(oldPath);
      if (this.isCanvas(file)) this.scheduleInvalidation(file);
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (file instanceof TFolder) void this.sync?.relocate(file.path, null).catch(error => this.syncError(error));
      if (file.path.toLowerCase().endsWith(".canvas")) void this.thumbnails?.canvas.invalidate(file.path);
    }));
  }

  onunload(): void {
    if (this.cleanupTimer !== null) window.clearTimeout(this.cleanupTimer);
    for (const timer of this.invalidationTimers.values()) window.clearTimeout(timer);
    this.invalidationTimers.clear();
    void this.thumbnails?.pdf.dispose().catch((error: unknown) => {
      console.error("[Visual Gallery] Could not dispose the PDF renderer.", error);
    });
    void this.thumbnails?.flush().catch((error: unknown) => {
      console.error("[Visual Gallery] Could not flush the thumbnail cache while unloading.", error);
    });
  }

  private scheduleCleanup(): void {
    if (this.cleanupTimer !== null) window.clearTimeout(this.cleanupTimer);
    this.cleanupTimer = window.setTimeout(() => {
      this.cleanupTimer = null;
      if (this.cleaning) { this.scheduleCleanup(); return; }
      this.cleaning = Promise.all([this.thumbnails?.canvas.prune(), this.thumbnails?.pdf.prune()])
        .then(() => undefined).catch(error => console.error("[Visual Gallery] Cache cleanup failed", error))
        .finally(() => { this.cleaning = null; });
    }, 1500);
  }

  private async generateActiveCanvasThumbnail(file: TFile): Promise<void> {
    const provider = this.thumbnails?.canvas;
    if (!provider) return;
    try {
      const result = await provider.getThumbnail(file);
      const status = this.t(result.fromCache ? "thumbnailCached" : "thumbnailGenerated", { width: result.width, height: result.height });
      const warningText = result.warnings.length > 0 ? this.t("thumbnailWarnings", { count: result.warnings.length }) : "";
      new Notice(`${status}${warningText}\n${result.cachePath}`, 7000);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`[Visual Gallery] Failed to generate ${file.path}.`, error);
      new Notice(this.t("thumbnailFailed", { detail }), 8000);
    }
  }

  private async openGallery(item?: TAbstractFile, focus = true): Promise<void> {
    const target = item ? explorerGalleryTarget(this.app, item) : null;
    if (item && !target) return;
    const activeFile = this.app.workspace.getActiveFile();
    const folderPath = target?.folderPath ?? this.localBrowsing?.read()?.folderPath ?? activeFile?.parent?.path ?? "";
    const existing = this.app.workspace.getLeavesOfType(GALLERY_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: GALLERY_VIEW_TYPE,
      active: focus,
      state: { ...(target ? {} : this.localBrowsing?.read() ?? {}), folderPath, ...(target ? { filter: "all" } : {}), deviceId: this.localBrowsing?.device },
    });
    await this.app.workspace.revealLeaf(leaf);
    if (target?.revealPath && leaf.view instanceof GalleryView) leaf.view.revealItem(target.revealPath);
    if (focus) await this.openExplorer(true);
  }

  private openExplorer(reveal: boolean): Promise<void> {
    if (this.openingExplorer) return this.openingExplorer.then(() => reveal ? this.revealExplorer() : undefined);
    this.openingExplorer = (async () => {
      if (!this.app.workspace.getLeavesOfType(GALLERY_EXPLORER_TYPE).length) {
        if (!nativeExplorerFactory(this.app)) {
          if (reveal) this.explorerError(new Error("Files core plugin is disabled"));
          return;
        }
        const leaf = this.app.workspace.getLeftLeaf(false);
        if (!leaf) return;
        await leaf.setViewState({ type: GALLERY_EXPLORER_TYPE, active: false });
      }
      if (reveal) await this.revealExplorer();
    })().catch(error => this.explorerError(error)).finally(() => { this.openingExplorer = null; });
    return this.openingExplorer;
  }

  private async revealExplorer(): Promise<void> {
    const leaf = this.app.workspace.getLeavesOfType(GALLERY_EXPLORER_TYPE)[0];
    if (leaf) await this.app.workspace.revealLeaf(leaf);
  }

  private explorerError(error: unknown): void {
    console.error("[Visual Gallery] File browser operation failed", error);
    new Notice(this.t("explorerUnavailable"));
  }

  private scheduleInvalidation(file: TAbstractFile): void {
    if (!this.isCanvas(file)) return;
    const sourceMtime = file.stat.mtime;
    const existing = this.invalidationTimers.get(file.path);
    if (existing !== undefined) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      this.invalidationTimers.delete(file.path);
      void this.thumbnails?.canvas.invalidateOlderThan(file.path, sourceMtime);
    }, 500);
    this.invalidationTimers.set(file.path, timer);
  }

  private isCanvas(file: TAbstractFile): file is TFile {
    return file instanceof TFile && file.extension.toLowerCase() === "canvas";
  }

  private async updateSettings(settings: VisualGallerySettings): Promise<void> {
    const patch: Partial<VisualGallerySettings> = {};
    for (const key of SHARED_KEYS) if (settings[key] !== this.gallerySettings[key]) Object.assign(patch, { [key]: settings[key] });
    this.gallerySettings = { ...settings, cardWidth: validCardWidth(settings.cardWidth) };
    this.app.saveLocalStorage("visual-gallery-card-width", this.gallerySettings.cardWidth);
    // Queue the patch immediately, preserving the order of rapid UI edits.
    const saving = Object.keys(patch).length ? this.sync?.update(patch).catch(error => this.syncError(error)) : undefined;
    await this.refreshSettingsUI();
    await saving;
  }

  async onExternalSettingsChange(): Promise<void> {
    await this.sync?.refresh().catch(error => this.syncError(error));
  }

  private syncError(error: unknown): void {
    console.error("[Visual Gallery] Settings synchronization failed; local changes are retained for retry.", error);
  }

  private toggleFavorite(path: string): Promise<void> {
    return this.sync?.toggleFavorite(path).catch(error => this.syncError(error)) ?? Promise.resolve();
  }

  private async refreshSettingsUI(): Promise<void> {
    const settings = this.gallerySettings;
    if (this.ribbon) {
      setIcon(this.ribbon, settings.navigationIcon);
      setTooltip(this.ribbon, this.t("commandOpen"), { placement: "right" });
    }
    for (const { command, key, prefix } of this.commandLabels) command.name = prefix + this.t(key);
    this.refreshGalleryViews();
    for (const refresh of this.favoriteRefreshers) refresh();
    for (const leaf of this.app.workspace.getLeavesOfType(GALLERY_EXPLORER_TYPE)) {
      await leaf.setViewState(leaf.getViewState());
    }
  }

  private addLocalizedCommand(key: TranslationKey | ExplorerTranslationKey, definition: Omit<Command, "name">): void {
    const name = this.t(key);
    const command = this.addCommand({ ...definition, name });
    // Preserve the host's plugin-name prefix instead of hardcoding its format.
    const prefix = command.name.endsWith(name) ? command.name.slice(0, -name.length) : "";
    this.commandLabels.push({ command, key, prefix });
  }

  private async rebuildAllCanvasThumbnails(): Promise<void> {
    const provider = this.thumbnails?.canvas;
    if (!provider) return;
    const files = this.app.vault.getFiles().filter((file) => file.extension.toLowerCase() === "canvas");
    if (files.length === 0) {
      new Notice(this.t("noCanvas"));
      return;
    }
    new Notice(this.t("rebuilding", { count: files.length }), 5000);
    const results = await Promise.allSettled(files.map((file) => provider.getThumbnail(file, true)));
    const failures = results.filter((result) => result.status === "rejected").length;
    this.refreshGalleryViews();
    new Notice(
      failures === 0
        ? this.t("rebuilt", { count: files.length })
        : this.t("rebuildFailed", { success: files.length - failures, failed: failures }),
      8000,
    );
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`[Visual Gallery] Could not rebuild ${files[index]?.path ?? "Canvas"}.`, result.reason);
      }
    });
  }

  private async clearThumbnailCache(): Promise<void> {
    const thumbnails = this.thumbnails;
    if (!thumbnails) return;
    try {
      await this.cleaning;
      await thumbnails.clearCaches();
      this.refreshGalleryViews();
      new Notice(this.t("cacheCleared"));
    } catch (error) {
      console.error("[Visual Gallery] Cache clear failed", error);
      new Notice(this.t("cacheFailed"));
    }
  }

  private refreshGalleryViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(GALLERY_VIEW_TYPE)) {
      if (leaf.view instanceof GalleryView) leaf.view.refreshFromSettings();
    }
  }

  private t(key: TranslationKey | ExplorerTranslationKey, values: Record<string, string | number> = {}): string {
    return translate(this.gallerySettings.language, key, values);
  }
}
