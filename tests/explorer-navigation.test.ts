import { describe, expect, it } from "vitest";
import type { App } from "obsidian";
import { TAbstractFile, TFile, TFolder } from "./obsidian-stub";
import { explorerGalleryTarget } from "../src/gallery/ExplorerNavigation";

function fixture() {
  const root = new TFolder(""), folder = new TFolder("Projects", root);
  const items = new Map<string, TAbstractFile>([[folder.path, folder]]);
  const app = { vault: { getRoot: () => root, getAbstractFileByPath: (path: string) => items.get(path) } } as unknown as App;
  return { root, folder, items, app };
}

describe("file explorer gallery destinations", () => {
  it("opens the clicked folder itself, including the vault root", () => {
    const { app, root, folder } = fixture();
    expect(explorerGalleryTarget(app, folder)).toEqual({ folderPath: "Projects" });
    expect(explorerGalleryTarget(app, root)).toEqual({ folderPath: "" });
  });
  it.each(["md", "canvas", "pdf", "png", "WEBP"])("reveals the original %s file inside its parent", extension => {
    const { app, folder, items } = fixture();
    const file = new TFile(`Projects/測試.${extension}`, 0, folder); items.set(file.path, file);
    expect(explorerGalleryTarget(app, file)).toEqual({ folderPath: "Projects", revealPath: file.path });
  });
  it("does not offer an action that cannot display unsupported files", () => {
    const { app, folder, items } = fixture();
    const zip = new TFile("Projects/archive.zip", 0, folder); items.set(zip.path, zip);
    expect(explorerGalleryTarget(app, zip)).toBeNull();
  });
  it("ignores deleted and replaced references at callback time", () => {
    const { app, folder, items } = fixture();
    items.delete(folder.path); expect(explorerGalleryTarget(app, folder)).toBeNull();
    items.set(folder.path, new TFolder(folder.path)); expect(explorerGalleryTarget(app, folder)).toBeNull();
  });
});
