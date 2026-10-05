import { BACKGROUNDS } from "@/lib/game/content";
import { formatWorldTime, etaLabel, deadlineLabel, slackLabel } from "@/lib/game/time";
import type { BackgroundId, World } from "@/lib/game/types";
import { Button, Panel } from "./ui";

export function TitleScreen({
  saved,
  onNew,
  onContinue,
}: {
  saved: boolean;
  onNew: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col justify-end overflow-hidden">
      <img
        src="/scenes/title-void.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        crossOrigin="anonymous"
      />
      <div className="scene-vignette absolute inset-0" />
      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pb-16 pt-24">
        <p className="font-mono text-[11px] tracking-[0.28em] text-muted uppercase">LVE_6 · v2.7 · Living Social Sandbox</p>
        <h1 className="font-display text-4xl leading-tight text-fg sm:text-5xl">Смех в пустоте</h1>
        <p className="max-w-md text-base leading-relaxed text-muted">
          Вам дали участок Империума. Сделать так, чтобы он продолжал работать — ваша проблема. Мир живёт без вас.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={onNew} className="sm:min-w-44">
            Новая игра
          </Button>
          {saved ? (
            <Button variant="ghost" onClick={onContinue} className="sm:min-w-44">
              Продолжить
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function BackgroundSelect({ onPick }: { onPick: (id: BackgroundId) => void }) {
  return (
    <div className="min-h-dvh bg-bg px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-[11px] tracking-[0.24em] text-muted uppercase">Предыстория</p>
        <h2 className="mt-2 font-display text-3xl">Кто вы, пока планета уже существует</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Планету и станцию вы не выбираете. Предыстория меняет каналы: связи, ордер, деньги, инструмент, местное знание — или их отсутствие.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onPick(b.id)}
              className="rounded-lg border border-border bg-bg-elevated p-4 text-left transition-colors duration-150 hover:border-border-strong"
            >
              <h3 className="font-display text-xl">{b.title}</h3>
              <p className="mt-2 text-sm text-fg">{b.social}</p>
              <p className="mt-1 text-sm text-muted">Цена: {b.cost}</p>
              <p className="mt-1 text-sm text-muted">Край: {b.edge}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AssignmentScreen({ world, onBegin }: { world: World; onBegin: () => void }) {
  const a = world.assignment;
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <img src="/scenes/title-void.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" crossOrigin="anonymous" />
      <div className="absolute inset-0 bg-bg/70" />
      <Panel className="relative z-10 w-full max-w-lg p-6 sm:p-8">
        <p className="font-mono text-[11px] tracking-[0.24em] text-muted uppercase">Входящее · КПК</p>
        <h2 className="mt-2 font-display text-2xl">Назначение</h2>
        <dl className="mt-5 space-y-2 text-sm">
          <Row k="Система" v={a.system} />
          <Row k="Планета" v={a.planet} />
          <Row k="Станция" v={a.station} />
          <Row k="Груз" v={`${a.quantity} т · ${a.resource}`} />
          <Row k="Причина" v={a.reason} />
          <Row k="Сейчас" v={formatWorldTime(world.worldTime)} />
          <Row k="ETA" v={etaLabel(world.worldTime, a.planetEta)} />
          <Row k="Дедлайн станции" v={deadlineLabel(a.stationDeadline)} />
          <Row k="Запас" v={slackLabel(world.worldTime, a.stationDeadline)} />
          <Row k="Seed" v={world.masterSeed} />
        </dl>
        <p className="mt-5 text-sm text-muted">ETA и deadline — разные сущности. Прибытие не равно сдаче.</p>
        <Button className="mt-6 w-full" onClick={onBegin}>
          Принять и войти в шлюз
        </Button>
      </Panel>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1.5">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

export function ReportScreen({ world, onNew }: { world: World; onNew: () => void }) {
  const r = world.report;
  return (
    <div className="min-h-dvh bg-bg px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-[11px] tracking-[0.24em] text-muted uppercase">Финальный отчёт</p>
        <h2 className="mt-2 font-display text-3xl">
          {r?.ending === "escape" ? "Другое состояние мира" : "Пролог закрыт физически"}
        </h2>
        <p className="mt-3 text-sm text-muted">
          Не только цифры. Люди, решения, причинные следы, автономные события. New Game не перенесёт эти ID.
        </p>
        <Section title="Следы" items={r?.scenes ?? ["Нет записанных сцен."]} />
        <Section title="Люди" items={r?.people ?? []} />
        <Section title="Знания" items={r?.traces ?? []} />
        <Section title="Мир без вас" items={r?.autonomous ?? []} />
        <Button className="mt-8" onClick={onNew}>
          Новая игра · новый MASTER_SEED
        </Button>
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-8">
      <h3 className="font-display text-lg">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted">
        {items.length ? items.map((it, i) => <li key={i}>{it}</li>) : <li>Пусто.</li>}
      </ul>
    </div>
  );
}
