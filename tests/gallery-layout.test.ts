import { describe, expect, it } from "vitest";
import { galleryHeaderWidth, galleryRowLayout, galleryToolbarSizing } from "../src/gallery/Layout";

describe("toolbar matches occupied card columns", () => {
  it("expands only the header when too few cards cannot fit the title and controls", () => {
    expect(galleryHeaderWidth(1000, 250, 275, 300, 24)).toBe(599);
    expect(galleryHeaderWidth(1000, 528, 275, 300, 24)).toBe(599);
    expect(galleryHeaderWidth(1000, 806, 275, 300, 24)).toBe(806);
  });
  it("caps long titles and never expands beyond available pane width", () => {
    expect(galleryHeaderWidth(700, 250, 2000, 300, 24)).toBe(644);
    expect(galleryHeaderWidth(180, 180, 2000, 500, 24)).toBe(180);
    expect(galleryHeaderWidth(0, 0, 200, 500, 24)).toBe(0);
  });
  it("does not align controls to unused right-side viewport space", () => {
    expect(galleryRowLayout(1000, 250, 28, 9)).toEqual({width: 806, fluid: false});
    expect(galleryRowLayout(1000, 250, 28, 2)).toEqual({width: 528, fluid: false});
    expect(galleryRowLayout(1000, 250, 28, 1)).toEqual({width: 250, fluid: false});
  });
  it("responds to exact card widths, fractional available space and column thresholds", () => {
    for (const width of [180, 190, 210, 220, 250, 360]) {
      const exact = 3 * width + 2 * 23.5;
      expect(galleryRowLayout(exact + .25, width, 23.5, 9).width).toBe(exact);
      expect(galleryRowLayout(exact - .25, width, 23.5, 9).width).toBe(2 * width + 23.5);
    }
  });
  it("keeps narrow panes fluid and empty views usable", () => {
    expect(galleryRowLayout(180, 250, 18, 5)).toEqual({width: 180, fluid: true});
    expect(galleryRowLayout(640, 250, 18, 5, true)).toEqual({width: 640, fluid: true});
    expect(galleryRowLayout(1000, 250, 28, 0)).toEqual({width: 1000, fluid: false});
    expect(galleryRowLayout(0, 250, 18, 5)).toEqual({width: 0, fluid: true});
  });
  it("reserves three icon buttons, compresses only narrow toolbars and keeps fractional sizing", () => {
    expect(galleryToolbarSizing(650)).toEqual({ buttonSize: 28, gap: 4, width: 92 });
    for (const available of [100, 102, 120, 133.5, 134, 180, 250, 360, 650]) {
      const toolbar = galleryToolbarSizing(available);
      expect(toolbar.width).toBe(3 * toolbar.buttonSize + 2 * toolbar.gap);
      expect(toolbar.width + 26 + 16).toBeLessThanOrEqual(available);
      expect(toolbar.buttonSize).toBeGreaterThanOrEqual(18);
      expect(toolbar.buttonSize).toBeLessThanOrEqual(28);
    }
    expect(galleryToolbarSizing(120).buttonSize).not.toBe(28);
  });
});
