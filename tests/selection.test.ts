import { describe, expect, it } from "vitest";
import { CardSelection } from "../src/gallery/Selection";

describe("desktop selection", () => {
  const order = ["a", "b", "c", "d", "e"];
  it("replaces ordinary selections and toggles Command/Ctrl selections", () => {
    const s = new CardSelection();
    s.select("a", order); s.select("c", order, { metaKey: true });
    expect([...s.paths]).toEqual(["a", "c"]);
    s.select("a", order, { ctrlKey: true }); expect([...s.paths]).toEqual(["c"]);
    s.select("b", order); expect([...s.paths]).toEqual(["b"]);
  });
  it("extends and contracts Shift ranges from a stable anchor", () => {
    const s = new CardSelection(); s.select("b", order);
    s.select("e", order, { shiftKey: true }); expect([...s.paths]).toEqual(["b", "c", "d", "e"]);
    s.select("c", order, { shiftKey: true }); expect([...s.paths]).toEqual(["b", "c"]);
    s.select("a", order, { shiftKey: true }); expect([...s.paths]).toEqual(["a", "b"]);
  });
  it("supports additive ranges and removes hidden/deleted selections", () => {
    const s = new CardSelection(); s.select("a", order); s.select("c", order, { metaKey: true });
    s.select("e", order, { metaKey: true, shiftKey: true }); expect([...s.paths]).toEqual(["a", "c", "d", "e"]);
    s.retain(["d", "e"]); expect([...s.paths]).toEqual(["d", "e"]); expect(s.anchor).toBeNull();
    s.clear(); expect(s.paths.size).toBe(0);
  });
});
