import { describe, expect, it, vi } from "vitest";
import type { App, WorkspaceLeaf } from "obsidian";
import { TFile, TFolder } from "./obsidian-stub";
import { openGalleryFile } from "../src/gallery/OpenFile";
import { groupGallerySelection, GroupSelectionError, selectionRoots, trashGallerySelection } from "../src/gallery/SelectionActions";
import { craftPageLayout } from "../src/gallery/Layout";
import { matchingIcons } from "../src/gallery/IconLibraryModal";
import { LIBRARY_TRANSLATIONS } from "../src/i18n-library";
import { UI_LANGUAGES } from "../src/languages";

function openingHost(existing = false, deferred = false) {
  const file = new TFile("same.canvas"), shown = { view: { file: deferred ? null : file }, getViewState: () => ({ state: { file: file.path } }), loadIfDeferred: vi.fn(async () => {}) } as unknown as WorkspaceLeaf;
  const newLeaf = { openFile: vi.fn(async () => {}) } as unknown as WorkspaceLeaf;
  const workspace = { iterateAllLeaves: (fn: (leaf: WorkspaceLeaf) => void) => { if (existing) fn(shown); }, revealLeaf: vi.fn(async () => {}), setActiveLeaf: vi.fn(), getLeaf: vi.fn(() => newLeaf) };
  const app = { workspace, vault: { getAbstractFileByPath: () => file } } as unknown as App;
  return { file, shown, newLeaf, workspace, app };
}
describe("shared file opening", () => {
  it.each([false,true])("reuses an existing file tab, deferred=%s", async deferred => {
    const f = openingHost(true,deferred); await openGalleryFile(f.app,f.file);
    expect(f.workspace.getLeaf).not.toHaveBeenCalled(); expect(f.workspace.revealLeaf).not.toHaveBeenCalled();
    expect(f.shown.loadIfDeferred).toHaveBeenCalledOnce(); expect(f.workspace.setActiveLeaf).toHaveBeenCalledWith(f.shown,{focus:true});
  });
  it("coalesces simultaneous sidebar/card opens into one new tab", async () => {
    const f = openingHost(); const results = await Promise.all([openGalleryFile(f.app,f.file),openGalleryFile(f.app,f.file)]);
    expect(f.workspace.getLeaf).toHaveBeenCalledExactlyOnceWith("tab"); expect(f.newLeaf.openFile).toHaveBeenCalledExactlyOnceWith(f.file); expect(results[0]).toBe(results[1]);
  });
  it("rejects a stale file object without opening its replacement", async () => {
    const f = openingHost(); await openGalleryFile(f.app,new TFile(f.file.path)); expect(f.workspace.getLeaf).not.toHaveBeenCalled();
  });
});
function library() {
  const root = new TFolder(), parent = new TFolder("Library",root), a = new TFile("Library/A.md",0,parent), b = new TFile("Library/B.canvas",0,parent);
  parent.children = [a,b]; root.children = [parent];
  const files = new Map<string, unknown>([["",root],[parent.path,parent],[a.path,a],[b.path,b]]);
  const createFolder = vi.fn(async (path: string) => { if(files.has(path))throw Error("exists"); const folder = new TFolder(path,parent); parent.children.push(folder);files.set(path,folder);return folder; });
  const remove = vi.fn(async (item: TFile | TFolder) => { files.delete(item.path); if(item.parent)item.parent.children=item.parent.children.filter(v=>v!==item); });
  const rename = vi.fn(async (item: TFile | TFolder,path: string) => { if(files.has(path))throw Error("collision");files.delete(item.path);if(item.parent)item.parent.children=item.parent.children.filter(v=>v!==item);item.path=path;item.name=path.split("/").at(-1)!;item.parent=files.get(path.slice(0,path.lastIndexOf("/"))) as TFolder;item.parent.children.push(item);files.set(path,item); });
  const app = { vault: { getRoot:()=>root,getAbstractFileByPath:(path:string)=>files.get(path),createFolder,delete:remove },fileManager:{ renameFile:rename,trashFile:remove } } as unknown as App;
  return { root,parent,a,b,files,createFolder,rename,remove,app };
}
describe("grouping selected originals", () => {
  it("moves every selected item into one new sibling folder and keeps unselected files", async () => {
    const f=library(), c=new TFile("Library/C.pdf",0,f.parent);f.parent.children.push(c);f.files.set(c.path,c);
    const folder=await groupGallerySelection(f.app,f.parent,[f.a,f.b],"Bundle");
    expect(folder.children).toEqual([f.a,f.b]);expect(f.a.path).toBe("Library/Bundle/A.md");expect(f.b.path).toBe("Library/Bundle/B.canvas");expect(f.files.get(c.path)).toBe(c);
  });
  it.each(["../outside","", "A.md"])("rejects invalid names or collisions before moving: %s",async name=>{
    const f=library();await expect(groupGallerySelection(f.app,f.parent,[f.a,f.b],name)).rejects.toThrow();expect(f.rename).not.toHaveBeenCalled();expect(f.createFolder).not.toHaveBeenCalled();
  });
  it("fails stale selection preflight before creating anything",async()=>{
    const f=library();f.files.set(f.b.path,new TFile(f.b.path));await expect(groupGallerySelection(f.app,f.parent,[f.a,f.b],"Bundle")).rejects.toThrow();expect(f.createFolder).not.toHaveBeenCalled();
  });
  it("preserves a file that appears in the destination after preflight",async()=>{
    const f=library(),create=f.createFolder.getMockImplementation()!;
    f.createFolder.mockImplementation(async path=>{const folder=await create(path);const other=new TFile(path+"/A.md",0,folder);folder.children.push(other);f.files.set(other.path,other);return folder;});
    await expect(groupGallerySelection(f.app,f.parent,[f.a,f.b],"Bundle")).rejects.toBeInstanceOf(GroupSelectionError);
    expect(f.rename).not.toHaveBeenCalled();expect(f.files.get("Library/A.md")).toBe(f.a);expect(f.files.get("Library/Bundle/A.md")).not.toBe(f.a);expect(f.remove).not.toHaveBeenCalled();
  });
  it("rolls back completed moves if a later disk move fails",async()=>{
    const f=library(), move=f.rename.getMockImplementation()!;f.rename.mockImplementation(async(item,path)=>{if(item===f.b)throw Error("disk");await move(item,path);});
    await expect(groupGallerySelection(f.app,f.parent,[f.a,f.b],"Bundle")).rejects.toMatchObject({remaining:0,folderPath:"Library/Bundle"});
    expect(f.files.get("Library/A.md")).toBe(f.a);expect(f.files.get("Library/B.canvas")).toBe(f.b);expect(f.files.has("Library/Bundle")).toBe(false);
  });
  it("retains and reports files if rollback is blocked",async()=>{
    const f=library(), move=f.rename.getMockImplementation()!;f.rename.mockImplementation(async(item,path)=>{if(item===f.b||path==="Library/A.md")throw Error("disk");await move(item,path);});
    await expect(groupGallerySelection(f.app,f.parent,[f.a,f.b],"Bundle")).rejects.toBeInstanceOf(GroupSelectionError);
    expect(f.files.get("Library/Bundle/A.md")).toBe(f.a);expect(f.files.get("Library/B.canvas")).toBe(f.b);expect(f.remove).not.toHaveBeenCalled();
  });
  it("deduplicates nested selections so children are not moved/deleted twice",()=>{
    const f=library(),child=new TFile("Library/sub.md",0,f.parent);expect(selectionRoots([f.parent,child,child])).toEqual([f.parent]);
  });
});
describe("batch trash",()=>{
  it("trashes all confirmed selected originals",async()=>{const f=library();const r=await trashGallerySelection(f.app,[f.a,f.b]);expect(r.deleted).toEqual([f.a,f.b]);expect(r.error).toBeUndefined();expect(f.remove).toHaveBeenCalledTimes(2);});
  it("reports partial failure and does not touch subsequent items",async()=>{const f=library(),remove=f.remove.getMockImplementation()!;f.remove.mockImplementation(async item=>{if(item===f.b)throw Error("disk");await remove(item);});const r=await trashGallerySelection(f.app,[f.a,f.b]);expect(r.deleted).toEqual([f.a]);expect(r.error).toBeInstanceOf(Error);expect(f.files.get(f.b.path)).toBe(f.b);});
});
describe("Craft width preference",()=>{
  it.each(["grid","masonry","list"] as const)("caps the %s page and compresses only below its preferred width",mode=>{
    expect(craftPageLayout(2000,250,22,40,mode)).toEqual(craftPageLayout(1120,250,22,40,mode));
    for(const space of [0,180,190,210,220,250,360,475,640,720,950,1120,1600]){
      const r=craftPageLayout(space,250,22,40,mode);expect(r.width).toBeLessThanOrEqual(Math.min(1120,space));expect(r.cardWidth).toBeLessThanOrEqual(250);expect(r.cardWidth).toBeGreaterThanOrEqual(0);
    }
    if(mode!=="list"){expect(craftPageLayout(475,250,22,40,mode)).toMatchObject({columns:2,cardWidth:226.5});expect(craftPageLayout(1120,250,22,40,mode).cardWidth).toBe(250);}
  });
  it("preserves exact occupied width for sparse grids",()=>{expect(craftPageLayout(1120,250,22,1,"grid")).toMatchObject({width:250,columns:1});});
});
describe("icon library and complete UI dictionaries",()=>{
  it("searches the full registry and localized common icon families",()=>{const ids=["folder","folder-open","camera","house","alarm-clock"];expect(matchingIcons(ids,"資料夾","zh-TW")).toEqual(["folder","folder-open"]);expect(matchingIcons(ids,"alarm clock","en")).toEqual(["alarm-clock"]);expect(matchingIcons(ids,"首頁","zh-TW")).toEqual(["house"]);expect(matchingIcons(ids,"no-match","en")).toEqual([]);});
  it.each(UI_LANGUAGES)("has all library strings and interpolation tokens in %s",language=>{
    const en=LIBRARY_TRANSLATIONS.en,local=LIBRARY_TRANSLATIONS[language];expect(Object.keys(local).sort()).toEqual(Object.keys(en).sort());
    for(const key of Object.keys(en) as (keyof typeof en)[]){expect(local[key].trim()).not.toBe("");expect([...local[key].matchAll(/\{\w+\}/g)].map(v=>v[0]).sort()).toEqual([...en[key].matchAll(/\{\w+\}/g)].map(v=>v[0]).sort());}
  });
});
