import { describe, it, expect } from "vitest";
import { loadGallerySettings } from "../src/SettingsModel";
import { parseSharedState, sharedSettings } from "../src/state/SharedState";
describe("independent gallery heading size", () => {
  it("enlarges the page heading without changing card titles", () => {
    expect(loadGallerySettings({titleFontSize:18})).toMatchObject({headingFontSize:24,titleFontSize:18});
    expect(loadGallerySettings({headingFontSize:32,titleFontSize:12})).toMatchObject({headingFontSize:32,titleFontSize:12});
  });
  it("bounds and validates saved sizes", () => {
    expect(loadGallerySettings({headingFontSize:0}).headingFontSize).toBe(18);
    expect(loadGallerySettings({headingFontSize:99}).headingFontSize).toBe(40);
    expect(loadGallerySettings({headingFontSize:NaN}).headingFontSize).toBe(24);
  });
  it("retains the heading size through shared settings", () => {
    expect(sharedSettings(parseSharedState({version:1,settings:{headingFontSize:{value:32,clock:1,device:"A"}},favorites:{}})).headingFontSize).toBe(32);
  });
});
