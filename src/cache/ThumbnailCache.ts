import type { DataAdapter, TFile } from "obsidian";
import { hash64 } from "../utils/hash";
import { buildThumbnailCacheKey } from "./cacheKey";

interface CacheEntry {
  sourceMtime: number;
  rendererVersion: string;
  cacheKey: string;
  fileName: string;
  width: number;
  height: number;
  generatedAt: number;
  dependencies?: Record<string, number>;
}

interface CacheIndex {
  format: 1;
  entries: Record<string, CacheEntry>;
}

export interface CachedThumbnail {
  cachePath: string;
  resourceUrl: string;
  width: number;
  height: number;
  dependencies: Record<string, number>;
}

export class ThumbnailCache {
  private readonly cacheDir: string;
  private readonly indexPath: string;
  private index: CacheIndex = { format: 1, entries: {} };
  private loaded = false;
  private dirty = false;
  private saveTimer: number | null = null;
  private readonly writingFiles = new Set<string>();

  constructor(
    private readonly adapter: DataAdapter,
    pluginDirectory: string,
    private readonly rendererVersion: string,
    namespace = "",
  ) {
    this.cacheDir = namespace
      ? `${pluginDirectory}/thumbnail-cache/${namespace}`
      : `${pluginDirectory}/thumbnail-cache`;
    this.indexPath = `${this.cacheDir}/index.json`;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (!(await this.adapter.exists(this.indexPath))) return;
      const parsed: unknown = JSON.parse(await this.adapter.read(this.indexPath));
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "format" in parsed &&
        parsed.format === 1 &&
        "entries" in parsed &&
        typeof parsed.entries === "object" &&
        parsed.entries !== null
      ) {
        const entries = (parsed as CacheIndex).entries;
        this.index.entries = Object.fromEntries(Object.entries(entries).filter(([, entry]) =>
          entry && /^[a-z0-9]+\.webp$/.test(entry.fileName) && typeof entry.dependencies !== "string"));
      }
    } catch (error) {
      console.warn("[Visual Gallery] Ignoring an unreadable thumbnail cache index.", error);
      this.index = { format: 1, entries: {} };
    }
  }

  buildKey(file: Pick<TFile, "path" | "stat">): string {
    return buildThumbnailCacheKey(file.path, file.stat.mtime, this.rendererVersion);
  }

  async get(file: TFile): Promise<CachedThumbnail | null> {
    await this.load();
    const entry = this.index.entries[file.path];
    const cacheKey = this.buildKey(file);
    if (
      !entry ||
      entry.cacheKey !== cacheKey ||
      entry.sourceMtime !== file.stat.mtime ||
      entry.rendererVersion !== this.rendererVersion
    ) {
      return null;
    }
    const cachePath = `${this.cacheDir}/${entry.fileName}`;
    if (!(await this.adapter.exists(cachePath))) {
      delete this.index.entries[file.path];
      this.scheduleSave();
      return null;
    }
    return {
      cachePath,
      resourceUrl: this.adapter.getResourcePath(cachePath),
      width: entry.width,
      height: entry.height,
      dependencies: entry.dependencies ?? {},
    };
  }

  async put(
    file: TFile,
    bytes: ArrayBuffer,
    width: number,
    height: number,
    dependencies: Record<string, number> = {},
  ): Promise<CachedThumbnail> {
    await this.load();
    await this.ensureDirectory();
    const cacheKey = this.buildKey(file);
    const fileName = `${hash64(cacheKey)}.webp`;
    const cachePath = `${this.cacheDir}/${fileName}`;
    const previous = this.index.entries[file.path];
    this.writingFiles.add(fileName);
    try {
      await this.adapter.writeBinary(cachePath, bytes);
      this.index.entries[file.path] = {
        sourceMtime: file.stat.mtime,
        rendererVersion: this.rendererVersion,
        cacheKey,
        fileName,
        width,
        height,
        generatedAt: Date.now(),
        dependencies,
      };
    } finally {
      this.writingFiles.delete(fileName);
    }
    if (previous && previous.fileName !== fileName) {
      await this.removeIfPresent(`${this.cacheDir}/${previous.fileName}`);
    }
    this.scheduleSave();
    return { cachePath, resourceUrl: this.adapter.getResourcePath(cachePath), width, height, dependencies };
  }

  async invalidate(sourcePath: string): Promise<void> {
    await this.load();
    const entry = this.index.entries[sourcePath];
    if (!entry) return;
    delete this.index.entries[sourcePath];
    await this.removeIfPresent(`${this.cacheDir}/${entry.fileName}`);
    this.scheduleSave();
  }

  async invalidateOlderThan(sourcePath: string, sourceMtime: number): Promise<void> {
    await this.load();
    const entry = this.index.entries[sourcePath];
    if (entry && entry.sourceMtime < sourceMtime) await this.invalidate(sourcePath);
  }

  async flush(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.dirty) return;
    this.dirty = false;
    try {
      await this.ensureDirectory();
      await this.adapter.write(this.indexPath, JSON.stringify(this.index, null, 2));
    } catch (error) {
      this.dirty = true;
      throw error;
    }
  }

  async clear(): Promise<void> {
    await this.load();
    const entries = Object.values(this.index.entries);
    this.index = { format: 1, entries: {} };
    await Promise.all(entries.map((entry) => this.removeIfPresent(`${this.cacheDir}/${entry.fileName}`, true)));
    await this.removeOrphans(true);
    this.dirty = true;
    await this.flush();
  }

  async prune(mtime: (path: string) => number | undefined): Promise<void> {
    await this.load();
    for (const [path, entry] of Object.entries(this.index.entries)) {
      if (mtime(path) !== entry.sourceMtime || entry.rendererVersion !== this.rendererVersion ||
        Object.entries(entry.dependencies ?? {}).some(([dependency, time]) => mtime(dependency) !== time)) {
        if (this.index.entries[path] === entry) await this.invalidate(path);
      }
    }
    await this.removeOrphans();
    await this.flush();
  }

  private async removeOrphans(strict = false): Promise<void> {
    if (!(await this.adapter.exists(this.cacheDir))) return;
    const { files } = await this.adapter.list(this.cacheDir);
    for (const path of files) {
      const name = path.slice(this.cacheDir.length + 1);
      // Only files owned by this cache, never nested folders or source files.
      if (path.startsWith(`${this.cacheDir}/`) && /^[a-z0-9]+\.webp$/.test(name) &&
        !this.writingFiles.has(name) && !Object.values(this.index.entries).some(entry => entry.fileName === name)) await this.removeIfPresent(path, strict);
    }
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.flush().catch((error: unknown) => {
        console.error("[Visual Gallery] Could not persist the thumbnail cache index.", error);
      });
    }, 500);
  }

  private async ensureDirectory(): Promise<void> {
    if (!(await this.adapter.exists(this.cacheDir))) {
      const segments = this.cacheDir.split("/");
      let current = "";
      for (const segment of segments) {
        current = current ? `${current}/${segment}` : segment;
        if (!(await this.adapter.exists(current))) await this.adapter.mkdir(current);
      }
    }
  }

  private async removeIfPresent(path: string, strict = false): Promise<void> {
    try {
      if (await this.adapter.exists(path)) await this.adapter.remove(path);
    } catch (error) {
      if (strict) throw error;
      console.warn(`[Visual Gallery] Could not remove stale thumbnail ${path}.`, error);
    }
  }
}
