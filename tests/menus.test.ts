import { describe, expect, it, vi } from "vitest";
import { Menu as StubMenu, MenuItem } from "./obsidian-stub";
import { cardMenu, creationMenu, filterMenu, sortMenu } from "../src/gallery/Menus";
import { GALLERY_FILTERS, GALLERY_SORTS } from "../src/browser/VaultBrowser";
import { UI_LANGUAGES, filterLabel, sortLabel, translate } from "../src/i18n";

describe("native gallery menus", () => {
  it.each(UI_LANGUAGES)("has six grouped sort options and one checkmark in %s", language => {
    const choose = vi.fn();
    const menu = sortMenu(language, "created-asc", choose) as unknown as StubMenu;
    expect(menu.items).toHaveLength(8);
    expect(menu.items[2]).toBeNull(); expect(menu.items[5]).toBeNull();
    const options = menu.items.filter((item): item is MenuItem => item !== null);
    expect(options.map(item => item.title)).toEqual(GALLERY_SORTS.map(sort => sortLabel(language, sort)));
    expect(options.filter(item => item.checked)).toHaveLength(1);
    expect(options[5]?.checked).toBe(true);
    options.forEach(item => item.callback());
    expect(choose.mock.calls.map(call => call[0])).toEqual([...GALLERY_SORTS]);
  });

  it("adds Finder and native deletion actions without changing the rename action", () => {
    const rename = vi.fn(), remove = vi.fn(), reveal = vi.fn();
    const menu = cardMenu("zh-TW", true, true, rename, remove, reveal) as unknown as StubMenu;
    expect(menu.items.map(item => item?.title)).toEqual(["重新命名", "在 Finder 中顯示", undefined, "刪除"]);
    expect(menu.items[3]?.warning).toBe(true);
    for (const item of menu.items) item?.callback();
    expect(rename).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledOnce(); expect(reveal).toHaveBeenCalledOnce();
  });

  it.each(UI_LANGUAGES)("orders note, Canvas and folder creation in %s", language => {
    const create = vi.fn();
    const menu = creationMenu(language, create) as unknown as StubMenu;
    expect(menu.items.map(item => item?.title)).toEqual([translate(language, "newNote"), translate(language, "newCanvas"), translate(language, "newFolder")]);
    expect(menu.items.map(item => item?.icon)).toEqual(["file-plus", "layout-dashboard", "folder-plus"]);
    menu.items.forEach(item => item?.callback());
    expect(create.mock.calls.map(call => call[0])).toEqual(["note", "canvas", "folder"]);
  });
  it("disables unsupported reveal", () => {
    const nonLocal = cardMenu("en", false, false, () => {}, () => {}, () => {}) as unknown as StubMenu;
    expect(nonLocal.items[1]?.disabled).toBe(true);
  });
  it.each(UI_LANGUAGES)("has all five text filters with one checkmark in %s", language => {
    for (const current of GALLERY_FILTERS) {
      const choose = vi.fn();
      const menu = filterMenu(language, current, choose) as unknown as StubMenu;
      expect(menu.items.map(item => item?.title)).toEqual(GALLERY_FILTERS.map(value => filterLabel(language, value)));
      expect(menu.items.filter(item => item?.checked)).toHaveLength(1);
      expect(menu.items[GALLERY_FILTERS.indexOf(current)]?.checked).toBe(true);
      expect(choose).not.toHaveBeenCalled();
      menu.items.forEach(item => item?.callback());
      expect(choose.mock.calls.map(call => call[0])).toEqual(GALLERY_FILTERS);
    }
  });
  it.each(["note", "canvas", "folder"] as const)("shared plus menu waits before creating the selected %s", kind => {
    const create = vi.fn();
    const menu = creationMenu("zh-TW", create) as unknown as StubMenu;
    expect(menu.items).toHaveLength(3);
    expect(create).not.toHaveBeenCalled();
    menu.items[["note", "canvas", "folder"].indexOf(kind)]?.callback();
    expect(create).toHaveBeenCalledExactlyOnceWith(kind);
  });
  it.each(UI_LANGUAGES)("omits rename entirely for a multi-selection in %s", language => {
    const remove = vi.fn(), reveal = vi.fn();
    const menu = cardMenu(language, true, true, null, remove, reveal) as unknown as StubMenu;
    expect(menu.items.map(item => item?.title)).toEqual([translate(language, "showInFinder"), undefined, translate(language, "delete")]);
    expect(menu.items.some(item => item?.title === translate(language, "rename"))).toBe(false);
    menu.items.forEach(item => item?.callback());
    expect(remove).toHaveBeenCalledOnce(); expect(reveal).toHaveBeenCalledOnce();
  });
});
