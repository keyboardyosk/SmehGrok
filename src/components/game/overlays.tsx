import { FACTION_LABEL } from "@/lib/game/content";
import type { MethodDef, World } from "@/lib/game/types";
import { formatWorldTime } from "@/lib/game/time";
import { useGame } from "@/lib/game/store";
import { locationsInPhase } from "@/lib/game/engine";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, Panel } from "./ui";

export function Overlays({
  world,
  methods,
  inspect,
}: {
  world: World;
  methods: MethodDef[];
  inspect: { title: string; body: string } | null;
}) {
  const o = world.overlay;
  if (o.kind === "none") return null;
  if (o.kind === "inspect") return <InspectOverlay world={world} methods={methods} inspect={inspect} />;
  if (o.kind === "dialogue") return <DialogueOverlay world={world} />;
  if (o.kind === "trade") return <TradeOverlay world={world} />;
  if (o.kind === "combat") return <CombatOverlay world={world} />;
  if (o.kind === "exam") return <ExamOverlay world={world} />;
  if (o.kind === "loading") return <LoadingOverlay world={world} />;
  if (o.kind === "event") return <EventOverlay world={world} />;
  if (o.kind === "pda") return <PdaOverlay world={world} />;
  if (o.kind === "report") return null;
  return null;
}

function Frame({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-bg/55 p-3 sm:items-center">
      <Panel className="max-h-[88dvh] w-full max-w-lg overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl">{title}</h3>
          {onClose ? (
            <button type="button" onClick={onClose} className="min-h-11 min-w-11 text-muted" aria-label="Закрыть">
              <X className="mx-auto size-5" />
            </button>
          ) : null}
        </div>
        {children}
      </Panel>
    </div>
  );
}

function InspectOverlay({
  world,
  methods,
  inspect,
}: {
  world: World;
  methods: MethodDef[];
  inspect: { title: string; body: string } | null;
}) {
  const dispatch = useGame((s) => s.dispatch);
  const target = world.inspectId ?? "";
  return (
    <Frame title={inspect?.title ?? "Осмотр"} onClose={() => dispatch({ type: "CLOSE" })}>
      <p className="mt-2 text-sm leading-relaxed text-muted">{inspect?.body}</p>
      <p className="mt-4 font-mono text-[10px] tracking-widest text-subtle uppercase">Методы · 1–9</p>
      <div className="mt-2 flex flex-col gap-2">
        {methods.map((m, i) => (
          <Button
            key={m.id}
            variant={m.irreversible ? "danger" : i === 0 ? "primary" : "ghost"}
            className="w-full text-left"
            onClick={() => dispatch({ type: "METHOD", id: m.id, targetId: target })}
          >
            <span className="mr-2 font-mono text-xs opacity-70">{i + 1}</span>
            {m.label}
            {m.channel ? <span className="ml-2 text-xs opacity-70">{m.channel}</span> : null}
            {m.timeCost ? <span className="ml-auto text-xs opacity-70">{m.timeCost} мин</span> : null}
          </Button>
        ))}
      </div>
    </Frame>
  );
}

function DialogueOverlay({ world }: { world: World }) {
  const dispatch = useGame((s) => s.dispatch);
  const n = world.dialogueNpcId ? world.npcs[world.dialogueNpcId] : undefined;
  const last = world.log.find((l) => l.tone === "social");
  return (
    <Frame title={n?.name ?? "Разговор"} onClose={() => dispatch({ type: "CLOSE" })}>
      <p className="mt-1 text-xs text-muted">
        {n?.role} · {n?.contactStage} · отн. {n?.relation} · доверие {n?.trust}
        {n?.faction ? ` · ${FACTION_LABEL[n.faction] ?? n.faction}` : ""}
      </p>
      {n?.pendingQuestion ? <p className="mt-3 text-sm text-fg">{n.pendingQuestion}</p> : null}
      <p className="mt-3 text-sm leading-relaxed text-muted">{last?.text}</p>
      <div className="mt-4 flex flex-col gap-2">
        {world.dialogueOptions.map((opt, i) => (
          <Button
            key={opt.id}
            variant="ghost"
            disabled={opt.disabled}
            className="w-full text-left"
            onClick={() => dispatch({ type: "DIALOGUE", optionId: opt.id })}
          >
            <span className="mr-2 font-mono text-xs opacity-70">{i + 1}</span>
            {opt.label}
            {opt.reason ? <span className="mt-1 block text-xs text-muted">{opt.reason}</span> : null}
          </Button>
        ))}
      </div>
    </Frame>
  );
}

function TradeOverlay({ world }: { world: World }) {
  const dispatch = useGame((s) => s.dispatch);
  const t = world.trade;
  const [offer, setOffer] = useState(t?.lastCounter ?? 0);
  if (!t) return null;
  return (
    <Frame title={`Торг · ${t.itemName}`} onClose={() => dispatch({ type: "TRADE", kind: "leave" })}>
      <p className="mt-3 text-sm text-muted">{t.cause}</p>
      <p className="mt-2 font-mono text-sm">
        Спрос {t.ask}₡ · последний ответ {t.lastCounter}₡ · круг {t.rounds}/{t.maxRounds}
      </p>
      <p className="mt-1 text-xs text-subtle">Резерв скрыт. Не каждый NPC торгуется.</p>
      <label className="mt-4 block text-sm">
        Предложение
        <input
          type="number"
          value={offer}
          onChange={(e) => setOffer(Number(e.target.value))}
          className="mt-1 min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-fg"
        />
      </label>
      <div className="mt-4 flex flex-col gap-2">
        <Button onClick={() => dispatch({ type: "TRADE", kind: "offer", amount: offer })}>Предложить</Button>
        <Button variant="ghost" onClick={() => dispatch({ type: "TRADE", kind: "accept" })}>
          Принять {t.lastCounter}₡
        </Button>
        <Button variant="quiet" onClick={() => dispatch({ type: "TRADE", kind: "reject" })}>
          Отказать
        </Button>
      </div>
    </Frame>
  );
}

function CombatOverlay({ world }: { world: World }) {
  const dispatch = useGame((s) => s.dispatch);
  const c = world.combat;
  return (
    <Frame title={`Стычка · раунд ${c.round}`}>
      <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm text-muted">
        {c.log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {(
          [
            ["attack", "Ударить"],
            ["defend", "Держать"],
            ["threaten", "Угроза"],
            ["negotiate", "Говорить"],
            ["flee", "Уйти"],
          ] as const
        ).map(([m, label], i) => (
          <Button key={m} variant={m === "attack" ? "danger" : "ghost"} onClick={() => dispatch({ type: "COMBAT", move: m })}>
            {i + 1}. {label}
          </Button>
        ))}
      </div>
    </Frame>
  );
}

function ExamOverlay({ world }: { world: World }) {
  const dispatch = useGame((s) => s.dispatch);
  const e = world.exam;
  const demand = [1.2, 2.0, 1.5, 1.3];
  if (e.stage === 1) {
    return (
      <Frame title="Экзамен · 1. Симулятор" onClose={() => dispatch({ type: "CLOSE" })}>
        <p className="mt-2 text-sm text-muted">Нагрузка 6 т / 4 потребителя. Порог 0.75. Проверяется выбор ограничений, не одна цифра.</p>
        {e.alloc.map((v, i) => (
          <label key={i} className="mt-3 block text-sm">
            Потребитель {i + 1} (спрос {demand[i]} т)
            <input
              type="range"
              min={0}
              max={4}
              step={0.1}
              value={v}
              onChange={(ev) => {
                const next = [...e.alloc];
                next[i] = Number(ev.target.value);
                dispatch({ type: "EXAM_ALLOC", alloc: next });
              }}
              className="mt-1 w-full"
            />
            <span className="font-mono text-xs">{v.toFixed(1)} т</span>
          </label>
        ))}
        <p className="mt-2 font-mono text-xs text-muted">Сумма {e.alloc.reduce((s, x) => s + x, 0).toFixed(1)} / 6</p>
        <Button className="mt-4 w-full" onClick={() => dispatch({ type: "EXAM_NEXT" })}>
          Дальше
        </Button>
      </Frame>
    );
  }
  if (e.stage === 2) {
    return (
      <Frame title="Экзамен · 2. Сервиторы">
        <p className="mt-2 text-sm text-muted">3 × 2 т, два сервитора. Назначьте порядок. Порог 0.80.</p>
        {e.jobs.map((j, i) => (
          <label key={i} className="mt-3 flex min-h-11 items-center justify-between gap-3 text-sm">
            Партия {i + 1} (2 т)
            <select
              value={j}
              onChange={(ev) => {
                const next = [...e.jobs];
                next[i] = Number(ev.target.value);
                dispatch({ type: "EXAM_JOBS", jobs: next });
              }}
              className="min-h-11 rounded-sm border border-border bg-bg px-2"
            >
              <option value={0}>Сервитор А-12</option>
              <option value={1}>Сервитор Б-7</option>
            </select>
          </label>
        ))}
        <Button className="mt-4 w-full" onClick={() => dispatch({ type: "EXAM_NEXT" })}>
          К разговору
        </Button>
      </Frame>
    );
  }
  if (e.stage === 3) {
    const opts = [
      { id: "same", label: "Я бы сделал всё то же самое", mod: "+1" },
      { id: "limits", label: "Я бы сначала проверил ограничения", mod: "+2" },
      { id: "lost", label: "Я потерял время на приоритеты", mod: "+3" },
      { id: "bad", label: "Погрузка была организована плохо", mod: "−2" },
      { id: "think", label: "Я бы нанял сервитора, который умеет думать", mod: "0" },
    ];
    return (
      <Frame title="Экзамен · 3. Разговор">
        <p className="mt-2 text-sm text-muted">Экзаменатор не поднимает глаз. Ответ меняет состояние, не только кубик.</p>
        <div className="mt-3 flex flex-col gap-2">
          {opts.map((o) => (
            <Button key={o.id} variant="ghost" className="w-full text-left" onClick={() => dispatch({ type: "EXAM_TALK", choice: o.id })}>
              {o.label} <span className="text-xs text-muted">{o.mod}</span>
            </Button>
          ))}
        </div>
      </Frame>
    );
  }
  return (
    <Frame title="Экзамен завершён" onClose={() => dispatch({ type: "CLOSE" })}>
      <p className="mt-3 text-sm">{e.passed ? "Допуск получен." : "Провал. Пересдача возможна. Состояние уже изменено."}</p>
      <Button className="mt-4 w-full" onClick={() => dispatch({ type: "CLOSE" })}>
        Выйти
      </Button>
    </Frame>
  );
}

function LoadingOverlay({ world }: { world: World }) {
  const dispatch = useGame((s) => s.dispatch);
  const main = world.cargo.find((c) => c.kind === "main");
  const side = world.cargo.find((c) => c.kind === "side");
  const inc = world.loading.incident;
  return (
    <Frame title="Погрузка" onClose={() => dispatch({ type: "CLOSE" })}>
      <p className="mt-2 text-sm text-muted">Тик 10 минут. Можно уйти — процесс продолжится. Игнорирование тоже причина.</p>
      <Bar label={`Основной · ${main?.tons} т`} value={main?.progress ?? 0} />
      <Bar label="Хлам" value={side?.progress ?? 0} />
      {inc && !inc.resolved ? (
        <div className="mt-4">
          <h4 className="font-display text-lg">{inc.title}</h4>
          <p className="mt-1 text-sm text-muted">{inc.text}</p>
          <div className="mt-3 flex flex-col gap-2">
            {inc.options.map((o) => (
              <Button key={o.id} variant="ghost" onClick={() => dispatch({ type: "LOADING_RESOLVE", optionId: o.id })}>
                {o.label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <Button onClick={() => dispatch({ type: "WAIT", minutes: 10 })}>Промотать 10 мин</Button>
          <Button variant="ghost" onClick={() => dispatch({ type: "LOADING_START" })}>
            Назначить приоритет / продолжить
          </Button>
        </div>
      )}
    </Frame>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="font-mono">{Math.round(value)}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-sm bg-bg-subtle">
        <div className="h-full bg-accent" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function EventOverlay({ world }: { world: World }) {
  const dispatch = useGame((s) => s.dispatch);
  const ev = world.pendingEvent;
  if (!ev) return null;
  return (
    <Frame title={ev.title}>
      <p className="mt-3 text-sm leading-relaxed text-muted">{ev.text}</p>
      <div className="mt-4 flex flex-col gap-2">
        {ev.options.map((o) => (
          <Button key={o.id} onClick={() => dispatch({ type: "EVENT", optionId: o.id })}>
            {o.label}
          </Button>
        ))}
      </div>
    </Frame>
  );
}

const PDA_TABS = [
  { id: "map", label: "Карта", key: "M" },
  { id: "people", label: "Люди", key: "P" },
  { id: "tasks", label: "Задачи", key: "T" },
  { id: "economy", label: "Экономика", key: "E" },
  { id: "factions", label: "Фракции", key: "F" },
  { id: "chronicle", label: "Хроника", key: "R" },
  { id: "inventory", label: "Инвентарь", key: "I" },
] as const;

function PdaOverlay({ world }: { world: World }) {
  const dispatch = useGame((s) => s.dispatch);
  const tab = world.pdaTab;
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div>
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted uppercase">КПК · не хранит отдельную правду</p>
          <h3 className="font-display text-xl">Запрос к WORLD_STATE</h3>
        </div>
        <button type="button" className="min-h-11 px-3" onClick={() => dispatch({ type: "CLOSE" })}>
          Esc
        </button>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
        {PDA_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dispatch({ type: "PDA", tab: t.id })}
            className={`min-h-11 rounded-sm px-3 text-sm ${tab === t.id ? "bg-accent text-accent-fg" : "text-muted"}`}
          >
            {t.key} · {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 text-sm leading-relaxed">
        {tab === "map" ? <MapTab world={world} /> : null}
        {tab === "people" ? <PeopleTab world={world} /> : null}
        {tab === "tasks" ? <TasksTab world={world} /> : null}
        {tab === "economy" ? <EconTab world={world} /> : null}
        {tab === "factions" ? <FactTab world={world} /> : null}
        {tab === "chronicle" ? <ChronTab world={world} /> : null}
        {tab === "inventory" ? <InvTab world={world} /> : null}
      </div>
    </div>
  );
}

function MapTab({ world }: { world: World }) {
  const dispatch = useGame((s) => s.dispatch);
  const locs = locationsInPhase(world);
  return (
    <div>
      <p className="text-muted">Фаза: {world.phase}. Физическое присутствие — не схема.</p>
      <ul className="mt-3 space-y-2">
        {locs.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              className="w-full rounded-md border border-border px-3 py-2 text-left"
              onClick={() => dispatch({ type: "MOVE", locationId: l.id })}
            >
              <span className="font-medium">{l.name}</span>
              {l.id === world.playerLocationId ? <span className="ml-2 text-xs text-muted">вы здесь</span> : null}
              <span className="block text-xs text-subtle">{l.short}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PeopleTab({ world }: { world: World }) {
  const list = Object.values(world.npcs).filter((n) => n.area === world.phase);
  return (
    <ul className="space-y-2">
      {list.map((n) => (
        <li key={n.id} className="border-b border-border py-2">
          <div className="font-medium">
            {n.name} {!n.alive ? "· мёртв" : n.sleeping ? "· спит" : ""}
          </div>
          <div className="text-xs text-muted">
            {n.role} · {n.contactStage} · отн {n.relation} · HP {n.hp}
            {n.isSocialGuide ? " · SOCIAL_GUIDE" : ""}
            {n.isCompanion ? ` · ${n.companionMode}` : ""}
          </div>
          <div className="text-xs text-subtle">{n.moodLine}</div>
        </li>
      ))}
    </ul>
  );
}

function TasksTab({ world }: { world: World }) {
  const a = world.assignment;
  const main = world.cargo.find((c) => c.kind === "main");
  const side = world.cargo.find((c) => c.kind === "side");
  return (
    <div className="space-y-3">
      <p>
        Доставить {a.quantity} т {a.resource} на {a.station}. Дедлайн {formatWorldTime(a.stationDeadline)}.
      </p>
      <p>Экзамен: {world.exam.passed ? "сдан" : world.exam.attempts ? "провален, состояние изменено" : "не сдан"}.</p>
      <p>
        Основной груз: {main?.received ? "принят" : main?.loaded ? "погружен, не принят" : `${Math.round(main?.progress ?? 0)}%`}.
      </p>
      <p>Хлам: {side?.received ? "обработан" : side?.loaded ? "погружен" : side?.locationId}.</p>
      <p className="text-muted">Приказ ≠ результат. Квота не закрыта, пока нет физической приёмки.</p>
    </div>
  );
}

function EconTab({ world }: { world: World }) {
  return (
    <div className="space-y-2">
      <p>Деньги: {world.player.money}₡</p>
      {world.cargo.map((c) => (
        <p key={c.id}>
          {c.name}: {c.tons} т · {c.locationId} · {c.received ? "принят" : c.loaded ? "погружен" : "не погружен"}
        </p>
      ))}
      <p className="text-muted">Контракт и физическая передача — разные состояния. NET = GROSS − LOSS.</p>
      {world.lossOfNormalAuthority ? (
        <p className="text-danger">LOSS_OF_NORMAL_AUTHORITY. Это не кнопка пиратства, а накопленное состояние.</p>
      ) : null}
    </div>
  );
}

function FactTab({ world }: { world: World }) {
  void world;
  return (
    <ul className="space-y-2 text-muted">
      {Object.entries(FACTION_LABEL).map(([k, v]) => (
        <li key={k}>
          <span className="text-fg">{v}</span> — действует через людей и claims, не через иконку.
        </li>
      ))}
    </ul>
  );
}

function ChronTab({ world }: { world: World }) {
  return (
    <ul className="space-y-3">
      {world.history.length === 0 ? <li className="text-muted">Хроника пуста. Это тоже состояние.</li> : null}
      {[...world.history].reverse().map((h) => (
        <li key={h.id}>
          <div className="text-xs text-subtle">
            {formatWorldTime(h.time)} · {h.severity} · spread {h.spread}
          </div>
          <div>{h.text}</div>
          <div className="text-xs text-muted">{h.causeTrace}</div>
        </li>
      ))}
      <li className="pt-4 text-xs text-subtle">Знания игрока — не SOCIAL stat.</li>
      {world.knowledge.map((k) => (
        <li key={k.id} className="text-sm">
          <span className="text-muted">{k.kind} · {k.epistemicState} · {k.confidence.toFixed(2)}</span>
          <div>{k.proposition}</div>
        </li>
      ))}
    </ul>
  );
}

function InvTab({ world }: { world: World }) {
  return (
    <ul className="space-y-2">
      {world.playerInventory.map((id) => {
        const it = world.items[id];
        return (
          <li key={id} className="border-b border-border py-2">
            <div className="font-medium">{it?.name ?? id}</div>
            <div className="text-xs text-muted">
              {it?.type} · {it?.notes}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
