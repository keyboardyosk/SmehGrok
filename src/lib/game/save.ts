import { SAVE_KEY, SAVE_VERSION } from "./content";
import type { World } from "./types";

export function saveWorld(world: World): void {
  try {
    const payload = JSON.stringify({ version: SAVE_VERSION, world });
    const prev = localStorage.getItem(SAVE_KEY);
    if (prev) localStorage.setItem(SAVE_KEY + ":bak", prev);
    localStorage.setItem(SAVE_KEY, payload);
  } catch {
    // private mode / quota — keep playing in memory
  }
}

export function loadWorld(): World | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number; world?: World };
    if (!parsed?.world) return null;
    if ((parsed.version ?? 1) !== SAVE_VERSION) return parsed.world;
    return parsed.world;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasSave(): boolean {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}
