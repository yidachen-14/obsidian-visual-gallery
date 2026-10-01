import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, loadGallerySettings } from "../src/SettingsModel";
import { UI_LANGUAGES, translate } from "../src/i18n";

describe("independent folder/note cover colors", () => {
  it("preserves new installation defaults and does not mutate them", () => {
    const fresh = loadGallerySettings();
    expect(fresh).toEqual(DEFAULT_SETTINGS);
    fresh.folderDarkStart = "#111111";
    expect(DEFAULT_SETTINGS.folderDarkStart).toBe("#262626");
  });
  it("copies all four old shared colors without discarding custom appearance", () => {
    const old = {lightStart: "#fedcba", lightEnd: "#123456", darkStart: "#223344", darkEnd: "#334455", appearanceDefaultsVersion: 1};
    const result = loadGallerySettings(old);
    expect(result).toMatchObject({...old, folderLightStart: old.lightStart, folderLightEnd: old.lightEnd, folderDarkStart: old.darkStart, folderDarkEnd: old.darkEnd});
  });
  it("retains independent colors across later settings loads", () => {
    const saved = {...DEFAULT_SETTINGS, folderLightStart: "#fa1234", folderDarkEnd: "#abc123", lightStart: "#ccdddd", darkEnd: "#000000"};
    expect(loadGallerySettings(saved)).toEqual(saved);
    expect(saved.lightStart).toBe("#ccdddd");
  });
  it("applies the existing historical dark-default migration before copying colors", () => {
    const migrated = loadGallerySettings({darkStart: "#4a4a4a"});
    expect(migrated.darkStart).toBe("#262626");
    expect(migrated.folderDarkStart).toBe("#262626");
    expect(loadGallerySettings({darkStart: "#4a4a4a", appearanceDefaultsVersion: 1}).folderDarkStart).toBe("#4a4a4a");
  });
  it.each(UI_LANGUAGES)("has distinct translated color headings in %s", language => {
    expect(translate(language, "folderCoverColors")).not.toBe(translate(language, "noteCoverColors"));
    expect(translate(language, "folderCoverColors")).toBeTruthy();
  });
  it.each(UI_LANGUAGES)("preserves saved language and appearance when upgrading %s", language => {
    const saved = {...DEFAULT_SETTINGS, language, folderIcon: "legacy-folder", galleryTitle: "My gallery", folderLightStart: "#aabbcc"};
    expect(loadGallerySettings(saved)).toEqual(saved);
  });
  it("rejects an unknown saved locale without losing other preferences", () => {
    const saved = {...DEFAULT_SETTINGS, language: "unknown", cardWidth: 220};
    expect(loadGallerySettings(saved as unknown as Partial<typeof DEFAULT_SETTINGS>)).toMatchObject({language: "en", cardWidth: 220});
  });
});
