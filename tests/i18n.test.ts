import { describe, expect, it } from "vitest";
import { LANGUAGE_OPTIONS, TRANSLATIONS, UI_LANGUAGES, translate, validLanguage, type TranslationKey } from "../src/i18n";

describe("interface translations", () => {
  it("offers 18 native-named languages with safe English fallback", () => {
    expect(UI_LANGUAGES).toHaveLength(18);
    expect(new Set(Object.values(LANGUAGE_OPTIONS)).size).toBe(18);
    for (const value of [undefined, null, "", "xx", "constructor", "__proto__", 2]) expect(validLanguage(value)).toBe("en");
    expect(validLanguage("pt-BR")).toBe("pt-BR");
  });
  it.each(UI_LANGUAGES)("fully translates every key and preserves placeholders in %s", language => {
    const dictionary = TRANSLATIONS[language];
    expect(Object.keys(dictionary).sort()).toEqual(Object.keys(TRANSLATIONS.en).sort());
    const tokens = (text: string) => [...text.matchAll(/\{([a-z]+)\}/g)].map(match => match[1]).sort();
    for (const key of Object.keys(TRANSLATIONS.en) as TranslationKey[]) {
      expect(dictionary[key].trim(), `${language}.${key}`).not.toBe("");
      expect(tokens(dictionary[key]), `${language}.${key}`).toEqual(tokens(TRANSLATIONS.en[key]));
      expect(translate(language, key, { count: 12, total: 14, folder: "Target", name: "Sample", width: 640, height: 400, detail: "Detail", success: 8, failed: 2 })).not.toMatch(/\{[a-z]+\}/);
    }
    if (language !== "en") {
      for (const key of ["settingLanguage", "settingCardWidth", "rename", "cacheDesc", "moveFailed"] as const) expect(dictionary[key]).not.toBe(TRANSLATIONS.en[key]);
    }
    expect(() => new Intl.DateTimeFormat(language, { month: "short", day: "numeric" }).format(new Date(0))).not.toThrow();
  });
  it("provides English and Traditional Chinese labels", () => {
    expect(translate("en", "settingLanguage")).toBe("Interface language");
    expect(translate("zh-TW", "settingLanguage")).toBe("介面語言");
    expect(translate("zh-CN", "settingLanguage")).toBe("界面语言");
    expect(translate("zh-CN", "gallery")).toBe("视觉图库");
    expect(translate("zh-TW", "gallery")).toBe("視覺圖庫");
  });

  it("interpolates numeric values", () => {
    expect(translate("en", "itemCount", { count: 12 })).toBe("12 items in this folder");
    expect(translate("zh-TW", "itemCount", { count: 12 })).toBe("此資料夾共有 12 個項目");
  });

  it("provides Japanese gallery, settings, notices and interpolation", () => {
    expect(translate("ja", "settingLanguage")).toBe("表示言語");
    expect(translate("ja", "gallery")).toBe("ビジュアルギャラリー");
    expect(translate("ja", "rename")).toBe("名前を変更");
    expect(translate("ja", "settingFolderIcon")).toBe("フォルダーカードのアイコン");
    expect(translate("ja", "itemCount", { count: 12 })).toBe("このフォルダーには 12 個の項目があります");
    expect(translate("ja", "partialMove", { count: 2, total: 3 })).toContain("3 個中 2 個");
    expect(translate("ja", "thumbnailGenerated", { width: 640, height: 400 })).toBe("Canvas サムネイルを生成しました：640×400");
    expect(translate("ja", "thumbnailFailed", { detail: "missing file" })).toContain("missing file");
  });
});
