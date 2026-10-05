import { create } from "zustand";
import { type GameAction, reduce } from "./engine";
import { createWorld, freshSeed } from "./generate";
import { clearSave, loadWorld, saveWorld } from "./save";
import type { BackgroundId, PdaTab, World } from "./types";

type GameStore = {
  world: World;
  saved: boolean;
  newGame: () => void;
  continueGame: () => void;
  dispatch: (action: GameAction) => void;
  selectBackground: (id: BackgroundId) => void;
  openPda: (tab?: PdaTab) => void;
  persist: () => void;
};

function persist(world: World) {
  if (world.screen === "play" || world.screen === "report") saveWorld(world);
}

export const useGame = create<GameStore>((set, get) => ({
  world: createWorld("BOOT-0000", null),
  saved: false,
  newGame: () => {
    clearSave();
    set({ world: createWorld(freshSeed(), null), saved: false });
  },
  continueGame: () => {
    const loaded = loadWorld();
    if (loaded) set({ world: loaded, saved: true });
  },
  dispatch: (action) => {
    const next = reduce(get().world, action);
    set({ world: next });
    persist(next);
  },
  selectBackground: (id) => {
    const next = reduce(get().world, { type: "SELECT_BACKGROUND", id });
    set({ world: next });
  },
  openPda: (tab) => get().dispatch({ type: "PDA", tab }),
  persist: () => persist(get().world),
}));

export function useWorld(): World {
  return useGame((s) => s.world);
}
