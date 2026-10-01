import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// This is a CSS contract gate, not a browser geometry simulation. Actual host
// rendering is separately checked by scripts/check-card-geometry.js.
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({
  selectors: match[1]!.trim().split(",").map(value => value.trim()),
  values: Object.fromEntries(match[2]!.split(";").filter(value => value.includes(":"))
    .map(value => {const index = value.indexOf(":"); return [value.slice(0, index).trim(), value.slice(index + 1).trim()];})),
}));
const card = ".visual-gallery-view button.visual-gallery-card";
const rule = (selector: string) => {
  const matches = rules.filter(value => value.selectors.includes(selector));
  // The only second base-card rule is the existing narrow-screen width rule.
  if (selector === card) {
    expect(matches, selector).toHaveLength(2);
    expect(matches[1]!.values).toEqual({width: "100%"});
  } else expect(matches, selector).toHaveLength(1);
  return matches[0]!.values;
};

describe("locked card-outline geometry", () => {
  it("keeps one surface radius without a layout border or padding", () => {
    expect(rule(card)).toMatchObject({"--vg-card-radius": "14px", "--vg-card-stroke-width": "1px", "border-radius": "var(--vg-card-radius)", border: "0", padding: "0", overflow: "visible", "box-sizing": "border-box"});
  });
  it("draws the ordinary and selected strokes completely outside the surface", () => {
    expect(rule(card + "::before")).toMatchObject({content: '""', inset: "0", border: "0", "box-shadow": "0 0 0 var(--vg-card-stroke-width) var(--vg-card-stroke-color)", "border-radius": "inherit", "box-sizing": "border-box", padding: "0", margin: "0", "pointer-events": "none"});
  });
  it("uses state tokens, never a second outline or independent corner radius", () => {
    for (const state of ["is-selected", "is-drop-target"]) {
      const stateRules = rules.filter(value => value.selectors.includes(card + "." + state));
      expect(stateRules.some(value => value.values["--vg-card-stroke-width"] === "2px" && value.values["--vg-card-stroke-color"] === "var(--vg-selection-ring)")).toBe(true);
      for (const entry of stateRules) {
        expect(entry.values).not.toHaveProperty("border-radius");
        expect(entry.values).not.toHaveProperty("inset");
        expect(entry.values).not.toHaveProperty("border-width");
      }
    }
    expect(rule(card + "::after").content).toBe("none");
    expect(rules.filter(value => value.selectors.some(selector => selector.includes("visual-gallery-card") && selector.includes("::after")))).toHaveLength(1);
    expect(rules.filter(value => value.selectors.some(selector => selector.includes("visual-gallery-card") && selector.includes("::before")))).toHaveLength(1);
  });
  it("clips only the surface and leaves cover/detail corners unrounded", () => {
    expect(rule(".visual-gallery-card-surface")).toMatchObject({"border-radius": "inherit", overflow: "hidden", "box-sizing": "border-box", width: "100%"});
    expect(rule(".visual-gallery-preview")["border-radius"]).toBe("0");
    expect(rule(".visual-gallery-card-details")["border-radius"]).toBe("0");
  });
  it("keeps hover geometry unchanged and selected keyboard focus free of a second ring", () => {
    const hover = rule(card + ":hover");
    for (const key of ["border-radius", "border-width", "inset", "--vg-card-radius", "--vg-card-stroke-width"]) expect(hover).not.toHaveProperty(key);
    expect(rule(card + ".is-selected:focus-visible").outline).toBe("none");
  });
});
