import { Notice, Plugin, TAbstractFile, TFile, normalizePath, setIcon, setTooltip, type Command } from "obsidian";
import { ThumbnailCache } from "./cache/ThumbnailCache";
import { CanvasRenderer } from "./canvas/CanvasRenderer";
import { GALLERY_VIEW_TYPE, GalleryView } from "./gallery/GalleryView";
import { explorerGalleryTarget } from "./gallery/ExplorerNavigation";
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

export default class VisualGalleryPlugin extends Plugin {
  private thumbnails: ThumbnailService | null = null;
  private gallerySettings: VisualGallerySettings = DEFAULT_SETTINGS;
  private readonly invalidationTimers = new Map<string, number>();
  private cleanupTimer: number | null = null;
  private cleaning: Promise<void> | null = null;
  private ribbon: HTMLElement | null = null;
  private readonly commandLabels: { command: Command; key: TranslationKey; prefix: string }[] = [];

  async onload(): Promise<void> {
    const saved = (await this.loadData() ?? {}) as Partial<VisualGallerySettings>;
    this.gallerySettings = loadGallerySettings(saved);
    const pluginDirectory = this.manifest.dir
      ?? normalizePath(`${this.app.vault.configDir}/plugins/${this.manifest.id}`);
    const canvasCache = new ThumbnailCache(this.app.vault.adapter, pluginDirectory, CANVAS_RENDERER_VERSION);
    const pdfCache = new ThumbnailCache(
      this.app.vault.adapter,
      pluginDirectory,
      PdfThumbnailProvider.rendererVersion(),
      "pdf",
    );
    await Promise.all([canvasCache.load(), pdfCache.load()]);
    const canvas = new CanvasThumbnailProvider(this.app, new CanvasRenderer(this.app), canvasCache);
    const pdf = new PdfThumbnailProvider(this.app, pdfCache);
    this.thumbnails = new ThumbnailService(this.app, canvas, pdf);

    this.registerView(
      GALLERY_VIEW_TYPE,
      (leaf) => new GalleryView(leaf, () => this.thumbnails, () => this.gallerySettings),
    );
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
      if (oldPath.toLowerCase().endsWith(".canvas")) void this.thumbnails?.canvas.invalidate(oldPath);
      if (this.isCanvas(file)) this.scheduleInvalidation(file);
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
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

  private async openGallery(item?: TAbstractFile): Promise<void> {
    const target = item ? explorerGalleryTarget(this.app, item) : null;
    if (item && !target) return;
    const activeFile = this.app.workspace.getActiveFile();
    const folderPath = target?.folderPath ?? activeFile?.parent?.path ?? "";
    const existing = this.app.workspace.getLeavesOfType(GALLERY_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: GALLERY_VIEW_TYPE,
      active: true,
      state: { folderPath, ...(target ? { filter: "all" } : {}) },
    });
    await this.app.workspace.revealLeaf(leaf);
    if (target?.revealPath && leaf.view instanceof GalleryView) leaf.view.revealItem(target.revealPath);
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
    this.gallerySettings = settings;
    if (this.ribbon) {
      setIcon(this.ribbon, settings.navigationIcon);
      setTooltip(this.ribbon, this.t("commandOpen"), { placement: "right" });
    }
    for (const { command, key, prefix } of this.commandLabels) command.name = prefix + this.t(key);
    await this.saveData(settings);
    this.refreshGalleryViews();
  }

  private addLocalizedCommand(key: TranslationKey, definition: Omit<Command, "name">): void {
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

  private t(key: TranslationKey, values: Record<string, string | number> = {}): string {
    return translate(this.gallerySettings.language, key, values);
  }
}
