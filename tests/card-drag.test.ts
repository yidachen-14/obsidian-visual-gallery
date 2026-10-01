import { describe, expect, it, vi } from "vitest";
import { TFile, TFolder } from "./obsidian-stub";
import { planCardMove, planCardMoves, draggedItem, draggedItems, startCardDrag } from "../src/gallery/CardDrag";
import type { App, TAbstractFile } from "obsidian";

describe("card moves", () => {
  const exists = () => false;
  it("preflights every batch member before moving anything", () => {
    const items = [new TFile("a.md"), new TFile("b.md")];
    expect(planCardMoves(items, new TFolder("B"), path => path === "B/b.md")).toEqual({ error: "nameConflict" });
    expect(planCardMoves([new TFile("A/a.md"), new TFile("C/a.md")], new TFolder("B"), exists)).toEqual({ error: "nameConflict" });
    expect(planCardMoves(items, new TFolder("B"), exists).moves?.map(move => move.path)).toEqual(["B/a.md", "B/b.md"]);
  });
  it("moves a selected folder once even when children are selected", () => {
    const folder = new TFolder("A");
    expect(planCardMoves([folder, new TFile("A/a.md"), folder], new TFolder("B"), exists).moves).toEqual([{ item: folder, path: "B/A" }]);
    expect(planCardMoves([folder], new TFolder("A/sub"), exists)).toEqual({ error: "invalidTarget" });
  });
  it("publishes multi-file payloads compatible with the native sidebar", () => {
    const files = [new TFile("a.md"), new TFile("b.md")];
    const drag = { type: "files", files };
    const manager = { draggable: drag, dragFile: vi.fn(), dragFolder: vi.fn(), dragFiles: vi.fn(() => drag), onDragStart: vi.fn() };
    const app = { dragManager: manager, vault: { getAbstractFileByPath: (path: string) => files.find(file => file.path === path) } } as unknown as App;
    const event = { dataTransfer: {} } as DragEvent;
    expect(startCardDrag(app, event, files)).toBe(true);
    expect(manager.dragFiles).toHaveBeenCalledWith(event, files, "visual-gallery");
    expect(draggedItems(app)).toEqual(files);
  });
  it("retains the filename and extension when moving into folders or the vault root", () => {
    expect(planCardMove(new TFile("板 A.canvas"), new TFolder("創作/資料"), exists)).toEqual({ path: "創作/資料/板 A.canvas" });
    expect(planCardMove(new TFile("創作/板 A.canvas"), new TFolder(), exists)).toEqual({ path: "板 A.canvas" });
  });
  it("does not overwrite a destination or move into the current folder", () => {
    expect(planCardMove(new TFile("a.md"), new TFolder("B"), () => true)).toEqual({ error: "nameConflict" });
    expect(planCardMove(new TFile("B/a.md"), new TFolder("B"), exists)).toEqual({ error: "sameFolder" });
  });
  it("rejects self, descendant and vault-root folder moves", () => {
    const source = new TFolder("A");
    for (const target of [source, new TFolder("A/B/C")]) expect(planCardMove(source, target, exists)).toEqual({ error: "invalidTarget" });
    expect(planCardMove(new TFolder(), new TFolder("B"), exists)).toEqual({ error: "invalidTarget" });
    expect(planCardMove(source, new TFolder("AB"), exists)).toEqual({ path: "AB/A" });
  });
  it("publishes the actual vault file to the native drag manager, not its thumbnail", () => {
    const file = new TFile("note.md");
    const drag = { type: "file", file };
    const manager = { dragFile: vi.fn(() => drag), dragFolder: vi.fn(), onDragStart: vi.fn(), draggable: drag };
    const app = { dragManager: manager, vault: { getAbstractFileByPath: () => file } } as unknown as App;
    const event = { dataTransfer: { effectAllowed: "all" } } as DragEvent;
    expect(startCardDrag(app, event, file as TAbstractFile)).toBe(true);
    expect(manager.onDragStart).toHaveBeenCalledWith(event, drag);
    expect(event.dataTransfer?.effectAllowed).toBe("move");
    expect(draggedItem(app)).toBe(file);
    manager.draggable = { type: "file", file: new TFile("note.md") };
    expect(draggedItem(app)).toBeNull();
  });
  it("fails closed if the native drag integration is unavailable", () => {
    expect(startCardDrag({} as App, {} as DragEvent, new TFile("a.md") as TAbstractFile)).toBe(false);
  });
});
