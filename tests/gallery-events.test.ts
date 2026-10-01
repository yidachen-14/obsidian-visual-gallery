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
  // Explicit 2026-10-01 request replaces the old text/chevron controls with
  // icon-only buttons, with creation merged into one plus menu by request.
  // Card geometry assertions remain unchanged.
  it("uses the shared creation toolbar instead of text dropdowns", () => {
    expect(source).toContain("renderGalleryToolbar(header, language, this.filter, this.sort");
    expect(source).not.toContain("visual-gallery-select");
    expect(source).not.toContain("visual-gallery-sort-label");
    expect(source).toContain("filterMenu(language, this.filter");
    expect(source).toContain("creationMenu(language, kind => this.createItem(kind))");
    expect(source).not.toContain("[action]");
  });
  it("keeps decorative toolbar SVGs non-intercepting and independent of backgrounds", () => {
    const toolbar = readFileSync(new URL("../src/gallery/Toolbar.ts", import.meta.url), "utf8");
    expect(toolbar).toContain('setIcon(button, definition.icon)');
    expect(toolbar).toContain('setAttribute("aria-hidden", "true")');
    expect(toolbar).toContain('setAttribute("aria-haspopup", "menu")');
    expect(css.match(/\.visual-gallery-toolbar-button svg \{([\s\S]*?)\}/)?.[1]).toContain("pointer-events: none");
    expect(css).not.toContain("visual-gallery-filter-icon");
  });
  it("never wraps sparse-gallery controls below the folder title", () => {
    for (const selector of ["visual-gallery-header", "visual-gallery-controls"]) {
      expect(css.match(new RegExp(`\\.${selector} \\{([\\s\\S]*?)\\}`))?.[1]).toContain("flex-wrap: nowrap");
    }
    expect(css.match(/\.visual-gallery-title-area h2 \{([\s\S]*?)\}/)?.[1]).toContain("text-overflow: ellipsis");
    for (const rule of css.matchAll(/\.visual-gallery-header\s*\{([^}]*)\}/g)) {
      expect(rule[1]).not.toContain("flex-direction: column");
    }
  });
  it("registers the native explorer context menu and opens the clicked item", () => {
    const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
    expect(main).toContain('this.registerEvent(this.app.workspace.on("file-menu"');
    expect(main).toContain('source !== "file-explorer-context-menu"');
    expect(main).toContain('this.openGallery(item)');
    expect(main).toContain('target ? { filter: "all" }');
    expect(main).toContain('leaf.view.revealItem(target.revealPath)');
    expect(source).toContain('this.scrollToRevealedItem();');
    expect(source).toContain('card.focus({ preventScroll: true })');
  });
  it("uses native history instead of intercepting the host's mouse side buttons", () => {
    expect(source).toContain("this.navigation = true");
    expect(source).toContain("result.history = true");
    const navigate = source.match(/private async navigateTo[\s\S]*?\n  \}/)?.[0];
    expect(navigate).toContain("await this.leaf.setViewState");
    expect(navigate).not.toContain("this.folderPath =");
    expect(source).not.toMatch(/addEventListener\(["'](?:mousedown|mouseup|auxclick)["']/);
    expect(source).not.toMatch(/window\.history\.(back|forward|go)\(/);
  });
});
