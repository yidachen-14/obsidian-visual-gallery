import { App, TFile } from "obsidian";
import { ThumbnailCache } from "../cache/ThumbnailCache";
import { parseJsonCanvas } from "../canvas/CanvasParser";
import { CanvasRenderer } from "../canvas/CanvasRenderer";
import { AsyncQueue } from "../utils/AsyncQueue";
import type { ThumbnailResult } from "./types";

export const CANVAS_RENDERER_VERSION = "canvas2d-v3-dependencies";

export class CanvasThumbnailProvider {
  private readonly inflight = new Map<string, Promise<ThumbnailResult>>();
  private readonly queue = new AsyncQueue(2);

  constructor(
    private readonly app: App,
    private readonly renderer: CanvasRenderer,
    private readonly cache: ThumbnailCache,
  ) {}

  async getThumbnail(file: TFile, force = false): Promise<ThumbnailResult> {
    if (file.extension.toLowerCase() !== "canvas") {
      throw new Error(`Expected a .canvas file, received ${file.path}.`);
    }
    const requestPath = file.path;
    const running = this.inflight.get(requestPath);
    if (running) return running;
    const task = this.queue.add(() => this.generate(file, force)).finally(() => this.inflight.delete(requestPath));
    this.inflight.set(requestPath, task);
    return task;
  }

  async invalidate(path: string): Promise<void> {
    await this.cache.invalidate(path);
  }

  async invalidateOlderThan(path: string, sourceMtime: number): Promise<void> {
    await this.cache.invalidateOlderThan(path, sourceMtime);
  }

  async flush(): Promise<void> {
    await this.cache.flush();
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

  private async generate(file: TFile, force: boolean): Promise<ThumbnailResult> {
    if (!force) {
      const cached = await this.cache.get(file);
      if (cached && this.dependenciesAreCurrent(cached.dependencies)) {
        return {
          sourcePath: file.path,
          ...cached,
          mimeType: "image/webp",
          fromCache: true,
          warnings: [],
        };
      }
      if (cached) await this.cache.invalidate(file.path);
    }

    const sourcePath = file.path;
    let rendered: Awaited<ReturnType<CanvasRenderer["render"]>> | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const sourceMtime = file.stat.mtime;
      const raw = await this.app.vault.cachedRead(file);
      const data = parseJsonCanvas(raw);
      rendered = await this.renderer.render(data, sourcePath);
      if (file.path !== sourcePath) throw new Error("Canvas was renamed while its thumbnail was rendering.");
      if (file.stat.mtime === sourceMtime) break;
      rendered = null;
    }
    if (!rendered) throw new Error("Canvas kept changing while its thumbnail was rendering. Try again after saving.");
    const bytes = await rendered.blob.arrayBuffer();
    const dependencies: Record<string, number> = {};
    for (const path of rendered.dependencies) {
      const dependency = this.app.vault.getAbstractFileByPath(path);
      if (dependency instanceof TFile) dependencies[path] = dependency.stat.mtime;
    }
    if (this.app.vault.getAbstractFileByPath(sourcePath) !== file) throw new Error("Canvas no longer exists.");
    const stored = await this.cache.put(file, bytes, rendered.width, rendered.height, dependencies);
    await this.cache.flush();
    return {
      sourcePath: file.path,
      ...stored,
      mimeType: "image/webp",
      fromCache: false,
      warnings: rendered.warnings,
    };
  }

  private dependenciesAreCurrent(dependencies: Record<string, number>): boolean {
    return Object.entries(dependencies).every(([path, mtime]) => {
      const file = this.app.vault.getAbstractFileByPath(path);
      return file instanceof TFile && file.stat.mtime === mtime;
    });
  }
}
