import { describe, expect, it, vi } from "vitest";
import type { Setting, SettingDefinitionGroup, SettingDefinitionRender } from "obsidian";
import { VisualGallerySettingTab } from "../src/settings";
import { DEFAULT_SETTINGS, loadGallerySettings } from "../src/SettingsModel";
import { UI_LANGUAGES, translate } from "../src/i18n";

describe("searchable settings and safe saved data", () => {
  it.each(UI_LANGUAGES)("indexes all controls under seven translated native groups in %s", language => {
    const settings = { ...DEFAULT_SETTINGS, language };
    const tab = new VisualGallerySettingTab({} as never, {} as never, () => settings, async () => {}, "local-cache", async () => {});
    const groups = tab.getSettingDefinitions() as SettingDefinitionGroup[];
    expect(groups.map(g => g.heading)).toEqual(["sectionInterface", "sectionLayout", "sectionBrowsing", "sectionIcons", "folderCoverColors", "noteCoverColors", "sectionCache"].map(k => translate(language, k as Parameters<typeof translate>[1])));
    expect(groups.map(g => g.items?.length)).toEqual([4,3,2,2,2,2,2]);
    const items = groups.flatMap(g => g.items ?? []);
    expect(items).toHaveLength(17);
    expect(items.every(row => "name" in row && !!row.name?.trim() && !("searchable" in row && row.searchable === false))).toBe(true);
    expect(items.find(row => "name" in row && row.name === translate(language,"settingTitleFontSize"))?.desc).toBe(translate(language,"settingTitleFontSizeDesc"));
  });
  it("refreshes the search definitions after a language change and preserves appearance", async () => {
    let settings = { ...DEFAULT_SETTINGS, folderLightStart: "#123456", titleFontSize: 18 };
    const tab = new VisualGallerySettingTab({} as never, {} as never, () => settings, async value => { settings = value; }, "cache", async () => {});
    const update = vi.spyOn(tab, "update");
    const language = (tab.getSettingDefinitions()[0] as SettingDefinitionGroup).items![0] as SettingDefinitionRender;
    let change!: (value: string) => void;
    const dropdown = { addOptions() { return this; }, setValue() { return this; }, onChange(fn: typeof change) { change = fn; return this; } };
    language.render({ addDropdown(fn: (value: typeof dropdown) => void) { fn(dropdown); } } as unknown as Setting, {} as never);
    change("zh-TW"); await Promise.resolve(); await Promise.resolve();
    expect(update).toHaveBeenCalledOnce();
    expect(settings).toMatchObject({ language: "zh-TW", folderLightStart: "#123456", titleFontSize: 18 });
    expect((tab.getSettingDefinitions()[0] as SettingDefinitionGroup).heading).toBe(translate("zh-TW", "sectionInterface"));
  });
  it("rejects malformed saved field types before UI and sync consume them", () => {
    for (const input of [null,[],false,"broken"]) expect(loadGallerySettings(input)).toEqual(DEFAULT_SETTINGS);
    expect(loadGallerySettings({ galleryTitle: {}, showMetadata: "false", folderIcon: [], lightStart: [], cardWidth: NaN, defaultFilter: "unknown" })).toEqual(DEFAULT_SETTINGS);
    expect(loadGallerySettings({ lightStart: "#abc", folderDarkStart: "rebeccapurple" })).toMatchObject({ lightStart: "#abc", folderLightStart: "#abc", folderDarkStart: "rebeccapurple" });
    expect(loadGallerySettings({ language: "zh-TW", galleryTitle: "我的圖庫", folderLightStart: "#abcdef", showMetadata: false })).toMatchObject({ language: "zh-TW", galleryTitle: "我的圖庫", folderLightStart: "#abcdef", showMetadata: false });
  });
});
