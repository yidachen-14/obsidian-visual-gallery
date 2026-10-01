import { describe, expect, it } from "vitest";
import { centeredIconViewBox, FOLDER_ICONS, NAVIGATION_ICONS, validIcon } from "../src/gallery/Icons";

describe("icon choices", () => {
  it("retains the original glyph and removes the duplicate folder-open option", () => {
    expect(FOLDER_ICONS).toContain("legacy-folder");
    expect(FOLDER_ICONS).toContain("folder");
    expect(FOLDER_ICONS).not.toContain("folder-open");
    expect(new Set(FOLDER_ICONS).size).toBe(FOLDER_ICONS.length);
    expect(FOLDER_ICONS).toHaveLength(10);
    expect(FOLDER_ICONS).toContain("folder-heart");
    expect(FOLDER_ICONS).toContain("folder-cog");
    expect(FOLDER_ICONS).toContain("folder-tree");
  });
  it("preserves valid choices and safely defaults unknown saved icons", () => {
    expect(validIcon("legacy-folder", FOLDER_ICONS, "folder")).toBe("legacy-folder");
    expect(validIcon("film", NAVIGATION_ICONS, "layout-grid")).toBe("film");
    expect(validIcon("unknown", NAVIGATION_ICONS, "layout-grid")).toBe("layout-grid");
    expect(validIcon("folder-open", FOLDER_ICONS, "folder")).toBe("folder");
  });
  it("centers actual artwork instead of a top-heavy viewport/font baseline", () => {
    expect(centeredIconViewBox({x: 2, y: 3, width: 20, height: 17}, 24, 24)).toBe("0 -0.5 24 24");
    expect(centeredIconViewBox({x: 0, y: -16, width: 18, height: 18}, 24, 24)).toBe("-3 -19 24 24");
    expect(centeredIconViewBox({x: 0, y: 0, width: 0, height: 0}, 24, 24)).toBeNull();
  });
});
