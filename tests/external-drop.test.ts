import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import { TFolder } from "./obsidian-stub";
import { ExternalFileDrop } from "../src/gallery/ExternalDrop";

class Target extends EventTarget {
  classes = new Set<string>();
  addClass(name: string) { this.classes.add(name); }
  removeClass(name: string) { this.classes.delete(name); }
}
function fixture() {
  const root = new TFolder(""), folder = new TFolder("Projects", root);
  const files = new Map([["", root], [folder.path, folder]]);
  const importAttachments = vi.fn(async (_files: unknown[], _folder: TFolder) => []);
  const completed = vi.fn(), failed = vi.fn(), dragManager = { draggable: null as unknown };
  const app = { importAttachments, dragManager, vault: { getRoot: () => root, getAbstractFileByPath: (p: string) => files.get(p) } } as unknown as App;
  const importer = new ExternalFileDrop(app, completed, failed, file => "/outside/" + file.name);
  const target = new Target();
  const detach = importer.attach(target as unknown as HTMLElement, () => folder);
  const data = (name = "測試.note.md", text = "note body") => ({ types: ["Files"], files: [new File([text], name)], items: [], dropEffect: "none" }) as unknown as DataTransfer;
  const emit = (element: Target, type: string, transfer = data()) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { dataTransfer: transfer }); element.dispatchEvent(event); return event;
  };
  return { root, folder, files, importer, target, detach, data, emit, importAttachments, completed, failed, dragManager };
}

describe("external gallery file import", () => {
  it("accepts protected Files dragover without reading bytes or stopping propagation", () => {
    const f = fixture(), event = f.emit(f.target, "dragover", { types: ["Files"], files: [], items: [] } as unknown as DataTransfer);
    expect(event.defaultPrevented).toBe(true);
    expect(event.cancelBubble).toBe(false);
    expect(f.target.classes.has("is-drop-target")).toBe(true);
    expect(f.importAttachments).not.toHaveBeenCalled();
  });
  it("passes exact file bytes, names and destination to the native importer", async () => {
    const f = fixture(), data = f.data();
    const event = f.emit(f.target, "drop", data);
    expect(event.defaultPrevented).toBe(true); expect(event.cancelBubble).toBe(false);
    // A browser protects the payload again when the drop callback returns.
    Object.assign(data, { files: [], items: [] });
    await vi.waitFor(() => expect(f.completed).toHaveBeenCalledOnce());
    const [files, target] = f.importAttachments.mock.calls[0]! as unknown as [Array<{name: string; extension: string; filepath: string; data: Promise<ArrayBuffer>}>, TFolder];
    expect(target).toBe(f.folder);
    expect(files[0]).toMatchObject({ name: "測試.note", extension: "md", filepath: "/outside/測試.note.md" });
    expect(new TextDecoder().decode(await files[0]!.data)).toBe("note body");
  });
  it("lets a child target claim a drop exactly once before the current-folder ancestor", async () => {
    const f = fixture(), parent = new Target();
    f.importer.attach(parent as unknown as HTMLElement, () => f.root);
    const e = f.emit(f.target, "drop"); parent.dispatchEvent(e);
    await vi.waitFor(() => expect(f.completed).toHaveBeenCalledOnce());
    expect(f.importAttachments).toHaveBeenCalledOnce();
    expect(f.importAttachments.mock.calls[0]?.[1]).toBe(f.folder);
  });
  it("uses the current destination at drop time and serializes batches", async () => {
    const f = fixture(), row = new Target(); let folder = f.root;
    f.importer.attach(row as unknown as HTMLElement, () => folder);
    let release!: () => void;
    f.importAttachments.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve([]); }));
    f.emit(row, "dragover"); folder = f.folder;
    f.emit(row, "drop", f.data("one.png")); f.emit(row, "drop", f.data("two.bin"));
    await vi.waitFor(() => expect(f.importAttachments).toHaveBeenCalledTimes(1));
    expect(f.importAttachments.mock.calls[0]?.[1]).toBe(f.folder);
    release(); await vi.waitFor(() => expect(f.completed).toHaveBeenCalledTimes(2));
  });
  it("rejects stale destinations, internal drags and plain text/URL drops", () => {
    const f = fixture();
    f.dragManager.draggable = { type: "file" }; expect(f.emit(f.target, "drop").defaultPrevented).toBe(false);
    f.dragManager.draggable = null;
    expect(f.emit(f.target, "drop", { types: ["text/uri-list"], items: [] } as unknown as DataTransfer).defaultPrevented).toBe(false);
    f.files.set(f.folder.path, new TFolder(f.folder.path));
    expect(f.emit(f.target, "drop").defaultPrevented).toBe(false); expect(f.importAttachments).not.toHaveBeenCalled();
  });
  it("reports a failed read and recovers for the following batch", async () => {
    const f = fixture();
    const file = { name: "broken.png", arrayBuffer: () => Promise.reject(Error("read failed")) };
    f.emit(f.target, "drop", { types: ["Files"], files: [file], items: [] } as unknown as DataTransfer);
    await vi.waitFor(() => expect(f.failed).toHaveBeenCalledOnce());
    expect(f.importAttachments).not.toHaveBeenCalled();
    f.emit(f.target, "drop"); await vi.waitFor(() => expect(f.completed).toHaveBeenCalledOnce());
  });
  it("retains native directory import and delegates collision naming to the host", async () => {
    const f = fixture();
    const directory = { kind: "file", getAsFile: () => ({ name: "Images" }), webkitGetAsEntry: () => ({ isDirectory: true }) };
    f.emit(f.target, "drop", { types: ["Files"], items: [directory], files: [] } as unknown as DataTransfer);
    await vi.waitFor(() => expect(f.completed).toHaveBeenCalledOnce());
    expect(f.importAttachments.mock.calls[0]?.[0]).toEqual([{ name: "Images", extension: "", filepath: "/outside/Images", data: null, isDirectory: true }]);
    f.emit(f.target, "drop", f.data(".gitignore"));
    await vi.waitFor(() => expect(f.completed).toHaveBeenCalledTimes(2));
    expect(f.importAttachments.mock.calls[1]?.[0]?.[0]).toMatchObject({ name: ".gitignore", extension: "" });
  });
  it("detaches live handlers cleanly", () => {
    const f = fixture(); f.detach(); expect(f.emit(f.target, "drop").defaultPrevented).toBe(false);
  });
});
