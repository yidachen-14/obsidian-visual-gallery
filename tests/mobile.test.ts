import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UI_LANGUAGES, translate } from "../src/i18n";
import { MOBILE_TRANSLATIONS } from "../src/i18n-mobile";
import { mobileCardMenu } from "../src/gallery/Menus";
import { Menu as StubMenu, MenuItem, Platform, TFile, FileSystemAdapter } from "./obsidian-stub";
import { canRevealItem, revealGalleryItem } from "../src/gallery/ItemActions";
import { galleryToolbarSizing } from "../src/gallery/Layout";
import { thumbnailBlob } from "../src/utils/thumbnailBlob";
import { decodeImage } from "../src/utils/decodeImage";
import { installPdfCompatibility } from "../src/thumbnails/PdfCompatibility";
import { TouchInteraction } from "../src/gallery/TouchInteraction";

afterEach(() => { Platform.isMobile = false; vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("mobile compatibility", () => {
  it("allows mobile installation without rewriting existing released versions", () => {
    const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
    expect(manifest).toMatchObject({ version: "0.1.19", isDesktopOnly: false, minAppVersion: "1.13.7" });
  });
  it.each(UI_LANGUAGES)("has a fully translated mobile menu in %s without Finder or multi-rename", language => {
    const dictionary = MOBILE_TRANSLATIONS[language];
    expect(Object.keys(dictionary).sort()).toEqual(Object.keys(MOBILE_TRANSLATIONS.en).sort());
    for (const key of Object.keys(MOBILE_TRANSLATIONS.en) as (keyof typeof dictionary)[]) {
      expect(dictionary[key].trim()).not.toBe("");
      expect([...dictionary[key].matchAll(/\{\w+\}/g)].map(x => x[0])).toEqual([...MOBILE_TRANSLATIONS.en[key].matchAll(/\{\w+\}/g)].map(x => x[0]));
    }
    const actions = { open: vi.fn(), selectAll: vi.fn(), clear: vi.fn(), move: vi.fn(), rename: null, remove: vi.fn() };
    const menu = mobileCardMenu(language, 2, actions) as unknown as StubMenu;
    const items = menu.items.filter((item): item is MenuItem => !!item);
    expect(items.map(item => item.title)).toEqual(["open", "selectAll", "clearSelection", "moveSelection", "delete"].map(key => translate(language, key as "open")));
    items[3]!.callback(); expect(actions.move).toHaveBeenCalledOnce();
    const single = mobileCardMenu(language, 1, { ...actions, rename: vi.fn() }) as unknown as StubMenu;
    expect(single.items.filter(item => item?.title === translate(language, "rename"))).toHaveLength(1);
  });
  it("does not touch Electron or require FileSystemAdapter on mobile", () => {
    Platform.isMobile = true;
    const file = new TFile("note.md"), shell = { showItemInFolder: vi.fn() };
    const app = { vault: { adapter: new FileSystemAdapter(), getRoot: () => null, getAbstractFileByPath: () => file } };
    expect(canRevealItem(app as never)).toBe(false);
    expect(() => revealGalleryItem(app as never, file as never, shell)).toThrow("Not a local desktop vault");
    expect(shell.showItemInFolder).not.toHaveBeenCalled();
  });
  it("keeps exactly three visible touch targets and preserves desktop sizes", () => {
    for (const width of [216, 270, 320, 360, 510, 720, 1024]) {
      const touch = galleryToolbarSizing(width, 3, true);
      expect(touch.buttonSize).toBe(44); expect(touch.width).toBeLessThan(width - 42);
      expect(galleryToolbarSizing(width).buttonSize).toBe(28);
    }
  });
  it("accepts Safari PNG fallback without pretending it is WebP", async () => {
    const png = new Blob(["png"], { type: "image/png" });
    const canvas = { toBlob: (callback: BlobCallback) => callback(png) };
    expect((await thumbnailBlob(canvas as never)).type).toBe("image/png");
    const toBlob = vi.fn().mockImplementationOnce((cb: BlobCallback) => cb(null)).mockImplementationOnce((cb: BlobCallback) => cb(png));
    expect(await thumbnailBlob({ toBlob } as never)).toBe(png);
    expect(toBlob.mock.calls[1]![1]).toBe("image/png");
  });
  it("falls back to HTML image decoding without ImageBitmap and releases its URL", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const revoke = vi.fn(); vi.stubGlobal("URL", { createObjectURL: () => "blob:local", revokeObjectURL: revoke });
    class ImageMock { naturalWidth = 80; naturalHeight = 60; onload: (() => void) | null = null; set src(_value: string) { this.onload?.(); } }
    vi.stubGlobal("Image", ImageMock);
    const decoded = await decodeImage(new Blob(["png"]));
    expect(decoded.width).toBe(80); expect(decoded.height).toBe(60); expect(revoke).not.toHaveBeenCalled();
    decoded.close(); expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:local");
  });
  it("installs missing PDF APIs without replacing native implementations", async () => {
    const keys = ["withResolvers", "try"];
    const descriptors = keys.map(key => Object.getOwnPropertyDescriptor(Promise, key));
    try {
      for (const key of keys) Reflect.deleteProperty(Promise, key);
      installPdfCompatibility();
      const p = Promise as unknown as { withResolvers(): { promise: Promise<unknown>; resolve(value: unknown): void }; try(callback: () => unknown): Promise<unknown> };
      const deferred = p.withResolvers(); deferred.resolve(42); expect(await deferred.promise).toBe(42);
      await expect(p.try(() => { throw Error("failure"); })).rejects.toThrow("failure");
      const original = p.try; installPdfCompatibility(); expect(p.try).toBe(original);
    } finally { keys.forEach((key, index) => { Reflect.deleteProperty(Promise, key); if (descriptors[index]) Object.defineProperty(Promise, key, descriptors[index]!); }); }
  });
});

describe("touch holds never claim scrolling", () => {
  class Card extends EventTarget {
    isConnected = true;
    closest(): Card { return this; }
    contains(node: unknown): boolean { return node === this; }
  }
  function fixture() {
    vi.useFakeTimers(); vi.stubGlobal("Element", Card); vi.stubGlobal("Node", Card);
    const root = new EventTarget(), card = new Card(), held = vi.fn();
    const touch = new TouchInteraction(root as never, held);
    const dispatch = (type: string, values: Record<string, unknown> = {}) => {
      const event = new Event(type, { cancelable: true });
      for (const [key, value] of Object.entries({ target: card, pointerType: "touch", pointerId: 1, isPrimary: true, button: 0, clientX: 10, clientY: 20, ...values })) Object.defineProperty(event, key, { value });
      root.dispatchEvent(event); return event;
    };
    return { touch, card, held, dispatch };
  }
  it("opens one long-press menu and suppresses its trailing click", () => {
    const f = fixture(); expect(f.dispatch("pointerdown").defaultPrevented).toBe(false);
    vi.advanceTimersByTime(550); expect(f.held).toHaveBeenCalledExactlyOnceWith(f.card, 10, 20);
    f.dispatch("pointerup"); expect(f.dispatch("click").defaultPrevented).toBe(true);
    expect(f.dispatch("click").defaultPrevented).toBe(false); f.touch.dispose();
  });
  it.each(["pointerup", "pointercancel", "scroll"])("cancels hold on %s", type => {
    const f = fixture(); f.dispatch("pointerdown"); f.dispatch(type); vi.advanceTimersByTime(1000);
    expect(f.held).not.toHaveBeenCalled(); f.touch.dispose();
  });
  it("cancels scrolling/pinch and does not consume a normal short tap", () => {
    const f = fixture(); f.dispatch("pointerdown"); f.dispatch("pointermove", { clientY: 40 }); vi.advanceTimersByTime(600);
    expect(f.held).not.toHaveBeenCalled(); expect(f.dispatch("click").defaultPrevented).toBe(false);
    f.dispatch("pointerdown"); f.dispatch("pointerdown", { pointerId: 2, isPrimary: false }); vi.advanceTimersByTime(600);
    expect(f.held).not.toHaveBeenCalled(); f.touch.dispose();
  });
  it("does not react to a mouse and clears timers on unload", () => {
    const f = fixture(); f.dispatch("pointerdown", { pointerType: "mouse" }); vi.advanceTimersByTime(600);
    expect(f.held).not.toHaveBeenCalled(); f.dispatch("pointerdown"); f.touch.dispose(); vi.advanceTimersByTime(600);
    expect(f.held).not.toHaveBeenCalled();
  });
  it("handles an early native context menu and very long holds without opening twice", () => {
    const f = fixture(); f.dispatch("pointerdown"); vi.advanceTimersByTime(450);
    expect(f.dispatch("contextmenu").defaultPrevented).toBe(true);
    vi.advanceTimersByTime(3000); expect(f.held).toHaveBeenCalledOnce();
    f.dispatch("pointerup"); expect(f.dispatch("click").defaultPrevented).toBe(true);
    f.touch.dispose();
  });
});
