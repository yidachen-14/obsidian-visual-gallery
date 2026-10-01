import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/gallery/GalleryView.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

describe("native gallery event contracts", () => {
  it.each(["dragover", "drop"])("claims %s without blocking native ghost tracking/cleanup", type => {
    const handler = source.match(new RegExp(`element\\.addEventListener\\("${type}"[\\s\\S]*?\\n    \\}\\);`))?.[0];
    expect(handler).toBeTruthy();
    expect(handler).toContain("event.preventDefault()");
    expect(handler).not.toContain("stopPropagation");
    expect(handler).not.toContain("stopImmediatePropagation");
  });
  it("keeps the compact filter chevrons as a decorative non-intercepting icon", () => {
    expect(source).toContain('setIcon(filterIcon, "chevrons-up-down")');
    expect(source).toContain('"aria-hidden": "true"');
    const icon = css.match(/\.visual-gallery-filter-icon \{([\s\S]*?)\}/)?.[1];
    expect(icon).toContain("pointer-events: none");
    expect(icon).toContain("right: 8px");
  });
  it("does not depend on theme background images or restore an oversized filter", () => {
    const select = css.match(/\.visual-gallery-view select\.visual-gallery-select \{([\s\S]*?)\}/)?.[1];
    expect(select).toContain("background-image: none");
    expect(select).toContain("field-sizing: content");
    expect(select).toContain("min-width: 0");
    expect(select).toContain("padding-right: 28px");
  });
  it("keeps the sort arrow outside the ellipsized label in every language", () => {
    expect(source).toContain('setIcon(sortIcon, "chevrons-up-down")');
    expect(source).toContain('cls: "visual-gallery-sort-label"');
    expect(source).toContain('cls: "visual-gallery-sort-icon", attr: { "aria-hidden": "true" }');
    const icon = css.match(/\.visual-gallery-sort-icon \{([\s\S]*?)\}/)?.[1];
    expect(icon).toContain("pointer-events: none");
    expect(icon).toContain("flex: 0 0 14px");
    const label = css.match(/\.visual-gallery-sort-label \{([\s\S]*?)\}/)?.[1];
    expect(label).toContain("min-width: 0");
    expect(label).toContain("text-overflow: ellipsis");
  });
  it("never wraps sparse-gallery controls below the folder title", () => {
    for (const selector of ["visual-gallery-header", "visual-gallery-controls"]) {
      expect(css.match(new RegExp(`\\.${selector} \\{([\\s\\S]*?)\\}`))?.[1]).toContain("flex-wrap: nowrap");
    }
    expect(css.match(/\.visual-gallery-title-area h2 \{([\s\S]*?)\}/)?.[1]).toContain("text-overflow: ellipsis");
  });
});
