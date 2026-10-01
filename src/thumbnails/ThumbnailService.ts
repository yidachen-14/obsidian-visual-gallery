import { App, TFile } from "obsidian";
import type { GalleryFileKind } from "../browser/VaultBrowser";
import { markdownToPlainText } from "../canvas/CanvasRenderer";
import type { CanvasThumbnailProvider } from "./CanvasThumbnailProvider";
import type { PdfThumbnailProvider } from "./PdfThumbnailProvider";

export interface GalleryThumbnail {
  resourceUrl: string | null;
  fit: "contain" | "cover";
  textPreview?: string;
  label?: string;
}

export class ThumbnailService {
  constructor(
    private readonly app: App,
    readonly canvas: CanvasThumbnailProvider,
    readonly pdf: PdfThumbnailProvider,
  ) {}

  async getThumbnail(file: TFile, kind: GalleryFileKind): Promise<GalleryThumbnail> {
    if (kind === "canvas") {
      const result = await this.canvas.getThumbnail(file);
      return { resourceUrl: result.resourceUrl, fit: "contain" };
    }
    if (kind === "pdf") {
      const result = await this.pdf.getThumbnail(file);
      return { resourceUrl: result.resourceUrl, fit: "contain" };
    }
    if (kind === "images") {
      return { resourceUrl: this.app.vault.getResourcePath(file), fit: "cover" };
    }
    return this.getMarkdownThumbnail(file);
  }

  async clearCaches(): Promise<void> {
    await Promise.all([this.canvas.clear(), this.pdf.clear()]);
  }

  async flush(): Promise<void> {
    await Promise.all([this.canvas.flush(), this.pdf.flush()]);
  }

  private async getMarkdownThumbnail(file: TFile): Promise<GalleryThumbnail> {
    const cache = this.app.metadataCache.getFileCache(file);
    const coverValue: unknown = cache?.frontmatter?.cover;
    const cover = typeof coverValue === "string" ? normalizeLink(coverValue) : null;
    const link = cover || cache?.embeds?.[0]?.link;
    if (link) {
      const target = this.app.metadataCache.getFirstLinkpathDest(link, file.path);
      if (target instanceof TFile && isImage(target)) {
        return { resourceUrl: this.app.vault.getResourcePath(target), fit: "contain" };
      }
    }
    const raw = await this.app.vault.cachedRead(file);
    return {
      resourceUrl: null,
      fit: "contain",
      label: "Note",
      textPreview: markdownToPlainText(raw).slice(0, 220),
    };
  }
}

function normalizeLink(value: string): string {
  return value.replace(/^!?\[\[/, "").replace(/\]\]$/, "").split("|")[0]?.trim() ?? value;
}

function isImage(file: TFile): boolean {
  return new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"])
    .has(file.extension.toLowerCase());
}
