import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UI_LANGUAGES, translate } from "../src/i18n";

const source = readFileSync(new URL("../src/settings.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
describe("purpose-based native settings sections", () => {
  it("updates all registered command names and the ribbon when settings change", () => {
    for (const key of ["commandOpen", "commandRebuild", "commandClear", "commandGenerate"]) expect(main).toContain(`this.addLocalizedCommand("${key}"`);
    expect(main).toContain('command.name = prefix + this.t(key)');
    expect(main).toContain('setTooltip(this.ribbon, this.t("commandOpen")');
  });
  it("groups each control once, using native headings and the shared language catalog", () => {
    const groups = [
      ["sectionInterface", "settingLanguage", "settingTitle"],
      ["sectionLayout", "settingCardWidth", "settingMetadata"],
      ["sectionBrowsing", "settingDefaultFilter", "settingDefaultSort"],
      ["sectionIcons", "settingFolderIcon", "settingNavigationIcon"],
      ["sectionCache", "cacheLocation", "commandClear"],
    ];
    for (const [section, ...keys] of groups) {
      const start = source.indexOf(`heading("${section}")`);
      expect(start).toBeGreaterThan(0);
      const next = source.indexOf('\n    heading("', start + 1);
      const group = source.slice(start, next < 0 ? source.indexOf('\n  }\n}', start) : next);
      for (const key of keys) {
        expect(group).toContain(`"${key}"`);
        if (key !== "commandClear") expect(source.match(new RegExp(`"${key}"`, "g"))).toHaveLength(1);
      }
    }
    expect(source).toContain('.setName(t(key)).setHeading()');
    expect(source).toContain('.addOptions(LANGUAGE_OPTIONS)');
    expect(source).not.toContain('language === "en" ? 0');
  });
  it.each(UI_LANGUAGES)("has seven distinct non-empty section headings in %s", language => {
    const headings = ["sectionInterface", "sectionLayout", "sectionBrowsing", "sectionIcons", "folderCoverColors", "noteCoverColors", "sectionCache"] as const;
    const names = headings.map(key => translate(language, key));
    expect(new Set(names).size).toBe(7);
    expect(names.every(name => name.trim().length > 0)).toBe(true);
  });
});
