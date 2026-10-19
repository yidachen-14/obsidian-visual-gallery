import { describe, expect, it } from "vitest";
import { masonryBoxes, nearestCard, modeDefinitions, validDisplayMode } from "../src/gallery/DisplayMode";
import { DisplayPreferences } from "../src/state/DisplayPreferences";
import { previewMarkdown } from "../src/gallery/NotePreview";
import { DISPLAY_TRANSLATIONS } from "../src/i18n-display";
import { UI_LANGUAGES, translate } from "../src/i18n";

describe("display layout and keyboard geometry", () => {
  it("packs variable heights without overlaps while retaining source order", () => {
    const r = masonryBoxes(528, 250, 28, [1, 2, .65, 1.4]);
    expect(r.boxes.map(b => [b.x, b.y])).toEqual([[0,0],[278,0],[0,278],[0,468.5]]);
    expect(r.height).toBe(818.5);
    r.boxes.forEach((a,i) => r.boxes.slice(i+1).forEach(b => {
      expect(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y).toBe(true);
    }));
  });
  it("preserves fractional widths and constrains pathological preview heights", () => {
    expect(masonryBoxes(180.5,250,18,[NaN,100],true).boxes).toEqual([
      {x:0,y:0,width:180.5,height:180.5*1.4},{x:0,y:180.5*1.4+18,width:180.5,height:361},
    ]);
    expect(masonryBoxes(800,250,28,[]).height).toBe(0);
    expect(new Set(masonryBoxes(805.2,250,27.6,[1,1,1]).boxes.map(b=>b.x)).size).toBe(3);
  });
  it("moves to geometric neighbours in grid, masonry and list", () => {
    const grid=masonryBoxes(528,250,28,[.8,.8,.8,.8]).boxes;
    expect(nearestCard(grid,0,"ArrowRight")).toBe(1); expect(nearestCard(grid,0,"ArrowDown")).toBe(2);
    const masonry=masonryBoxes(528,250,28,[.65,1.9,1.4,1.2]).boxes;
    expect(nearestCard(masonry,0,"ArrowDown")).toBe(2);
    const list=[0,1,2].map(i=>({x:0,y:i*88,width:500,height:80}));
    expect(nearestCard(list,1,"ArrowDown")).toBe(2); expect(nearestCard(list,1,"ArrowRight")).toBe(1);
  });
  it.each(UI_LANGUAGES)("has all translated switch/column labels in %s", language => {
    expect(Object.keys(DISPLAY_TRANSLATIONS[language]).sort()).toEqual(Object.keys(DISPLAY_TRANSLATIONS.en).sort());
    for(const key of Object.keys(DISPLAY_TRANSLATIONS.en) as (keyof typeof DISPLAY_TRANSLATIONS.en)[]) {
      expect(translate(language,key,{count:3})).toBeTruthy(); expect(translate(language,key,{count:3})).not.toContain("{count}");
    }
    expect(modeDefinitions(language).map(d=>d.mode)).toEqual(["masonry","grid","list"]);
    expect(validDisplayMode("unknown")).toBe("grid");
  });
});

describe("local per-folder display state", () => {
  it("retains independent modes and scroll offsets without shared settings", () => {
    let disk:unknown=null; const a=new DisplayPreferences(()=>disk,d=>{disk=d;}),b=new DisplayPreferences(()=>disk,d=>{disk=d;});
    a.save("A","masonry",400);b.save("B","list",70);a.save("A","grid",20);
    expect(a.folder("A")).toEqual({mode:"grid",scroll:{masonry:400,grid:20}});
    expect(a.folder("B")).toEqual({mode:"list",scroll:{list:70}});
    expect(new DisplayPreferences(()=>disk,()=>{}).folder("A").mode).toBe("grid");
    a.record("A/note.md",123); expect(b.viewed("A/note.md")).toBe(123);
    a.rename("A","New");expect(b.folder("New").scroll.masonry).toBe(400);expect(b.viewed("New/note.md")).toBe(123);
    b.remove("New"); expect(a.viewed("New/note.md")).toBeNull();expect(a.folder("B").mode).toBe("list");
  });
  it("normalizes malformed state and safely supports special folder names", () => {
    let disk:unknown={folders:[["bad",{mode:"future",scroll:{grid:-2,list:Infinity}}]],recent:[["x",NaN]]};
    const state=new DisplayPreferences(()=>disk,d=>{disk=d;});expect(state.folder("bad")).toEqual({mode:"grid",scroll:{grid:0}});
    state.save("__proto__","list",80); expect(state.folder("__proto__").mode).toBe("list");expect(state.viewed("x")).toBeNull();
  });
});

describe("bounded formatted note previews", () => {
  it("keeps headings, lists, tables and local images while excluding frontmatter and query execution", () => {
    const raw='---\nsecret: hidden\n---\n# Title\n- item\n| A | B |\n![[local.png|200]]\n![[Other note]]\n```dataviewjs\nthrow Error("run")\n```\n![remote](https://example.com/pixel.png)';
    const preview=previewMarkdown(raw);
    expect(preview).toContain("# Title");expect(preview).toContain("- item");expect(preview).toContain("| A | B |");
    expect(preview).toContain("![[local.png|200]]"); expect(preview).toContain("[[Other note]]");expect(preview).not.toContain("![[Other note]]");
    expect(preview).not.toContain("secret");expect(preview).not.toContain("throw Error");expect(preview).not.toContain("https://example");
    expect(previewMarkdown('![remote](<https://example.com/a.png>) <img src=//example.com/a.png>')).not.toContain('example.com');
  });
  it("bounds oversized notes and closes truncated fences", () => {
    const text=previewMarkdown('```text\n'+('large\n'.repeat(5000)));
    expect(text.length).toBeLessThanOrEqual(8010);expect(text.endsWith('```')).toBe(true);
  });
});
