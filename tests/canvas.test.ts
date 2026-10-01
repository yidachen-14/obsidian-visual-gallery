import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildThumbnailCacheKey } from "../src/cache/cacheKey";
import { computeBounds, computeRenderDimensions, getAnchorPoint } from "../src/canvas/CanvasGeometry";
import { parseJsonCanvas } from "../src/canvas/CanvasParser";
import type { JsonCanvasNode } from "../src/canvas/JsonCanvasTypes";
import { hash64 } from "../src/utils/hash";
import { AsyncQueue } from "../src/utils/AsyncQueue";
import { ThumbnailCache } from "../src/cache/ThumbnailCache";

const fixtureDirectory = fileURLToPath(new URL("./fixtures", import.meta.url));

describe("JSON Canvas parsing", () => {
  it("parses every representative Canvas fixture", () => {
    const canvasFiles = readdirSync(fixtureDirectory).filter((name) => name.endsWith(".canvas"));
    expect(canvasFiles.length).toBeGreaterThanOrEqual(5);
    for (const name of canvasFiles) {
      const parsed = parseJsonCanvas(readFileSync(`${fixtureDirectory}/${name}`, "utf8"));
      expect(parsed.nodes.length, name).toBeGreaterThan(0);
    }
  });

  it("filters malformed nodes and edges without rejecting healthy siblings", () => {
    const parsed = parseJsonCanvas(JSON.stringify({
      nodes: [
        { id: "ok", type: "text", x: 0, y: 0, width: 100, height: 80, text: "ok" },
        { id: "bad", type: "text", x: 0, y: 0, width: -1, height: 80, text: "bad" },
      ],
      edges: [{ id: "bad-edge", fromNode: 3, toNode: "ok" }],
    }));
    expect(parsed.nodes.map((node) => node.id)).toEqual(["ok"]);
    expect(parsed.edges).toEqual([]);
  });
});

describe("whole-canvas geometry", () => {
  const node = (id: string, x: number, y: number, width: number, height: number): JsonCanvasNode => ({
    id,
    type: "text",
    x,
    y,
    width,
    height,
    text: id,
  });

  it("includes negative coordinates and the far edges of every node", () => {
    const bounds = computeBounds([node("a", -200, -80, 120, 60), node("b", 500, 240, 300, 200)]);
    expect(bounds).toEqual({ minX: -200, minY: -80, maxX: 800, maxY: 440, width: 1000, height: 520 });
  });

  it("always caps an extreme landscape or portrait output", () => {
    const wide = computeRenderDimensions(
      { minX: 0, minY: 0, maxX: 100000, maxY: 200, width: 100000, height: 200 },
      24,
      1600,
      2,
    );
    const tall = computeRenderDimensions(
      { minX: 0, minY: 0, maxX: 200, maxY: 100000, width: 200, height: 100000 },
      24,
      1600,
      2,
    );
    expect(Math.max(wide.width, wide.height)).toBeLessThanOrEqual(1600);
    expect(Math.max(tall.width, tall.height)).toBeLessThanOrEqual(1600);
    expect(wide.height).toBeGreaterThanOrEqual(96);
    expect(tall.width).toBeGreaterThanOrEqual(96);
    expect((wide.contentWidth / wide.contentHeight) / (wide.worldWidth / wide.worldHeight)).toBeCloseTo(1, 1);
    expect((tall.contentWidth / tall.contentHeight) / (tall.worldWidth / tall.worldHeight)).toBeCloseTo(1, 1);
  });

  it("uses the requested edge anchors", () => {
    const sample = node("anchor", 10, 20, 100, 80);
    expect(getAnchorPoint(sample, "right")).toEqual({ x: 110, y: 60 });
    expect(getAnchorPoint(sample, "top")).toEqual({ x: 60, y: 20 });
  });
});

describe("cache identity", () => {
  it("changes for source path, mtime, and renderer version", () => {
    const base = buildThumbnailCacheKey("Board.canvas", 100, "v1");
    expect(buildThumbnailCacheKey("Other.canvas", 100, "v1")).not.toBe(base);
    expect(buildThumbnailCacheKey("Board.canvas", 101, "v1")).not.toBe(base);
    expect(buildThumbnailCacheKey("Board.canvas", 100, "v2")).not.toBe(base);
  });

  it("persists a valid entry across cache instances and rejects a changed mtime", async () => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis });
    const textFiles = new Map<string, string>();
    const binaryFiles = new Map<string, ArrayBuffer>();
    const adapter = {
      exists: async (path: string) => textFiles.has(path) || binaryFiles.has(path) || path.endsWith("thumbnail-cache"),
      read: async (path: string) => textFiles.get(path) ?? "",
      write: async (path: string, value: string) => { textFiles.set(path, value); },
      writeBinary: async (path: string, value: ArrayBuffer) => { binaryFiles.set(path, value); },
      mkdir: async () => undefined,
      list: async (path: string) => ({ files: [...binaryFiles.keys()].filter(key => key.startsWith(`${path}/`)), folders: [] }),
      remove: async (path: string) => { textFiles.delete(path); binaryFiles.delete(path); },
      getResourcePath: (path: string) => `app://fixture/${path}`,
    };
    const file = { path: "Board.canvas", stat: { mtime: 100 } };
    const first = new ThumbnailCache(adapter as never, ".obsidian/plugins/visual-gallery", "v1");
    await first.put(
      file as never,
      new Uint8Array([1, 2, 3]).buffer,
      640,
      360,
      { "Cover.png": 88 },
    );
    await first.flush();

    const reopened = new ThumbnailCache(adapter as never, ".obsidian/plugins/visual-gallery", "v1");
    expect(await reopened.get(file as never)).toMatchObject({
      width: 640,
      height: 360,
      dependencies: { "Cover.png": 88 },
    });
    expect(await reopened.get({ ...file, stat: { mtime: 101 } } as never)).toBeNull();
    await reopened.clear();
    expect(await reopened.get(file as never)).toBeNull();
  });

  it("produces deterministic compact file hashes", () => {
    expect(hash64("same")).toBe(hash64("same"));
    expect(hash64("same")).not.toBe(hash64("different"));
    expect(hash64("same").length).toBeGreaterThan(8);
  });
});

describe("render queue", () => {
  it("never exceeds its configured concurrency and continues after a failure", async () => {
    const queue = new AsyncQueue(2);
    let active = 0;
    let peak = 0;
    const jobs = Array.from({ length: 6 }, (_, index) => queue.add(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      if (index === 2) throw new Error("fixture failure");
      return index;
    }));
    const settled = await Promise.allSettled(jobs);
    expect(peak).toBe(2);
    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(5);
    expect(settled.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});
