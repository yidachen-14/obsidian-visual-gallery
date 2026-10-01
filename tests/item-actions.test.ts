import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import { FileSystemAdapter, TAbstractFile, TFile, TFolder } from "./obsidian-stub";
import { canRevealItem, createGalleryItem, deleteGalleryItem, newItemDestination, revealGalleryItem } from "../src/gallery/ItemActions";

function fixture() {
  const root = new TFolder(""), folder = new TFolder("Projects", root), file = new TFile("Projects/測試.md", 0, folder);
  const items = new Map<string, TAbstractFile>([["Projects", folder], [file.path, file]]);
  const promptForDeletion = vi.fn().mockResolvedValue(true);
  const create = vi.fn(async (path: string, _content: string) => {
    if (items.has(path)) throw Error("Collision");
    const item = new TFile(path, 0, folder); items.set(path, item); return item;
  });
  const createFolder = vi.fn(async (path: string) => {
    if (items.has(path)) throw Error("Collision");
    const item = new TFolder(path, folder); items.set(path, item); return item;
  });
  const adapter = new FileSystemAdapter("/Vault with spaces");
  const app = { vault: { getRoot: () => root, getAbstractFileByPath: (path: string) => items.get(path), adapter, create, createFolder },
    fileManager: { promptForDeletion } } as unknown as App;
  return { app, root, folder, file, items, promptForDeletion, create, createFolder };
}

describe("gallery item actions", () => {
  it("creates safe note/folder destinations in the current directory", () => {
    const { root, folder } = fixture();
    expect(newItemDestination(folder, " 新筆記 ", "note")).toBe("Projects/新筆記.md");
    expect(newItemDestination(root, "Note.MD", "note")).toBe("Note.MD");
    expect(newItemDestination(folder, "新資料夾", "folder")).toBe("Projects/新資料夾");
    expect(newItemDestination(folder, " 新畫布 ", "canvas")).toBe("Projects/新畫布.canvas");
    expect(newItemDestination(root, "Board.CANVAS", "canvas")).toBe("Board.CANVAS");
    for (const name of ["", ".", "..", "../escape", "a/b", "bad\\name", "bad:", "bad.", "a\u0000b"]) {
      expect(newItemDestination(folder, name, "note")).toBeNull();
      expect(newItemDestination(folder, name, "canvas")).toBeNull();
    }
  });

  it("uses the native deletion prompt exactly once and honors cancellation", async () => {
    const { app, file, promptForDeletion } = fixture();
    promptForDeletion.mockResolvedValue(false);
    expect(await deleteGalleryItem(app, file)).toBe(false);
    expect(promptForDeletion).toHaveBeenCalledExactlyOnceWith(file);
  });

  it("does not delete the root or stale references", async () => {
    const { app, root, file, items, promptForDeletion } = fixture();
    await expect(deleteGalleryItem(app, root)).rejects.toThrow();
    items.delete(file.path);
    await expect(deleteGalleryItem(app, file)).rejects.toThrow();
    expect(promptForDeletion).not.toHaveBeenCalled();
  });

  it("creates an empty Markdown note or a folder without overwriting", async () => {
    const { app, folder, create, createFolder } = fixture();
    expect((await createGalleryItem(app, folder, "Draft", "note")).path).toBe("Projects/Draft.md");
    expect(create).toHaveBeenCalledExactlyOnceWith("Projects/Draft.md", "");
    expect((await createGalleryItem(app, folder, "Boards", "folder")).path).toBe("Projects/Boards");
    expect(createFolder).toHaveBeenCalledExactlyOnceWith("Projects/Boards");
    await expect(createGalleryItem(app, folder, "Draft", "note")).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("rejects stale creation folders and propagates write failures", async () => {
    const { app, folder, items, create } = fixture();
    create.mockRejectedValueOnce(Error("Denied"));
    await expect(createGalleryItem(app, folder, "Draft", "note")).rejects.toThrow("Denied");
    items.delete(folder.path);
    await expect(createGalleryItem(app, folder, "Other", "folder")).rejects.toThrow();
  });

  it("reveals the original full Unicode path rather than a thumbnail cache file", () => {
    const { app, file } = fixture();
    const shell = { showItemInFolder: vi.fn() };
    expect(canRevealItem(app)).toBe(true);
    revealGalleryItem(app, file, shell);
    expect(shell.showItemInFolder).toHaveBeenCalledExactlyOnceWith("/Vault with spaces/Projects/測試.md");
  });

  it("creates valid empty JSON Canvas and never overwrites an existing board", async () => {
    const { app, folder, create, createFolder } = fixture();
    expect((await createGalleryItem(app, folder, "Board", "canvas")).path).toBe("Projects/Board.canvas");
    expect(JSON.parse(create.mock.calls[0]![1])).toEqual({ nodes: [], edges: [] });
    expect(createFolder).not.toHaveBeenCalled();
    await expect(createGalleryItem(app, folder, "Board.canvas", "canvas")).rejects.toThrow();
    expect(create).toHaveBeenCalledOnce();
    create.mockRejectedValueOnce(Error("Denied"));
    await expect(createGalleryItem(app, folder, "Other", "canvas")).rejects.toThrow("Denied");
  });

  it("refuses non-local adapters and stale reveal references", () => {
    const { app, file, items } = fixture();
    const shell = { showItemInFolder: vi.fn() };
    items.delete(file.path);
    expect(() => revealGalleryItem(app, file, shell)).toThrow();
    items.set(file.path, file);
    Object.assign(app.vault, { adapter: {} });
    expect(canRevealItem(app)).toBe(false);
    expect(() => revealGalleryItem(app, file, shell)).toThrow();
    expect(shell.showItemInFolder).not.toHaveBeenCalled();
  });
});
