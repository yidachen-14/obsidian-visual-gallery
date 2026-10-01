import { describe, expect, it } from "vitest";
import { TFile, TFolder } from "./obsidian-stub";
import { renameDestination } from "../src/gallery/Rename";

describe("rename destinations", () => {
  it("keeps file extensions and parent folders", () => {
    const parent = new TFolder("創作");
    expect(renameDestination(new TFile("創作/板.canvas", 0, parent), "新板")).toBe("創作/新板.canvas");
    expect(renameDestination(new TFolder("創作/草稿", parent), " 新草稿 ")).toBe("創作/新草稿");
    expect(renameDestination(new TFile("README", 0, new TFolder()), "Notes")).toBe("Notes");
  });
  it("rejects path traversal, empty and invalid names", () => {
    const file = new TFile("a.md");
    for (const name of ["", " ", ".", "..", "../a", "a/b", "a\\b", "a:b", "a?b", "a\u0000b", "a."]) {
      expect(renameDestination(file, name), name).toBeNull();
    }
  });
});
