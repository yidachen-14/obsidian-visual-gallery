import { describe, it, expect } from "vitest";
import { ThumbnailCache } from "../src/cache/ThumbnailCache";

function fixture() {
  Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis });
  const files = new Map<string, string | ArrayBuffer>();
  const adapter = {
    exists: async (path: string) => files.has(path) || path.endsWith("thumbnail-cache"),
    mkdir: async () => {}, read: async (path: string) => files.get(path),
    write: async (path: string, data: string) => { files.set(path, data); },
    writeBinary: async (path: string, data: ArrayBuffer) => { files.set(path, data); },
    remove: async (path: string) => { files.delete(path); },
    getResourcePath: (path: string) => path,
    list: async (path: string) => ({ files: [...files.keys()].filter(key => key.startsWith(`${path}/`)), folders: [] }),
  };
  return { files, cache: new ThumbnailCache(adapter as never, "plugin", "v1"), adapter };
}

describe("automatic cache cleanup", () => {
  it("reports a failed clear instead of claiming the cache is empty", async () => {
    const { cache, adapter } = fixture();
    await cache.put({ path: "board.canvas", stat: { mtime: 1 } } as never, new ArrayBuffer(1), 10, 10);
    adapter.remove = async () => { throw new Error("Permission denied"); };
    await expect(cache.clear()).rejects.toThrow("Permission denied");
    adapter.remove = async () => {};
    await cache.flush();
  });
  it("prunes deleted, changed and dependency-stale previews and orphan files only", async () => {
    const { files, cache } = fixture();
    for (const path of ["ok.canvas", "deleted.pdf", "changed.canvas", "linked.canvas"]) {
      await cache.put({ path, stat: { mtime: 1 } } as never, new ArrayBuffer(1), 10, 10, path === "linked.canvas" ? { "cover.png": 1 } : {});
    }
    files.set("plugin/thumbnail-cache/orphan123.webp", new ArrayBuffer(1));
    files.set("plugin/thumbnail-cache/README.md", "keep");
    files.set("original.md", "keep");
    await cache.prune(path => path === "ok.canvas" || path === "linked.canvas" ? 1 : path === "changed.canvas" || path === "cover.png" ? 2 : undefined);
    expect([...files.keys()].filter(path => path.endsWith(".webp"))).toHaveLength(1);
    expect(files.get("original.md")).toBe("keep");
    expect(files.get("plugin/thumbnail-cache/README.md")).toBe("keep");
    await cache.clear();
    expect([...files.keys()].filter(path => path.endsWith(".webp"))).toHaveLength(0);
  });
  it("ignores path traversal entries in a damaged cache index", async () => {
    const { files, cache } = fixture();
    files.set("plugin/thumbnail-cache/index.json", JSON.stringify({ format: 1, entries: { bad: { fileName: "../../original.md" } } }));
    files.set("original.md", "keep"); await cache.clear();
    expect(files.get("original.md")).toBe("keep");
  });
});
