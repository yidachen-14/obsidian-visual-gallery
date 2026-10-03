import "./PdfCompatibility";
import { App, Platform, TFile } from "obsidian";
import { getDocument } from "pdfjs-dist";
import { BundledPdfWorker } from "./BundledPdfWorker";
import { ThumbnailCache } from "../cache/ThumbnailCache";
import { AsyncQueue } from "../utils/AsyncQueue";
import type { ThumbnailResult } from "./types";
import { thumbnailBlob } from "../utils/thumbnailBlob";

const PDF_RENDERER_VERSION = "pdfjs-v3";

export class PdfThumbnailProvider {
  private readonly inflight = new Map<string, Promise<ThumbnailResult>>();
  private readonly queue = new AsyncQueue(1);
  private readonly worker = new BundledPdfWorker();
  private disposed = false;

  constructor(
    private readonly app: App,
    private readonly cache: ThumbnailCache,
  ) {}

  static rendererVersion(): string {
    return PDF_RENDERER_VERSION;
  }

  async getThumbnail(file: TFile, force = false): Promise<ThumbnailResult> {
    if (this.disposed) throw new Error("PDF thumbnail provider is unloaded.");
    if (file.extension.toLowerCase() !== "pdf") {
      throw new Error(`Expected a PDF file, received ${file.path}.`);
    }
    const requestPath = file.path;
    const running = this.inflight.get(requestPath);
    if (running) return running;
    const task = this.queue.add(() => this.generate(file, force)).finally(() => this.inflight.delete(requestPath));
    this.inflight.set(requestPath, task);
    return task;
  }

  async clear(): Promise<void> {
    await Promise.allSettled([...this.inflight.values()]);
    await this.cache.clear();
  }

  async prune(): Promise<void> {
    await Promise.allSettled([...this.inflight.values()]);
    await this.cache.prune(path => {
      const file = this.app.vault.getAbstractFileByPath(path);
      return file instanceof TFile ? file.stat.mtime : undefined;
    });
  }

  async flush(): Promise<void> {
    await this.cache.flush();
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await Promise.allSettled([...this.inflight.values()]);
    this.worker.dispose();
  }

  private async generate(file: TFile, force: boolean): Promise<ThumbnailResult> {
    if (!force) {
      const cached = await this.cache.get(file);
      if (cached) {
        return {
          sourcePath: file.path,
          ...cached,
          fromCache: true,
          warnings: [],
        };
      }
    }

    const sourcePath = file.path;
    const sourceMtime = file.stat.mtime;
    const data = new Uint8Array(await this.app.vault.readBinary(file));
    const loadingTask = getDocument({
      data,
      worker: await this.worker.ready(),
      useWorkerFetch: false,
      useWasm: false,
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: true,
    });
    try {
      const document = await loadingTask.promise;
      const page = await document.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2, (Platform.isMobile ? 900 : 1200) / Math.max(baseViewport.width, baseViewport.height));
      const viewport = page.getViewport({ scale });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Could not create a PDF rendering context.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, viewport }).promise;
      const blob = await thumbnailBlob(canvas);
      if (file.path !== sourcePath || file.stat.mtime !== sourceMtime || this.app.vault.getAbstractFileByPath(sourcePath) !== file) {
        throw new Error("PDF changed while its thumbnail was rendering.");
      }
      const stored = await this.cache.put(file, await blob.arrayBuffer(), canvas.width, canvas.height, {}, blob.type === "image/png" ? "image/png" : "image/webp");
      await this.cache.flush();
      return {
        sourcePath: file.path,
        ...stored,
        fromCache: false,
        warnings: [],
      };
    } finally {
      await loadingTask.destroy();
    }
  }
}
