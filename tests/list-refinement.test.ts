import { describe, expect, it } from "vitest";
import { TFile, TFolder } from "./obsidian-stub";
import { listGalleryEntries, validSort } from "../src/browser/VaultBrowser";
import { LIST_COLUMNS, columnSort } from "../src/gallery/ListHeader";
import { loadGallerySettings, validTitleFontSize } from "../src/SettingsModel";
import { parseSharedState, SHARED_KEYS, sharedSettings } from "../src/state/SharedState";

describe("Craft list column sorting", () => {
  it.each(LIST_COLUMNS)("toggles %s and marks only that column active", column => {
    const first = columnSort(column, column === "name" ? "modified" : "name");
    expect(first.active).toBe(false);
    const selected = columnSort(column, first.next);
    expect(selected.active).toBe(true);
    expect(LIST_COLUMNS.filter(key => columnSort(key, first.next).active)).toEqual([column]);
    const reversed = columnSort(column, selected.next);
    expect(reversed.active).toBe(true); expect(reversed.direction).not.toBe(selected.direction);
    expect(reversed.next).toBe(first.next);
    expect(validSort(first.next)).toBe(first.next);
  });
  it("uses real local recency, leaves unseen files last in both directions and keeps folders first", () => {
    const root = new TFolder(), a = new TFile("Alpha.md", 500, root), b = new TFile("Beta.md", 100, root), c = new TFile("Unseen.md", 9999, root);
    const folder = new TFolder("Folder", root);root.children = [c,b,folder,a];
    const recent = new Map([[a.path,10],[b.path,100]]);
    expect(listGalleryEntries(root,"all","viewed",recent).map(e=>e.item.path)).toEqual([folder.path,b.path,a.path,c.path]);
    expect(listGalleryEntries(root,"all","viewed-asc",recent).map(e=>e.item.path)).toEqual([folder.path,a.path,b.path,c.path]);
    expect(listGalleryEntries(root,"all","viewed",new Map()).map(e=>e.item.path)).toEqual([folder.path,a.path,b.path,c.path]);
    recent.set(a.path,100);
    expect(listGalleryEntries(root,"all","viewed",recent).map(e=>e.item.path)).toEqual([folder.path,a.path,b.path,c.path]);
  });
});

describe("adjustable title size migration and sync", () => {
  it("uses a smaller default, validates malformed input and preserves unrelated appearance", () => {
    expect(loadGallerySettings().titleFontSize).toBe(14);
    expect(validTitleFontSize(NaN)).toBe(14); expect(validTitleFontSize("20")).toBe(14);
    expect(validTitleFontSize(0)).toBe(12); expect(validTitleFontSize(99)).toBe(22); expect(validTitleFontSize(17.6)).toBe(18);
    expect(loadGallerySettings({titleFontSize:18,folderLightStart:"#123456",language:"zh-TW"})).toMatchObject({titleFontSize:18,folderLightStart:"#123456",language:"zh-TW"});
  });
  it("shares valid title sizes while rejecting corrupt field registers", () => {
    expect(SHARED_KEYS).toContain("titleFontSize");
    const register=(value:number)=>({version:1,settings:{titleFontSize:{value,clock:2,device:"A"}},favorites:{}});
    expect(sharedSettings(parseSharedState(register(18))).titleFontSize).toBe(18);
    expect(sharedSettings(parseSharedState(register(100))).titleFontSize).toBe(14);
  });
});
