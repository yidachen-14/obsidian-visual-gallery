import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TFile, TFolder } from "./obsidian-stub";
import { folderFileCounts } from "../src/gallery/ExplorerAppearance";

describe("explorer folder totals", () => {
  it("counts all nested files, including unsupported files, but no folders", () => {
    const root = new TFolder(""), assets = new TFolder("Assets", root), images = new TFolder("Assets/Images", assets), empty = new TFolder("Empty", root);
    root.children = [assets, empty, new TFile("Root.md", 0, root)];
    assets.children = [images, new TFile("Assets/archive.zip", 0, assets)];
    images.children = [new TFile("Assets/Images/a.png", 0, images), new TFile("Assets/Images/b.jpg", 0, images)];
    expect([...folderFileCounts(root)]).toEqual(expect.arrayContaining([["", 4], ["Assets", 3], ["Assets/Images", 2], ["Empty", 0]]));
    images.children.pop();
    expect(folderFileCounts(root).get("Assets")).toBe(2);
  });
  it("handles deeply nested folders without recursive call-stack growth", () => {
    const root = new TFolder("root");
    let parent = root;
    for (let i = 0; i < 12000; i++) {
      const child = new TFolder(String(i), parent);
      parent.children = [child]; parent = child;
    }
    parent.children = [new TFile("leaf.md", 0, parent)];
    const counts = folderFileCounts(root);
    expect(counts.size).toBe(12001);
    expect(counts.get("root")).toBe(1);
  });
});

describe("explorer appearance isolation", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8").split("/* Dedicated Visual Gallery explorer only; gallery card styles stay independent. */")[1]!;
  const source = readFileSync(new URL("../src/gallery/ExplorerAppearance.ts", import.meta.url), "utf8");
  it("scopes every added selector to the dedicated explorer", () => {
    expect(css).toBeTruthy();
    for (const rule of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
      for (const selector of rule[1]!.trim().split(",")) expect(selector.trim()).toMatch(/^\.visual-gallery-explorer(?:$|[ .]|-)/);
    }
    expect(css).not.toContain("visual-gallery-card");
  });
  it("uses a single icon slot with native icons and the retained disclosure element", () => {
    expect(source).toContain('setIcon(node.collapseEl, "chevron-down")');
    expect(source).toContain('"lucide-folder"');
    expect(source).toContain('"lucide-folder-open"');
    expect(source).not.toContain("innerHTML");
    const homeKeys = source.match(/view\.registerDomEvent\(home, "keydown",[\s\S]*?\n  \}\);/)?.[0];
    expect(homeKeys).toContain('event.key !== "Enter"');
    // Only Home's keyboard events bypass the native Files Enter shortcut.
    // No drag event propagation is intercepted by this decoration layer.
    expect(source.replace(homeKeys!, "")).not.toContain("stopPropagation");
    expect(source).not.toContain("stopImmediatePropagation");
    expect(css).toContain(".nav-folder-title:hover > .collapse-icon > svg");
    expect(css).toContain(".nav-folder-title:hover > .collapse-icon > .visual-gallery-explorer-folder-icon");
  });
  it("routes the home action through the shared gallery navigator and native root drop handler", () => {
    expect(source).toContain("navigate(app.vault.getRoot()).catch(onError)");
    expect(source).toContain("view.attachDropHandler?.(app.vault.getRoot(), home)");
    expect(source).toContain('view.registerEvent(app.vault.on("rename", schedule))');
    expect(source).toContain("window.clearTimeout(timer)");
  });
});
