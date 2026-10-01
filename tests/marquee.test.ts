import { describe, expect, it } from "vitest";
import { intersects, marqueePaths, selectionRect } from "../src/gallery/MarqueeSelection";

describe("marquee selection", () => {
  it("selects intersecting cards in any drag direction, without selecting mere edge contacts", () => {
    const card = { left: 10, top: 10, right: 30, bottom: 30 };
    for (const rect of [selectionRect(0, 0, 20, 20), selectionRect(20, 20, 0, 0)]) expect(intersects(rect, card)).toBe(true);
    expect(intersects(selectionRect(0, 0, 10, 10), card)).toBe(false);
    expect(intersects(selectionRect(35, 35, 40, 40), card)).toBe(false);
    expect(intersects(selectionRect(0, 0, 40, 40), card)).toBe(true);
  });
  it("replaces selections or adds a Shift rectangle", () => {
    const base = new Set(["a"]);
    expect([...marqueePaths(["b", "c"], base, false, false)]).toEqual(["b", "c"]);
    expect([...marqueePaths(["b", "c"], base, true, false)]).toEqual(["a", "b", "c"]);
    expect([...base]).toEqual(["a"]);
  });
  it("toggles Command/Ctrl rectangles against the initial selection, even across repeated moves", () => {
    const base = new Set(["a", "b"]);
    expect([...marqueePaths(["b", "c"], base, false, true)]).toEqual(["a", "c"]);
    expect([...marqueePaths(["b", "c"], base, false, true)]).toEqual(["a", "c"]);
    expect([...marqueePaths([], base, false, true)]).toEqual(["a", "b"]);
  });
});
