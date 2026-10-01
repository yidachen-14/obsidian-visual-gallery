import { describe, expect, it } from "vitest";
import { TFile, TFolder } from "obsidian";
import {
  classifyGalleryFile,
  getBreadcrumbFolders,
  listGalleryEntries,
  validSort,
} from "../src/browser/VaultBrowser";

function file(path: string, mtime: number): TFile {
  const result = new TFile();
  result.path = path;
  result.name = path.split("/").at(-1) ?? path;
  const dot = result.name.lastIndexOf(".");
  result.basename = dot >= 0 ? result.name.slice(0, dot) : result.name;
  result.extension = dot >= 0 ? result.name.slice(dot + 1) : "";
  result.stat.mtime = mtime;
  return result;
}

function folder(path: string, parent: TFolder | null = null): TFolder {
  const result = new TFolder();
  result.path = path;
  result.name = path.split("/").at(-1) ?? path;
  result.parent = parent;
  return result;
}

describe("gallery browsing", () => {
  it("classifies supported files and rejects unrelated attachments", () => {
    expect(classifyGalleryFile(file("Board.CANVAS", 1))).toBe("canvas");
    expect(classifyGalleryFile(file("Note.md", 1))).toBe("notes");
    expect(classifyGalleryFile(file("Poster.webp", 1))).toBe("images");
    expect(classifyGalleryFile(file("Reference.pdf", 1))).toBe("pdf");
    expect(classifyGalleryFile(file("Archive.zip", 1))).toBeNull();
  });

  it("keeps folders first and applies filtering and sorting", () => {
    const root = folder("");
    root.children = [
      file("Older.canvas", 10),
      file("Newest.md", 30),
      folder("Projects", root),
      file("Middle.png", 20),
    ];

    expect(listGalleryEntries(root, "all", "modified").map(({ item }) => item.name)).toEqual([
      "Projects",
      "Newest.md",
      "Middle.png",
      "Older.canvas",
    ]);
    expect(listGalleryEntries(root, "canvas", "name").map(({ item }) => item.name)).toEqual([
      "Projects",
      "Older.canvas",
    ]);
  });

  it("builds a root-to-current-folder breadcrumb", () => {
    const root = folder("");
    const projects = folder("Projects", root);
    const boards = folder("Projects/Boards", projects);
    expect(getBreadcrumbFolders(boards).map((folder) => folder.path)).toEqual([
      "",
      "Projects",
      "Projects/Boards",
    ]);
  });

  it.each([
    ["name", ["Alpha.md", "Beta.md", "Gamma.md"]],
    ["name-desc", ["Gamma.md", "Beta.md", "Alpha.md"]],
    ["modified", ["Beta.md", "Gamma.md", "Alpha.md"]],
    ["modified-asc", ["Alpha.md", "Gamma.md", "Beta.md"]],
    ["created", ["Gamma.md", "Alpha.md", "Beta.md"]],
    ["created-asc", ["Beta.md", "Alpha.md", "Gamma.md"]],
  ] as const)("implements %s like the file explorer", (sort, expected) => {
    const root = folder("");
    const alpha = file("Alpha.md", 10), beta = file("Beta.md", 30), gamma = file("Gamma.md", 20);
    alpha.stat.ctime = 20; beta.stat.ctime = 10; gamma.stat.ctime = 30;
    root.children = [beta, folder("Zulu", root), gamma, folder("Aardvark", root), alpha];
    expect(listGalleryEntries(root, "all", sort).map(entry => entry.item.name)).toEqual(["Aardvark", "Zulu", ...expected]);
  });

  it("retains saved legacy sorts and safely rejects invalid ones", () => {
    expect(validSort("name")).toBe("name");
    expect(validSort("modified")).toBe("modified");
    expect(validSort("created-asc")).toBe("created-asc");
    expect(validSort("unknown")).toBe("modified");
    expect(validSort(undefined, "name-desc")).toBe("name-desc");
  });

  it("uses natural names and stable alphabetical tie-breaking for timestamps", () => {
    const root = folder("");
    root.children = [file("Note10.md", 5), file("Note2.canvas", 5), file("Note1.png", 5)];
    expect(listGalleryEntries(root, "all", "modified").map(entry => entry.item.name)).toEqual(["Note1.png", "Note2.canvas", "Note10.md"]);
  });
});
