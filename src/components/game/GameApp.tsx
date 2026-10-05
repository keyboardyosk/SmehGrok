import { useEffect } from "react";
import { methodsFor } from "@/lib/game/engine";
import { hasSave } from "@/lib/game/save";
import { useGame } from "@/lib/game/store";
import type { PdaTab } from "@/lib/game/types";
import { AssignmentScreen, BackgroundSelect, ReportScreen, TitleScreen } from "./screens";
import { PlayView } from "./PlayView";

const PDA_KEY: Record<string, PdaTab> = {
  KeyM: "map",
  KeyP: "people",
  KeyT: "tasks",
  KeyE: "economy",
  KeyF: "factions",
  KeyR: "chronicle",
  KeyI: "inventory",
};

export function GameApp() {
  const world = useGame((s) => s.world);
  const saved = useGame((s) => s.saved);
  const newGame = useGame((s) => s.newGame);
  const continueGame = useGame((s) => s.continueGame);
  const dispatch = useGame((s) => s.dispatch);
  const selectBackground = useGame((s) => s.selectBackground);
  const persist = useGame((s) => s.persist);

  useEffect(() => {
    if (hasSave()) useGame.setState({ saved: true });
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") persist();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", persist);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", persist);
    };
  }, [persist]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (world.screen !== "play") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Tab") {
        e.preventDefault();
        dispatch({ type: "PDA" });
        return;
      }
      if (e.key === "Escape") {
        dispatch({ type: "CLOSE" });
        return;
      }
      if (PDA_KEY[e.code]) {
        dispatch({ type: "PDA", tab: PDA_KEY[e.code] });
        return;
      }
      const num = e.key >= "1" && e.key <= "9" ? Number(e.key) - 1 : -1;
      if (num < 0) return;
      if (world.overlay.kind === "inspect" && world.inspectId) {
        const m = methodsFor(world, world.inspectId)[num];
        if (m) dispatch({ type: "METHOD", id: m.id, targetId: world.inspectId });
      } else if (world.overlay.kind === "dialogue") {
        const opt = world.dialogueOptions[num];
        if (opt && !opt.disabled) dispatch({ type: "DIALOGUE", optionId: opt.id });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, world]);

  if (world.masterSeed === "BOOT-0000" || world.screen === "title") {
    return <TitleScreen saved={saved} onNew={newGame} onContinue={continueGame} />;
  }
  if (world.screen === "background" || !world.background) {
    return <BackgroundSelect onPick={selectBackground} />;
  }
  if (world.screen === "assignment") {
    return <AssignmentScreen world={world} onBegin={() => dispatch({ type: "BEGIN" })} />;
  }
  if (world.screen === "report") {
    return <ReportScreen world={world} onNew={newGame} />;
  }
  return <PlayView world={world} />;
}
