import type { DataAdapter } from "obsidian";
import type { VisualGallerySettings } from "../SettingsModel";
import { emptySharedState, favoriteFolders, mergeSharedStates, moveFavoritePath, nextClock, parseSharedState, seedSharedSettings, sharedSettings, sharedSignature, SHARED_KEYS, validFolderPath, type SharedState } from "./SharedState";

type SyncFiles = Pick<DataAdapter, "exists" | "mkdir" | "list" | "read" | "write">;
export interface SyncStorage {
  files: SyncFiles;
  directory: string;
  device: string;
  cached: unknown;
  cache: (state: SharedState) => void;
  readData?: () => Promise<unknown>;
  mirror: (settings: Omit<VisualGallerySettings, "cardWidth"> & { _visualGallerySync: SharedState }) => Promise<void>;
  changed: () => void;
}
/** Each device owns one file. Offline edits never overwrite another device's
 * file; the synchronized union retains tombstones and original field stamps.
 * data.json also carries the union, supporting sync services that transport
 * only plugin settings. Local cached registers repair stale whole-file writes.
 * No cloud API: transport remains the vault's existing file sync. */
export class SettingsSync {
  state = emptySharedState();
  private queue: Promise<void> = Promise.resolve();
  private mirrored = "";
  private notified = "";
  private dirty = false;
  constructor(private readonly storage: SyncStorage) {}

  async load(legacy: Partial<VisualGallerySettings>): Promise<void> {
    this.state = parseSharedState(this.storage.cached);
    await this.readPeers();
    if (!Object.keys(this.state.settings).length) this.state = mergeSharedStates(seedSharedSettings(legacy, this.storage.device), this.state);
    // Seed once so a second device sees migrations, rather than its defaults.
    await this.writeOwn();
    await this.notify();
  }
  refresh(): Promise<void> { return this.run(async () => { await this.readPeers(); if (this.dirty) await this.writeOwn(); await this.notify(); }); }
  update(patch: Partial<VisualGallerySettings>): Promise<void> {
    return this.mutate(() => {
      const clock = nextClock(this.state);
      for (const key of SHARED_KEYS) if (patch[key] !== undefined) this.state.settings[key] = { value: patch[key], clock, device: this.storage.device };
    });
  }
  toggleFavorite(path: string): Promise<void> {
    if (!validFolderPath(path)) return Promise.resolve();
    return this.mutate(() => {
      const clock = nextClock(this.state), device = this.storage.device;
      const matching = Object.entries(this.state.favorites).filter(([, entry]) => entry.value?.path === path);
      if (matching.length) for (const [id] of matching) this.state.favorites[id] = { value: null, clock, device };
      else this.state.favorites[`${device}-${clock}`] = { value: { path, added: clock }, clock, device };
    });
  }
  relocate(oldPath: string, newPath: string | null): Promise<void> {
    if (!validFolderPath(oldPath) || (newPath !== null && !validFolderPath(newPath))) return Promise.resolve();
    return this.mutate(() => {
      const clock = nextClock(this.state), device = this.storage.device;
      for (const [id, entry] of Object.entries(this.state.favorites)) {
        if (!entry.value || (entry.value.path !== oldPath && !entry.value.path.startsWith(oldPath + "/"))) continue;
        this.state.favorites[id] = { value: newPath === null ? null : { ...entry.value, path: moveFavoritePath(entry.value.path, oldPath, newPath) }, clock, device };
      }
    });
  }
  favorites(): string[] { return favoriteFolders(this.state); }
  settings(): Omit<VisualGallerySettings, "cardWidth"> { return sharedSettings(this.state); }
  private run(work: () => Promise<void>): Promise<void> {
    const task = this.queue.then(work);
    this.queue = task.catch(() => {});
    return task;
  }
  private mutate(change: () => void): Promise<void> {
    return this.run(async () => {
      await this.readPeers();
      const before = JSON.stringify(this.state);
      change();
      if (JSON.stringify(this.state) !== before) { this.storage.cache(this.state); this.dirty = true; await this.writeOwn(); }
      await this.notify();
    });
  }
  private async readPeers(): Promise<void> {
    const { files, directory } = this.storage;
    if (this.storage.readData) {
      const data = await this.storage.readData();
      const remote = parseSharedState(data && typeof data === "object" ? (data as Record<string, unknown>)._visualGallerySync : null);
      this.mirrored = sharedSignature(remote);
      this.state = mergeSharedStates(this.state, remote);
    }
    if (!await files.exists(directory)) return;
    const listing = await files.list(directory);
    const peers = await Promise.all(listing.files.filter(path => path.endsWith(".json")).map(async path => {
      // Partially transferred/malformed files are skipped until the next poll.
      // Read failures are not treated as deletions of existing registers.
      try { return parseSharedState(JSON.parse(await files.read(path))); } catch { return emptySharedState(); }
    }));
    this.state = mergeSharedStates(this.state, ...peers);
  }
  private async writeOwn(): Promise<void> {
    const { files, directory, device } = this.storage;
    if (!await files.exists(directory)) await files.mkdir(directory);
    await files.write(`${directory}/${device}.json`, JSON.stringify(this.state, null, 2));
    this.dirty = false;
  }
  private async notify(): Promise<void> {
    this.storage.cache(this.state);
    const projection = this.settings(), serialized = sharedSignature(this.state);
    // Browsing state is never written to data.json or the peer snapshots.
    if (serialized !== this.mirrored) { await this.storage.mirror({ ...projection, _visualGallerySync: this.state }); this.mirrored = serialized; }
    const effective = JSON.stringify(projection) + JSON.stringify(this.favorites());
    if (effective !== this.notified) { this.notified = effective; this.storage.changed(); }
  }
}
