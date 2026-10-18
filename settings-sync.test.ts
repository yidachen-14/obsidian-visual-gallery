import { describe, expect, it, vi } from "vitest";
import { SettingsSync, type SyncStorage } from "../src/state/SettingsSync";
import { DEFAULT_SETTINGS } from "../src/SettingsModel";
import { emptySharedState, favoriteFolders, mergeSharedStates, parseSharedState, seedSharedSettings, sharedSettings } from "../src/state/SharedState";
import { localDevice, parseBrowserState, validCardWidth } from "../src/state/LocalState";

function disk() {
  const files = new Map<string, string>(), directories = new Set<string>();
  const adapter: SyncStorage["files"] = {
    exists: async path => files.has(path) || directories.has(path),
    mkdir: async path => { directories.add(path); },
    list: async path => ({ files: [...files.keys()].filter(p => p.startsWith(path + "/")), folders: [] }),
    read: async path => { if (!files.has(path)) throw Error("missing"); return files.get(path)!; },
    write: vi.fn(async (path, value) => { files.set(path, value); }),
  };
  return { files, directories, adapter };
}
function device(id: string, store: ReturnType<typeof disk>, cached: unknown = null) {
  const cache = vi.fn(), mirror = vi.fn(async (_settings: Omit<typeof DEFAULT_SETTINGS, "cardWidth">) => {}), changed = vi.fn();
  const sync = new SettingsSync({ files: store.adapter, directory: "plugin/sync-state", device: id, cached, cache, mirror, changed });
  return { sync, cache, mirror, changed };
}
async function exchange(a: ReturnType<typeof disk>, b: ReturnType<typeof disk>) {
  for (const [path, value] of [...a.files].filter(([p]) => p.endsWith("/A.json")).concat([...b.files].filter(([p]) => p.endsWith("/B.json")))) { a.files.set(path, value); b.files.set(path, value); }
}

describe("shared settings and pinned folders", () => {
  it("preserves legacy custom appearance while keeping card width local", async () => {
    const d = disk(), a = device("A", d);
    await a.sync.load({ language: "zh-TW", cardWidth: 320, lightStart: "#123456", darkStart: "#4a4a4a", appearanceDefaultsVersion: 1 });
    expect(a.sync.settings()).toMatchObject({ language: "zh-TW", lightStart: "#123456", folderLightStart: "#123456", darkStart: "#4a4a4a" });
    expect(JSON.stringify([...d.files])).not.toMatch(/cardWidth|folderPath|scrollTop|deviceId/);
    expect(a.mirror.mock.calls[0]?.[0]).not.toHaveProperty("cardWidth");
    const b = device("B", d);
    await b.sync.load({ language: "en" });
    expect(b.sync.settings().language).toBe("zh-TW");
  });
  it("merges offline changes to different fields and both devices' favorites", async () => {
    const da = disk(), db = disk(), a = device("A", da), b = device("B", db);
    await a.sync.load({}); await b.sync.load({});
    await a.sync.update({ language: "ja" }); await a.sync.toggleFavorite("Projects");
    await b.sync.update({ showMetadata: false }); await b.sync.toggleFavorite("Other");
    await exchange(da, db);
    await Promise.all([a.sync.refresh(), b.sync.refresh()]);
    expect(a.sync.settings()).toEqual(b.sync.settings());
    expect(a.sync.settings()).toMatchObject({ language: "ja", showMetadata: false });
    expect(a.sync.favorites()).toEqual(b.sync.favorites());
    expect(a.sync.favorites().sort()).toEqual(["Other", "Projects"]);
  });
  it("converges for simultaneous edits to one field regardless of delivery order", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    try {
      const a = seedSharedSettings({}), b = seedSharedSettings({});
      a.settings.language = { value: "ja", clock: 1000, device: "A" };
      b.settings.language = { value: "zh-TW", clock: 1000, device: "B" };
      expect(mergeSharedStates(a, b)).toEqual(mergeSharedStates(b, a));
      expect(sharedSettings(mergeSharedStates(a, b)).language).toBe("zh-TW");
      const once = mergeSharedStates(a, b);
      expect(mergeSharedStates(once, b, a, once)).toEqual(once);
      expect(mergeSharedStates(a, mergeSharedStates(b, once))).toEqual(mergeSharedStates(mergeSharedStates(a, b), once));
    } finally { vi.restoreAllMocks(); }
  });
  it("retains unpin tombstones when an old/offline device returns", async () => {
    const da = disk(), db = disk(), a = device("A", da), b = device("B", db);
    await a.sync.load({}); await a.sync.toggleFavorite("Projects");
    await exchange(da, db); await b.sync.load({});
    await a.sync.toggleFavorite("Projects");
    await b.sync.update({ galleryTitle: "Offline" });
    await exchange(da, db); await a.sync.refresh(); await b.sync.refresh();
    expect(a.sync.favorites()).toEqual([]); expect(b.sync.favorites()).toEqual([]);
    expect(a.sync.settings().galleryTitle).toBe("Offline");
    expect(Object.values(a.sync.state.favorites).some(e => e.value === null)).toBe(true);
  });
  it("deduplicates independently pinned paths and unpins every live record", async () => {
    const da = disk(), db = disk(), a = device("A", da), b = device("B", db);
    await a.sync.load({}); await b.sync.load({});
    await a.sync.toggleFavorite("Projects"); await b.sync.toggleFavorite("Projects");
    await exchange(da, db); await a.sync.refresh();
    expect(a.sync.favorites()).toEqual(["Projects"]);
    await a.sync.toggleFavorite("Projects");
    expect(favoriteFolders(mergeSharedStates(a.sync.state, b.sync.state))).toEqual([]);
  });
  it("tracks folder and descendant renames with path boundaries and explicit deletes", async () => {
    const a = device("A", disk()); await a.sync.load({});
    for (const path of ["Project", "Project/Nested", "Projects", "Missing"]) await a.sync.toggleFavorite(path);
    await a.sync.relocate("Project", "Renamed");
    expect(a.sync.favorites()).toEqual(["Renamed", "Renamed/Nested", "Projects", "Missing"]);
    await a.sync.relocate("Renamed", null);
    expect(a.sync.favorites()).toEqual(["Projects", "Missing"]);
    // Merely unavailable on a device is retained, not auto-deleted.
    await a.sync.refresh(); expect(a.sync.favorites()).toContain("Missing");
  });
  it("retries an interrupted write without losing the local edit", async () => {
    const d = disk(), a = device("A", d); await a.sync.load({});
    vi.mocked(d.adapter.write).mockRejectedValueOnce(Error("temporarily unavailable"));
    await expect(a.sync.update({ galleryTitle: "Keep me" })).rejects.toThrow("temporarily");
    expect(a.cache.mock.calls.at(-1)?.[0].settings.galleryTitle?.value).toBe("Keep me");
    await a.sync.refresh();
    expect(JSON.parse(d.files.get("plugin/sync-state/A.json")!).settings.galleryTitle.value).toBe("Keep me");
    expect(a.sync.settings().galleryTitle).toBe("Keep me");
  });
  it("retains cached registers during missing or partial transfers, then recovers", async () => {
    const d = disk(), a = device("A", d); await a.sync.load({}); await a.sync.toggleFavorite("Projects");
    const cached = a.cache.mock.calls.at(-1)![0];
    d.files.set("plugin/sync-state/B.json", "{partial");
    d.files.delete("plugin/sync-state/A.json");
    const restarted = device("A", d, cached); await restarted.sync.load({});
    expect(restarted.sync.favorites()).toEqual(["Projects"]);
    const remote = seedSharedSettings({}); remote.settings.language = { value: "fr", clock: Date.now() + 1000, device: "B" };
    d.files.set("plugin/sync-state/B.json", JSON.stringify(remote));
    await restarted.sync.refresh(); expect(restarted.sync.settings().language).toBe("fr");
    await restarted.sync.update({ language: "de" }); expect(restarted.sync.settings().language).toBe("de");
  });
  it("does not echo unchanged polls or foreign local-state fields into sync", async () => {
    const d = disk(), a = device("A", d); await a.sync.load({});
    d.adapter.write = vi.fn(d.adapter.write);
    const mirrorCount = a.mirror.mock.calls.length, notifications = a.changed.mock.calls.length;
    for (let i = 0; i < 3; i++) await a.sync.refresh();
    expect(d.adapter.write).not.toHaveBeenCalled();
    expect(a.mirror).toHaveBeenCalledTimes(mirrorCount); expect(a.changed).toHaveBeenCalledTimes(notifications);
    await a.sync.update({ cardWidth: 350 });
    expect(d.adapter.write).not.toHaveBeenCalled();
    const malformed = { version: 1, settings: { cardWidth: { value: 320, clock: 4, device: "B" }, language: { value: "xx", clock: 4, device: "B" }, defaultFilter: { value: "bad", clock: 4, device: "B" } }, favorites: { bad: { value: { path: "../escape", added: 1 }, clock: 4, device: "B" } } };
    expect(parseSharedState(malformed)).toEqual(emptySharedState());
  });
});

describe("local browsing validation", () => {
  it("validates width and page snapshots without mutating defaults", () => {
    expect(validCardWidth(320)).toBe(320); expect(validCardWidth(Infinity)).toBe(DEFAULT_SETTINGS.cardWidth);
    expect(validCardWidth(1)).toBe(DEFAULT_SETTINGS.cardWidth);
    expect(parseBrowserState(null)).toBeNull();
    expect(parseBrowserState({ folderPath: "A", filter: "pdf", sort: "obsolete", scrollTop: -8 })).toEqual({ folderPath: "A", filter: "pdf", sort: "modified", scrollTop: 0 });
  });
});

it("merges data.json-only transport, repairs stale overwrites, and then stops writing", async () => {
  // Models a sync service that transfers plugin data.json but no extra files.
  let dataA: unknown = null, dataB: unknown = null;
  const da = disk(), db = disk();
  const mirrorA = vi.fn(async (value: unknown) => { dataA = JSON.parse(JSON.stringify(value)); });
  const mirrorB = vi.fn(async (value: unknown) => { dataB = JSON.parse(JSON.stringify(value)); });
  const a = new SettingsSync({ files: da.adapter, directory: "plugin/sync-state", device: "A", cached: null, cache: () => {}, readData: async () => dataA, mirror: mirrorA, changed: () => {} });
  const b = new SettingsSync({ files: db.adapter, directory: "plugin/sync-state", device: "B", cached: null, cache: () => {}, readData: async () => dataB, mirror: mirrorB, changed: () => {} });
  await a.load({ language: "zh-TW" }); dataB = JSON.parse(JSON.stringify(dataA)); await b.load({});
  await a.update({ language: "ja" }); await a.toggleFavorite("Projects");
  await b.update({ showMetadata: false }); await b.toggleFavorite("Other");
  const offlineA = dataA, offlineB = dataB;
  dataA = JSON.parse(JSON.stringify(offlineB)); await a.refresh();
  dataB = JSON.parse(JSON.stringify(offlineA)); await b.refresh();
  expect(a.settings()).toEqual(b.settings()); expect(a.favorites()).toEqual(b.favorites());
  expect(a.settings()).toMatchObject({ language: "ja", showMetadata: false });
  await a.toggleFavorite("Projects");
  dataB = JSON.parse(JSON.stringify(dataA)); await b.refresh();
  expect(b.favorites()).toEqual(["Other"]);
  dataB = JSON.parse(JSON.stringify(offlineA)); await b.refresh();
  expect(b.favorites()).toEqual(["Other"]);
  expect(JSON.stringify(dataB)).not.toMatch(/cardWidth|folderPath|scrollTop/);
  const count = mirrorB.mock.calls.length;
  await b.refresh(); await b.refresh(); expect(mirrorB).toHaveBeenCalledTimes(count);
});


it("persists a device ID when a mobile WebView lacks randomUUID", () => {
  const storage = new Map<string, unknown>();
  const app = { loadLocalStorage: (key: string) => storage.get(key), saveLocalStorage: (key: string, value: unknown) => storage.set(key, value) } as unknown as import("obsidian").App;
  vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(21) });
  try { const id = localDevice(app); expect(id).toMatch(/^[a-f0-9]{32}$/); expect(localDevice(app)).toBe(id); }
  finally { vi.unstubAllGlobals(); }
});
