import { GALLERY_FILTERS } from "../browser/VaultBrowser";
import { DEFAULT_SETTINGS, loadGallerySettings, type VisualGallerySettings } from "../SettingsModel";

export type SharedKey = Exclude<keyof VisualGallerySettings, "cardWidth">;
export const SHARED_KEYS = (Object.keys(DEFAULT_SETTINGS) as (keyof VisualGallerySettings)[]).filter((key): key is SharedKey => key !== "cardWidth");
export interface Register<T> { value: T; clock: number; device: string }
export interface Favorite { path: string; added: number }
export interface SharedState {
  version: 1;
  settings: Partial<Record<SharedKey, Register<string | number | boolean>>>;
  favorites: Record<string, Register<Favorite | null>>;
}
export const emptySharedState = (): SharedState => ({ version: 1, settings: {}, favorites: {} });
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function validFolderPath(path: unknown): path is string {
  return typeof path === "string" && path.length > 0 && !path.startsWith("/") && !path.includes("\\") && !path.split("/").some(part => !part || part === "." || part === "..");
}
function validRegister(value: unknown): value is Register<unknown> {
  return object(value) && Number.isSafeInteger(value.clock) && (value.clock as number) >= 0 && typeof value.device === "string" && /^[a-zA-Z0-9-]+$/.test(value.device);
}
/** Read only the known schema; a partial/corrupt sync file cannot reset peers. */
export function parseSharedState(input: unknown): SharedState {
  const state = emptySharedState();
  if (!object(input) || input.version !== 1) return state;
  if (object(input.settings)) for (const key of SHARED_KEYS) {
    const entry = input.settings[key];
    if (!validRegister(entry) || typeof entry.value !== typeof DEFAULT_SETTINGS[key]) continue;
    if (typeof entry.value === "number" && !Number.isFinite(entry.value)) continue;
    if (key === "defaultFilter" && !GALLERY_FILTERS.includes(entry.value as never)) continue;
    // Enum/icon validation uses the same catalog as settings migration.
    const loaded = loadGallerySettings({ appearanceDefaultsVersion: 1, [key]: entry.value });
    if (loaded[key] !== entry.value) continue;
    state.settings[key] = { ...entry } as Register<string | number | boolean>;
  }
  if (object(input.favorites)) for (const [id, entry] of Object.entries(input.favorites)) {
    if (!/^[a-zA-Z0-9-]+$/.test(id) || !validRegister(entry)) continue;
    const value = entry.value;
    if (value !== null && (!object(value) || !validFolderPath(value.path) || !Number.isSafeInteger(value.added) || (value.added as number) < 0)) continue;
    state.favorites[id] = { ...entry, value: value === null ? null : { path: value.path as string, added: value.added as number } };
  }
  return state;
}
function newer<T>(left: Register<T> | undefined, right: Register<T>): Register<T> {
  return !left || right.clock > left.clock || (right.clock === left.clock && right.device > left.device) ? right : left;
}
/** Commutative, associative and idempotent field registers, including removals. */
export function mergeSharedStates(...states: SharedState[]): SharedState {
  const result = emptySharedState();
  for (const state of states) {
    for (const key of SHARED_KEYS) {
      const entry = state.settings[key];
      if (entry) result.settings[key] = newer(result.settings[key], entry);
    }
    for (const [id, entry] of Object.entries(state.favorites)) result.favorites[id] = newer(Object.prototype.hasOwnProperty.call(result.favorites, id) ? result.favorites[id] : undefined, entry);
  }
  return result;
}
export function seedSharedSettings(saved: Partial<VisualGallerySettings>, device = "legacy"): SharedState {
  const state = emptySharedState(), settings = loadGallerySettings(saved);
  for (const key of SHARED_KEYS) state.settings[key] = { value: settings[key], clock: 0, device };
  return state;
}
export function sharedSettings(state: SharedState): Omit<VisualGallerySettings, "cardWidth"> {
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of SHARED_KEYS) if (state.settings[key]) Object.assign(settings, { [key]: state.settings[key].value });
  const { cardWidth: _local, ...shared } = loadGallerySettings(settings);
  return shared;
}
export function favoriteFolders(state: SharedState): string[] {
  const entries = Object.entries(state.favorites).filter((entry): entry is [string, Register<Favorite>] => entry[1].value !== null)
    .sort(([a, x], [b, y]) => x.value.added - y.value.added || a.localeCompare(b));
  return [...new Set(entries.map(([, entry]) => entry.value.path))];
}
export function nextClock(state: SharedState, now = Date.now()): number {
  return Math.max(now, ...Object.values(state.settings).map(entry => entry.clock + 1), ...Object.values(state.favorites).map(entry => entry.clock + 1));
}
export function moveFavoritePath(path: string, oldPath: string, newPath: string): string {
  return path === oldPath || path.startsWith(oldPath + "/") ? newPath + path.slice(oldPath.length) : path;
}

/** Stable ordering prevents two devices from endlessly echoing equal unions. */
export function sharedSignature(state: SharedState): string {
  return JSON.stringify({ version: 1,
    settings: SHARED_KEYS.filter(key => state.settings[key]).map(key => [key, state.settings[key]!.clock, state.settings[key]!.device, state.settings[key]!.value]),
    favorites: Object.keys(state.favorites).sort().map(id => { const entry = state.favorites[id]!; return [id, entry.clock, entry.device, entry.value?.path ?? null, entry.value?.added ?? null]; }),
  });
}
