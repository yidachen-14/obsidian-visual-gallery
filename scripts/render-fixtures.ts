import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { TFile, normalizePath } from "obsidian";
import { CanvasRenderer } from "../src/canvas/CanvasRenderer";
import { parseJsonCanvas } from "../src/canvas/CanvasParser";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDirectory = path.join(projectDirectory, "tests", "fixtures");
const outputDirectory = path.join(projectDirectory, "artifacts");
const fixtureNames = ["all-features.canvas", "very-wide.canvas", "very-tall.canvas", "many-nodes.canvas", "broken-links.canvas"];

const files = new Map<string, TFile>();
for (const name of [
  ...fixtureNames,
  "nested.canvas",
  "sample-note.md",
  "sample-image.svg",
]) {
  const bytes = await readFile(path.join(fixtureDirectory, name));
  files.set(name, new TFile(name, bytes.byteLength));
}

const vault = {
  cachedRead: async (file: TFile): Promise<string> => readFile(path.join(fixtureDirectory, file.path), "utf8"),
  readBinary: async (file: TFile): Promise<ArrayBuffer> => {
    const bytes = await readFile(path.join(fixtureDirectory, file.path));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  },
  getFileByPath: (filePath: string): TFile | null => files.get(normalizePath(filePath)) ?? null,
};

const metadataCache = {
  getFirstLinkpathDest: (linkPath: string, sourcePath: string): TFile | null => {
    const direct = files.get(normalizePath(linkPath));
    if (direct) return direct;
    const resolved = normalizePath(path.posix.join(path.posix.dirname(sourcePath), linkPath));
    return files.get(resolved) ?? null;
  },
};

Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    createElement: (tagName: string): unknown => {
      if (tagName !== "canvas") throw new Error(`Unexpected element ${tagName}`);
      return createCanvas(1, 1);
    },
  },
});

Object.defineProperty(globalThis, "createImageBitmap", {
  configurable: true,
  value: async (source: Blob): Promise<unknown> => {
    const image = await loadImage(Buffer.from(await source.arrayBuffer()));
    Object.defineProperty(image, "close", { configurable: true, value: () => undefined });
    return image;
  },
});

const app = { vault, metadataCache };
const renderer = new CanvasRenderer(app as never, { maxDimension: 1200, pixelRatio: 1 });
await mkdir(outputDirectory, { recursive: true });

for (const fixtureName of fixtureNames) {
  const sourceFile = files.get(fixtureName);
  if (!sourceFile) throw new Error(`Missing fixture ${fixtureName}`);
  const raw = await vault.cachedRead(sourceFile);
  const rendered = await renderer.render(parseJsonCanvas(raw), sourceFile.path);
  const outputPath = path.join(outputDirectory, fixtureName.replace(/\.canvas$/u, ".webp"));
  await writeFile(outputPath, Buffer.from(await rendered.blob.arrayBuffer()));
  process.stdout.write(`${path.basename(outputPath)} ${rendered.width}x${rendered.height} warnings=${rendered.warnings.length}\n`);
}
