import { methodsFor, neighborsOf, inspectLabel } from "@/lib/game/engine";
import { formatDuration, formatWorldTime, etaLabel, deadlineLabel } from "@/lib/game/time";
import type { Npc, World } from "@/lib/game/types";
import { useGame } from "@/lib/game/store";
import {
  Backpack,
  BookOpen,
  Clock,
  Heart,
  Map as MapIcon,
  Radio,
  Users,
} from "lucide-react";
import { Button, Chip } from "./ui";
import { Overlays } from "./overlays";

function presentableNpcs(w: World): Npc[] {
  return Object.values(w.npcs).filter(
    (n) => n.alive && n.area === w.phase && n.locationId === w.playerLocationId,
  );
}

export function PlayView({ world }: { world: World }) {
  const dispatch = useGame((s) => s.dispatch);
  const loc = world.locations[world.playerLocationId];
  const npcs = presentableNpcs(world);
  const exits = neighborsOf(world);
  const eta =
    world.phase === "small_ship"
      ? etaLabel(world.worldTime, world.assignment.planetEta)
      : world.phase === "large_ship"
        ? etaLabel(world.worldTime, world.ships.large.eta)
        : deadlineLabel(world.assignment.stationDeadline);

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg">
      <header className="z-20 flex flex-wrap items-center gap-2 border-b border-border bg-bg/90 px-3 py-2 backdrop-blur-sm">
        <span className="font-display text-sm">{loc?.name ?? "—"}</span>
        <Chip>{formatWorldTime(world.worldTime)}</Chip>
        <Chip>{eta}</Chip>
        <Chip tone={world.player.hp < 40 ? "danger" : "muted"}>
          <Heart className="mr-1 inline size-3" />
          <span className="hud-num">{world.player.hp}</span>
        </Chip>
        <Chip tone={world.player.fatigue > 70 ? "warn" : "muted"}>
          Уст. {world.player.fatigue}
        </Chip>
        <Chip>{world.player.money}₡</Chip>
        <Chip tone={world.alert === "LOW" ? "muted" : "danger"}>{world.alert}</Chip>
        <Chip>доступ {world.player.access}</Chip>
        <button
          type="button"
          className="ml-auto min-h-11 rounded-sm border border-border px-3 text-xs uppercase tracking-wider"
          onClick={() => dispatch({ type: "PDA" })}
        >
          КПК · Tab
        </button>
      </header>

      <div className="relative min-h-[42vh] flex-1">
        {loc?.scene ? (
          <img src={loc.scene} alt="" className="absolute inset-0 h-full w-full object-cover" crossOrigin="anonymous" />
        ) : (
          <div className="absolute inset-0 bg-bg-subtle" />
        )}
        <div className="scene-vignette absolute inset-0" />
        <div className="relative z-10 flex h-full flex-col justify-end px-4 pb-4 pt-8">
          <p className="max-w-2xl text-sm leading-relaxed text-fg/90 sm:text-base">{loc?.detail}</p>
        </div>
      </div>

      <section className="border-t border-border bg-bg-elevated px-3 py-3">
        <p className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">Люди здесь · осмотр не есть действие</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {npcs.length === 0 ? (
            <p className="text-sm text-muted">Никого. Мир всё равно идёт.</p>
          ) : (
            npcs.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => dispatch({ type: "INSPECT", targetId: n.id })}
                className="min-w-[9.5rem] rounded-md border border-border bg-bg px-3 py-2 text-left"
              >
                <div className="font-medium">{n.name}</div>
                <div className="text-xs text-muted">{n.role}</div>
                <div className="mt-1 line-clamp-2 text-xs text-subtle">{n.sleeping ? "спит" : n.moodLine}</div>
              </button>
            ))
          )}
        </div>

        <p className="mt-3 font-mono text-[10px] tracking-[0.2em] text-muted uppercase">Объекты</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(loc?.objects ?? []).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => dispatch({ type: "INSPECT", targetId: o.id })}
              className="min-h-11 rounded-sm border border-border bg-bg px-3 text-sm"
            >
              {o.name}
            </button>
          ))}
        </div>

        <p className="mt-3 font-mono text-[10px] tracking-[0.2em] text-muted uppercase">Выходы</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {exits.map((e) => (
            <Button key={e.id} variant="ghost" onClick={() => dispatch({ type: "MOVE", locationId: e.id })}>
              {e.name}
            </Button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="quiet" onClick={() => dispatch({ type: "WAIT", minutes: 30 })}>
            <Clock className="mr-1 inline size-3.5" />
            Ждать 30 мин
          </Button>
          <Button variant="quiet" onClick={() => dispatch({ type: "WAIT", minutes: 60 })}>
            Ждать 1 ч
          </Button>
          {world.phase === "small_ship" ? (
            <Button variant="quiet" onClick={() => dispatch({ type: "SLEEP", until: "arrival" })}>
              Спать до прибытия
            </Button>
          ) : null}
        </div>

        <Companions world={world} />
        <LogStrip world={world} />
      </section>

      <Overlays world={world} methods={world.inspectId ? methodsFor(world, world.inspectId) : []} inspect={world.inspectId ? inspectLabel(world, world.inspectId) : null} />
    </div>
  );
}

function Companions({ world }: { world: World }) {
  const dispatch = useGame((s) => s.dispatch);
  const comps = Object.values(world.npcs).filter((n) => n.isCompanion && n.alive);
  if (!comps.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {comps.map((n) => (
        <div key={n.id} className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-bg px-2 text-xs">
          <Users className="size-3.5 text-muted" />
          <span>{n.name}</span>
          <span className="text-muted">{n.companionMode}</span>
          <button type="button" className="underline" onClick={() => dispatch({ type: "COMPANION_MODE", npcId: n.id, mode: "JOIN_ACTIVE" })}>
            вместе
          </button>
          <button type="button" className="underline" onClick={() => dispatch({ type: "COMPANION_MODE", npcId: n.id, mode: "STAY_NEAR" })}>
            рядом
          </button>
        </div>
      ))}
    </div>
  );
}

function LogStrip({ world }: { world: World }) {
  const last = world.log[0];
  if (!last) return null;
  return (
    <p className="mt-3 line-clamp-2 text-xs text-muted">
      <Radio className="mr-1 inline size-3" />
      {formatDuration(Math.max(0, world.worldTime - last.time))} назад · {last.text}
    </p>
  );
}

export function PdaHint() {
  return (
    <div className="flex gap-2 text-muted">
      <MapIcon className="size-4" />
      <BookOpen className="size-4" />
      <Backpack className="size-4" />
    </div>
  );
}
