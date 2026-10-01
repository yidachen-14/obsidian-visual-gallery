import { describe, expect, it } from "vitest";
import { translate } from "../src/i18n";

describe("interface translations", () => {
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
