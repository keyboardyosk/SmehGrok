import { createWorld } from "./generate";
import { BACKGROUNDS, SLEEP_EVENTS, TOPIC_LABELS } from "./content";
import { mulberry32 } from "./rng";
import { minutesOfDay } from "./time";
import type {
  AlertLevel,
  AuthorityChannel,
  BackgroundId,
  CombatProfile,
  ContactStage,
  DialogueOption,
  HistoryEvent,
  KnowledgeEntry,
  LoadingIncident,
  MethodDef,
  Npc,
  Pathology,
  ReportData,
  World,
} from "./types";

export type GameAction =
  | { type: "SELECT_BACKGROUND"; id: BackgroundId }
  | { type: "BEGIN" }
  | { type: "MOVE"; locationId: string }
  | { type: "INSPECT"; targetId: string }
  | { type: "CLOSE" }
  | { type: "PDA"; tab?: World["pdaTab"] }
  | { type: "METHOD"; id: string; targetId: string }
  | { type: "DIALOGUE"; optionId: string }
  | { type: "TRADE"; kind: "offer" | "accept" | "reject" | "leave"; amount?: number }
  | { type: "COMBAT"; move: string; targetId?: string }
  | { type: "COMPANION_MODE"; npcId: string; mode: Npc["companionMode"] }
  | { type: "WAIT"; minutes: number }
  | { type: "SLEEP"; until: "rest" | "arrival" }
  | { type: "EVENT"; optionId: string }
  | { type: "EXAM_ALLOC"; alloc: number[] }
  | { type: "EXAM_JOBS"; jobs: number[] }
  | { type: "EXAM_NEXT" }
  | { type: "EXAM_TALK"; choice: string }
  | { type: "LOADING_START" }
  | { type: "LOADING_RESOLVE"; optionId: string }
  | { type: "MEDICAL"; act: "scan" | "treat" | "firstaid" | "pay"; patientId: string }
  | { type: "FINISH" };

function rng(w: World): number {
  const next = mulberry32(w.rngState)();
  w.rngState = (Math.imul(w.rngState, 1664525) + 1013904223) >>> 0;
  return next;
}

function d20(w: World): number {
  let roll = 1 + Math.floor(rng(w) * 20);
  if (w.player.fatigue > 95 && rng(w) < 0.15) {
    log(w, "Головокружение. Тело напоминает о долге сна.", "alert");
  }
  if (w.player.fatigue > 80) roll -= 2;
  else if (w.player.fatigue > 60) roll -= 1;
  return Math.max(1, Math.min(20, roll));
}

function uid(w: World, p: string): string {
  return `${p}-${w.worldTime}-${Math.floor(rng(w) * 9999)}`;
}

export function log(w: World, text: string, tone: World["log"][0]["tone"] = "obs"): void {
  w.log.unshift({ id: uid(w, "l"), time: w.worldTime, text, tone });
  if (w.log.length > 80) w.log.length = 80;
}

function addKnowledge(
  w: World,
  partial: Partial<KnowledgeEntry> & Pick<KnowledgeEntry, "subjectId" | "proposition" | "kind">,
): void {
  const dup = w.knowledge.find((k) => k.proposition === partial.proposition && k.subjectId === partial.subjectId);
  if (dup) {
    dup.confidence = Math.min(1, dup.confidence + 0.1);
    dup.lastVerifiedAt = w.worldTime;
    if (partial.epistemicState === "CONFIRMED") dup.epistemicState = "CONFIRMED";
    return;
  }
  const entry: KnowledgeEntry = {
    id: uid(w, "k"),
    ownerId: "player",
    subjectId: partial.subjectId,
    proposition: partial.proposition,
    value: partial.value ?? "",
    kind: partial.kind,
    sourceType: partial.sourceType ?? "SELF",
    sourceId: partial.sourceId ?? "player",
    observedAt: partial.observedAt ?? w.worldTime,
    confidence: partial.confidence ?? 0.6,
    epistemicState: partial.epistemicState ?? "OBSERVED",
    scope: partial.scope ?? w.playerLocationId,
    derivedFrom: partial.derivedFrom ?? [],
    contradicts: partial.contradicts ?? [],
    invalidatedBy: partial.invalidatedBy ?? [],
    lastVerifiedAt: w.worldTime,
    visibility: partial.visibility ?? "PLAYER_ONLY",
    notes: partial.notes ?? "",
  };
  w.knowledge.push(entry);
}

function addHistory(
  w: World,
  partial: Pick<HistoryEvent, "actorId" | "action" | "targetId" | "severity" | "text" | "causeTrace">,
): void {
  const loc = w.playerLocationId;
  const witnesses = Object.values(w.npcs)
    .filter((n) => n.alive && n.conscious && !n.sleeping && n.locationId === loc && n.area === w.phase)
    .map((n) => n.id);
  w.history.push({
    id: uid(w, "h"),
    time: w.worldTime,
    locationId: loc,
    spread: 0,
    appliedCallbacks: [],
    witnesses,
    ...partial,
  });
}

function presentNpcs(w: World): Npc[] {
  return Object.values(w.npcs).filter(
    (n) => n.alive && n.area === w.phase && n.locationId === w.playerLocationId,
  );
}

function npcById(w: World, id: string): Npc | undefined {
  return w.npcs[id];
}

function scheduleLocation(n: Npc, t: number): string {
  if (!n.schedule.length) return n.homeLocationId;
  const m = minutesOfDay(t);
  for (const b of n.schedule) {
    if (b.start <= b.end) {
      if (m >= b.start && m < b.end) return b.locationId;
    } else if (m >= b.start || m < b.end) return b.locationId;
  }
  return n.schedule[0]!.locationId;
}

function followCompanions(w: World): void {
  for (const n of Object.values(w.npcs)) {
    if (!n.isCompanion || !n.alive) continue;
    if (n.companionMode === "JOIN_ACTIVE" || n.companionMode === "STAY_NEAR") {
      if (n.area === w.phase) n.locationId = w.playerLocationId;
    }
  }
}

function raiseAlert(w: World, level: AlertLevel): void {
  const order: AlertLevel[] = ["LOW", "SUSPICION", "ALERT", "ORGANIZED"];
  if (order.indexOf(level) > order.indexOf(w.alert)) {
    w.alert = level;
    log(w, `Тревога: ${level}.`, "alert");
  }
}

function bumpRelation(n: Npc, d: number): void {
  n.relation = Math.max(-10, Math.min(10, n.relation + d));
}

function bumpTrust(n: Npc, d: number): void {
  n.trust = Math.max(0, Math.min(100, n.trust + d));
}

function stageUp(n: Npc): void {
  const order: ContactStage[] = ["STRANGER", "GREETED", "ACQUAINTED", "TRUSTED"];
  const i = order.indexOf(n.contactStage);
  if (i < order.length - 1) n.contactStage = order[i + 1]!;
}

export function canEnter(w: World, locId: string): { ok: boolean; reason?: string } {
  const loc = w.locations[locId];
  if (!loc) return { ok: false, reason: "Нет такой локации." };
  if (loc.area !== w.phase) return { ok: false, reason: "Вы не там физически." };
  if (loc.access === "all") return { ok: true };
  if (loc.access === "medium") {
    if (w.player.access === "low") return { ok: false, reason: "Средний доступ. Вашей карты мало." };
    return { ok: true };
  }
  if (w.player.access === "high" || w.player.formalPower >= 60) return { ok: true };
  if (w.playerInventory.includes("item_warrant") && (loc.id.includes("bridge") || loc.id.includes("officers") || loc.id.includes("cmd") || loc.id.includes("guard")))
    return { ok: true };
  return { ok: false, reason: "Формальный доступ закрыт. Это не плохой бросок — канала нет." };
}

function tickInjury(w: World, minutes: number): void {
  const hours = minutes / 60;
  for (const n of Object.values(w.npcs)) {
    if (!n.alive) continue;
    if (n.hp >= 30) continue;
    const untreated = n.pathologies.some((p) => !p.treated) || n.hp < 30;
    if (!untreated) continue;
    if (n.hp <= 5) {
      killNpc(w, n, "Раны не лечили. Смерть гарантирована порогом.");
      continue;
    }
    let rate = 0;
    if (n.hp <= 15) rate = 0.3;
    else if (n.hp <= 30) rate = 0.1;
    n.hp = Math.max(0, n.hp - rate * 100 * hours);
    if (n.hp <= 5) killNpc(w, n, "Истощение от ран без помощи.");
  }
}

function killNpc(w: World, n: Npc, cause: string): void {
  if (!n.alive) return;
  n.alive = false;
  n.conscious = false;
  n.hp = 0;
  n.sleeping = false;
  log(w, `${n.name} умер. ${cause}`, "alert");
  addHistory(w, {
    actorId: "world",
    action: "death",
    targetId: n.id,
    severity: "grave",
    text: `${n.name} мёртв. ${cause}`,
    causeTrace: cause,
  });
  addKnowledge(w, {
    subjectId: n.id,
    proposition: `${n.name} мёртв.`,
    kind: "OBSERVATION",
    sourceType: "SYSTEM_OBSERVATION",
    sourceId: "world",
    observedAt: w.worldTime,
    confidence: 1,
    epistemicState: "CONFIRMED",
    scope: n.locationId,
  });
  if (n.faction === "Guard" || n.faction === "Administratum" || n.faction === "Crew") {
    raiseAlert(w, "ORGANIZED");
  } else {
    raiseAlert(w, "ALERT");
  }
  w.flags[`dead_${n.id}`] = true;
}

function tickLoading(w: World, minutes: number): void {
  if (!w.loading.active || w.loading.paused || w.loading.incident) return;
  if (w.phase !== "planet" && w.playerLocationId !== "planet_dock") {
    // background progress slower if player left
  }
  const ticks = Math.floor(minutes / 10);
  for (let i = 0; i < ticks; i++) {
    w.loading.tick += 1;
    for (const c of w.cargo) {
      if (c.kind === "main" && !c.loaded) {
        c.progress = Math.min(100, c.progress + 8);
        if (c.progress >= 100) {
          c.loaded = true;
          c.locationId = "large_cargo";
          log(w, "Основной груз физически погружен.", "econ");
        }
      }
      if (c.kind === "side" && !c.loaded && (w.flags.hauled_side || c.locationId === "planet_dock")) {
        c.progress = Math.min(100, c.progress + 12);
        if (c.progress >= 100) {
          c.loaded = true;
          c.locationId = "large_cargo";
          log(w, "Попутный хлам погружен. Он не телепортировался — его внесли.", "econ");
        }
      }
    }
    if (w.loading.tick > 0 && w.loading.tick % 4 === 0 && rng(w) < 0.45 && !w.loading.incident) {
      w.loading.incident = makeIncident(w);
      w.loading.paused = true;
      if (w.playerLocationId === "planet_dock") {
        w.overlay = { kind: "loading" };
      } else {
        log(w, "С дока пришло сообщение: внештатная ситуация. Процесс ждёт.", "alert");
      }
      break;
    }
  }
}

function makeIncident(w: World): LoadingIncident {
  const pool: LoadingIncident[] = [
    {
      id: uid(w, "inc"),
      title: "Поломка оборудования",
      text: "Кран встал. Сервитор стоит в очереди к мёртвому механизму.",
      resolved: false,
      options: [
        { id: "fix", label: "Починить", result: "repair" },
        { id: "call", label: "Позвать механика", result: "call" },
        { id: "wait", label: "Дождаться", result: "wait" },
        { id: "replace", label: "Заменить", result: "replace" },
      ],
    },
    {
      id: uid(w, "inc"),
      title: "Травма рабочего",
      text: "Йол или кто-то из бригады схватился за бок. Кровь на перчатке.",
      resolved: false,
      options: [
        { id: "aid", label: "Первая помощь", result: "aid" },
        { id: "doc", label: "Врач / медблок", result: "doc" },
        { id: "swap", label: "Заменить исполнителя", result: "swap" },
      ],
    },
    {
      id: uid(w, "inc"),
      title: "Проверка фракции",
      text: "Люди с печатями Гвардии хотят видеть документы и содержимое ящиков.",
      resolved: false,
      options: [
        { id: "docs", label: "Документы", result: "docs" },
        { id: "hide", label: "Спрятать", result: "hide" },
        { id: "bribe", label: "Взятка", result: "bribe" },
        { id: "auth", label: "Полномочия", result: "auth" },
      ],
    },
    {
      id: uid(w, "inc"),
      title: "Простой сервитора",
      text: "Сервитор Б-7 стоит. Задачи нет. Он не передумает — он ждёт.",
      resolved: false,
      options: [
        { id: "reassign", label: "Переназначить", result: "reassign" },
        { id: "wait2", label: "Дождаться", result: "wait" },
        { id: "replace2", label: "Заменить", result: "replace" },
      ],
    },
    {
      id: uid(w, "inc"),
      title: "Драка рабочих",
      text: "Двое у ящика. Дело не в ящике.",
      resolved: false,
      options: [
        { id: "break", label: "Разнять", result: "break" },
        { id: "side", label: "Встать на сторону", result: "side" },
        { id: "leave", label: "Уйти", result: "ignore" },
      ],
    },
  ];
  return pool[Math.floor(rng(w) * pool.length)]!;
}

function autonomyMicro(w: World, minutes: number): void {
  for (const n of Object.values(w.npcs)) {
    if (!n.alive || n.area !== w.phase) continue;
    if (n.isCompanion && (n.companionMode === "JOIN_ACTIVE" || n.companionMode === "STAY_NEAR")) continue;
    if (n.actorClass === "NON_AGENT_EXECUTOR") continue;
    const dest = scheduleLocation(n, w.worldTime);
    if (dest !== n.locationId && w.locations[dest]?.area === n.area) {
      n.locationId = dest;
    }
    const night = minutesOfDay(w.worldTime) >= 1320 || minutesOfDay(w.worldTime) < 420;
    n.sleeping = night && (n.locationId.includes("cabin") || n.locationId.includes("bunk"));
    if (n.sleeping) n.conscious = true;
  }

  // Selma cheer is behavior, not a stat
  const selma = w.npcs.selma;
  if (selma?.alive && selma.area === w.phase) {
    const lines = [
      "Напевает что-то без слов, разнося рекаф.",
      "Улыбается пассажиру так, будто это день выдачи пайка.",
      "Смеётся над собственной шуткой о дыре в иллюминаторе.",
      "Поправляет чужой ремень с весёлым «ну вот, живые».",
    ];
    selma.moodLine = lines[Math.floor(w.worldTime / 40) % lines.length]!;
    if (minutes >= 20 && rng(w) < 0.25 && w.phase === "small_ship") {
      const other = Object.values(w.npcs).find((n) => n.id !== "selma" && n.alive && n.locationId === selma.locationId && n.area === w.phase);
      if (other && !w.flags.selma_talked) {
        w.flags.selma_gossip = true;
        if (other.id === "mech") {
          log(w, `${other.name} бормочет: «Весёлая без причины — это тоже поломка».`, "social");
          addKnowledge(w, {
            subjectId: "selma",
            proposition: "Дрел считает бодрость Селмы подозрительной.",
            kind: "OBSERVATION",
            sourceType: "NPC",
            sourceId: other.id,
            observedAt: w.worldTime,
            confidence: 0.6,
            epistemicState: "OBSERVED",
            scope: "small_ship",
          });
        } else if (other.id === "clerk") {
          log(w, `${other.name}: «Стюардесса слишком громкая для рейса с квотой».`, "social");
        }
      }
    }
  }

  // rumor spread
  for (const h of w.history) {
    if (h.severity === "minor") continue;
    const age = w.worldTime - h.time;
    if (age > 60 && h.spread < 1) h.spread = 1;
    if (age > 180 && h.spread < 2) h.spread = 2;
    if (age > 360 && h.spread < 3) h.spread = 3;
  }

  // callback
  if (w.worldTime - w.lastCallbackAt >= 240) {
    const cand = [...w.history].reverse().find((h) => h.severity !== "minor" && !h.appliedCallbacks.length && w.worldTime - h.time >= 180);
    if (cand && w.phase !== "small_ship") {
      cand.appliedCallbacks.push("cb1");
      w.lastCallbackAt = w.worldTime;
      log(w, `Вам напоминают не о самом событии, а о том, что мир его помнит: «это вы, с ${cand.text.split(".")[0]}».`, "social");
      addKnowledge(w, {
        subjectId: "world",
        proposition: "Событие малого корабля вернулось как память мира, не как повтор сцены.",
        kind: "INFERENCE",
        sourceType: "EVENT",
        sourceId: cand.id,
        observedAt: w.worldTime,
        confidence: 0.8,
        epistemicState: "OBSERVED",
        scope: w.phase,
      });
    }
  }

  w.player.hunger = Math.min(100, w.player.hunger + minutes * 0.08);
  w.player.fatigue = Math.min(100, w.player.fatigue + minutes * 0.05 + (w.player.hunger > 70 ? minutes * 0.02 : 0));
  w.player.sleepDebt = Math.min(100, w.player.sleepDebt + (minutes / 60) * 2);
}

function maybeArrival(w: World): void {
  if (w.phase === "small_ship" && w.worldTime >= w.assignment.planetEta && !w.flags.arrived_planet) {
    w.flags.arrived_planet = true;
    w.pendingEvent = {
      id: "arrive_planet",
      title: "Планета в иллюминаторе",
      text: `Капитан объявляет посадку на ${w.assignment.planet}. Малый корабль не получит межсистемную способность от того, что вы на нём летите. Впереди док, экзамен и живые люди, которые вас не ждали.`,
      options: [{ id: "disembark", label: "Сойти на площадку" }],
    };
    w.overlay = { kind: "event", eventId: "arrive_planet" };
  }
  if (w.phase === "large_ship" && w.worldTime >= w.ships.large.eta && !w.flags.arrived_station) {
    w.flags.arrived_station = true;
    w.pendingEvent = {
      id: "arrive_station",
      title: "Станция",
      text: `${w.assignment.station} заполняет иллюминатор. Никто не встречает автоматически. Груз ещё не принят, пока его не примут руками.`,
      options: [{ id: "station", label: "Выйти в док прибытия" }],
    };
    w.overlay = { kind: "event", eventId: "arrive_station" };
  }
}

export function advanceTime(w: World, minutes: number, reason: string): void {
  if (minutes <= 0) return;
  w.worldTime += minutes;
  tickInjury(w, minutes);
  tickLoading(w, minutes);
  autonomyMicro(w, minutes);
  followCompanions(w);
  maybeArrival(w);
  if (minutes >= 20) log(w, `Время: ${reason}.`, "sys");
}

function closeOverlay(w: World): void {
  w.overlay = { kind: "none" };
  w.inspectId = null;
  w.dialogueNpcId = null;
  w.dialogueOptions = [];
}

export function methodsFor(w: World, targetId: string): MethodDef[] {
  const loc = w.locations[w.playerLocationId];
  const npc = npcById(w, targetId);
  const obj = loc?.objects.find((o) => o.id === targetId);
  const methods: MethodDef[] = [];

  if (npc) {
    if (!npc.alive) {
      methods.push(
        { id: "search", label: "Обыскать", timeCost: 10 },
        { id: "hide_body", label: "Спрятать", timeCost: 20, irreversible: true },
        { id: "leave", label: "Уйти", timeCost: 0 },
      );
      return methods;
    }
    if (!npc.conscious) {
      methods.push(
        { id: "search", label: "Обыскать", timeCost: 10 },
        { id: "firstaid_npc", label: "Лечить / первая помощь", timeCost: 15 },
        { id: "finish", label: "Добить", timeCost: 5, irreversible: true },
        { id: "hide_body", label: "Спрятать", timeCost: 20, irreversible: true },
        { id: "inspect_only", label: "Осмотреть", timeCost: 2 },
        { id: "leave", label: "Уйти", timeCost: 0 },
      );
      return methods;
    }
    if (npc.sleeping) {
      methods.push(
        { id: "wake_soft", label: "Разбудить аккуратно", timeCost: 5 },
        { id: "wake_kick", label: "Пнуть", timeCost: 2 },
        { id: "search", label: "Обыскать", timeCost: 10, irreversible: true },
        { id: "kill", label: "Убить", timeCost: 5, irreversible: true },
        { id: "inspect_only", label: "Осмотреть", timeCost: 2 },
        { id: "leave", label: "Уйти", timeCost: 0 },
      );
      return methods;
    }
    if (npc.actorClass === "NON_AGENT_EXECUTOR") {
      methods.push(
        { id: "assign_task", label: "Назначить задачу", timeCost: 10, channel: "DIRECT_COMMAND" },
        { id: "inspect_only", label: "Осмотреть", timeCost: 2 },
        { id: "leave", label: "Уйти", timeCost: 0 },
      );
      return methods;
    }
    if (npc.contactStage === "STRANGER") {
      methods.push({ id: "greet", label: "Поздороваться", timeCost: 5 }, { id: "leave", label: "Уйти", timeCost: 0 });
    } else {
      methods.push({ id: "talk", label: "Говорить", timeCost: 10 });
      if (npc.hasTrade) methods.push({ id: "trade", label: "Торговать", timeCost: 15, channel: "NEGOTIATION" });
      if (npc.isCompanion) {
        methods.push(
          { id: "mode_join", label: "JOIN_ACTIVE — идти вместе", timeCost: 2 },
          { id: "mode_near", label: "STAY_NEAR — идти рядом", timeCost: 2 },
          { id: "mode_wait", label: "WAIT — ждать здесь", timeCost: 2 },
          { id: "mode_guard", label: "GUARD — охранять", timeCost: 2 },
          { id: "order_work", label: "Поручить работу", timeCost: 8, channel: "REQUEST" },
        );
      }
      if (npc.isSocialGuide) methods.push({ id: "explain", label: "Попросить объяснить обстановку", timeCost: 10 });
      if (npc.id === "l_captain") methods.push({ id: "ask_speed", label: "Просить ускорение маршрута", timeCost: 20, channel: "REQUEST" });
      methods.push(
        { id: "gift", label: "Подарок", timeCost: 5 },
        { id: "threaten", label: "Угрожать", timeCost: 5, channel: "COERCION", irreversible: true },
        { id: "attack", label: "Ударить", timeCost: 2, irreversible: true },
        { id: "leave", label: "Уйти", timeCost: 0 },
      );
    }
    methods.push({ id: "inspect_only", label: "Осмотреть", timeCost: 3 });
    return methods;
  }

  if (obj) {
    if (obj.id === "obj_bunk") methods.push({ id: "sleep_rest", label: "Спать", timeCost: 240 }, { id: "sleep_arrival", label: "Спать до прибытия", timeCost: 0 });
    if (obj.id === "obj_scanner" || obj.id === "obj_couch" || obj.id === "obj_queue_med")
      methods.push({ id: "med_self", label: "Сканировать себя (30 мин)", timeCost: 30 }, { id: "med_other", label: "Лечение (нужен пациент рядом)", timeCost: 45 });
    if (obj.id === "obj_crate" || obj.id === "obj_seals" || obj.id === "obj_junk" || obj.id === "obj_toolbox")
      methods.push({ id: "search_obj", label: "Обыскать / открыть", timeCost: 10 }, { id: "pry", label: "Вскрыть инструментом", timeCost: 15 });
    if (obj.id === "obj_papers") methods.push({ id: "read_papers", label: "Читать", timeCost: 12 });
    if (obj.id === "obj_helm" || obj.id === "obj_navlock" || obj.id === "obj_chart")
      methods.push({ id: "look_nav", label: "Смотреть маршрут", timeCost: 8 });
    if (obj.id === "obj_desk") methods.push({ id: "start_exam", label: "Начать экзамен", timeCost: 5 });
    if (obj.id === "obj_crane" || obj.id === "obj_servitors") methods.push({ id: "start_load", label: "Запустить погрузку", timeCost: 10 });
    if (obj.id === "obj_gangway") methods.push({ id: "board_large", label: "Подняться на большой корабль", timeCost: 20 });
    if (obj.id === "obj_tablet") methods.push({ id: "deliver", label: "Сдать груз физически", timeCost: 25 });
    if (obj.id === "obj_suits") methods.push({ id: "check_gear", label: "Проверить экипировку", timeCost: 10 });
    if (obj.id === "obj_manifest") methods.push({ id: "check_cargo", label: "Сверить манифест", timeCost: 10 });
    methods.push({ id: "inspect_only", label: "Осмотреть", timeCost: 3 }, { id: "leave", label: "Уйти", timeCost: 0 });
    return methods;
  }

  return [{ id: "leave", label: "Уйти", timeCost: 0 }];
}

function dialogueOptions(w: World, n: Npc): DialogueOption[] {
  if (n.pendingQuestion) {
    return [
      { id: "counter_honest", label: "Ответить честно", topic: "counter_honest" },
      { id: "counter_evade", label: "Уклониться", topic: "counter_evade" },
      { id: "counter_hostile", label: "Ответить враждебно", topic: "counter_hostile" },
    ];
  }
  const opts: DialogueOption[] = [];
  const st = n.contactStage;
  if (st === "STRANGER") opts.push({ id: "greet", label: TOPIC_LABELS.greet, topic: "greet" });
  if (st !== "STRANGER") {
    opts.push({ id: "smalltalk", label: "Общие вопросы", topic: "smalltalk" });
    opts.push({ id: "work", label: "О работе и месте", topic: "work" });
  }
  if (st === "GREETED" || st === "ACQUAINTED" || st === "TRUSTED") {
    opts.push({ id: "gift", label: "Простой предмет / подарок", topic: "gift" });
    opts.push({ id: "ask_help", label: "Простая просьба", topic: "ask_help" });
  }
  if (st === "ACQUAINTED" || st === "TRUSTED") {
    opts.push({ id: "gossip", label: "Сплетни", topic: "gossip" });
    opts.push({ id: "l1", label: "L1: Чего вы хотите для себя?", topic: "l1" });
  }
  if (st === "TRUSTED") {
    opts.push({ id: "l2", label: "L2: Почему это важно именно вам?", topic: "l2" });
    opts.push({ id: "l3", label: "L3: Что вы скрываете?", topic: "l3" });
    opts.push({ id: "sensitive", label: "Чувствительная просьба", topic: "sensitive" });
  }
  const canCommand = w.player.formalPower >= n.formalPower + 10 && n.faction !== "Independent";
  opts.push({
    id: "command",
    label: "Приказать",
    topic: "command",
    channel: "DIRECT_COMMAND",
    disabled: !canCommand,
    reason: canCommand ? undefined : "Канал DIRECT_COMMAND недоступен. Это не плохой бросок.",
  });
  opts.push({ id: "request", label: "Попросить", topic: "request", channel: "REQUEST" });
  if (n.hasTrade) opts.push({ id: "trade", label: "Торговать", topic: "trade", channel: "NEGOTIATION" });
  if (n.isSocialGuide) opts.push({ id: "explain", label: "Объясни, что здесь происходит", topic: "explain" });
  opts.push({ id: "leave", label: "Уйти", topic: "leave" });
  return opts;
}

function openDialogue(w: World, n: Npc): void {
  w.dialogueNpcId = n.id;
  w.dialogueOptions = dialogueOptions(w, n);
  w.overlay = { kind: "dialogue", npcId: n.id };
}

function observeNpc(w: World, n: Npc): void {
  addKnowledge(w, {
    subjectId: n.id,
    proposition: `${n.name} — ${n.role}. Сейчас: ${n.moodLine}`,
    kind: "OBSERVATION",
    sourceType: "SELF",
    sourceId: "player",
    observedAt: w.worldTime,
    confidence: 0.7,
    epistemicState: "OBSERVED",
    scope: n.locationId,
  });
  if (n.isSelma) {
    addKnowledge(w, {
      subjectId: n.id,
      proposition: "Селма сохраняет странно бодрый тон. Это поведение, не подпись.",
      kind: "OBSERVATION",
      sourceType: "SELF",
      sourceId: "player",
      observedAt: w.worldTime,
      confidence: 0.8,
      epistemicState: "OBSERVED",
      scope: "small_ship",
    });
  }
  if (n.isNavigator && n.locationId === "small_bridge") {
    addKnowledge(w, {
      subjectId: n.id,
      proposition: "Иллат Керн находится там, куда обычного пассажира не пускают.",
      kind: "OBSERVATION",
      sourceType: "SELF",
      sourceId: "player",
      observedAt: w.worldTime,
      confidence: 0.75,
      epistemicState: "OBSERVED",
      scope: "small_bridge",
    });
  }
}

function startTrade(w: World, n: Npc): void {
  const item = n.tradeItemId ? w.items[n.tradeItemId] : null;
  if (!item) {
    log(w, `${n.name} не торгуется: фиксированная цена или нет товара.`, "econ");
    return;
  }
  const social = 1 - w.player.status / 200 + (n.relation > 0 ? -0.05 : 0.05);
  const scarcity = 1.1;
  const ask = Math.round(item.value * n.askPriceMod * scarcity * (1 + n.urgency / 400) * social);
  const reserve = Math.round(item.value * n.reservePriceMod);
  w.trade = {
    npcId: n.id,
    state: "OPEN",
    itemId: item.id,
    itemName: item.name,
    ask,
    reserve,
    offered: 0,
    rounds: 0,
    maxRounds: 4,
    lastCounter: ask,
    cause: `База ${item.value}₡ × рынок × срочность ${n.urgency} × социальный статус.`,
  };
  w.overlay = { kind: "trade", npcId: n.id };
}

function startCombat(w: World, enemyId: string): void {
  const enemy = npcById(w, enemyId);
  if (!enemy) return;
  const parts = ["player", enemyId];
  for (const n of presentNpcs(w)) {
    if (n.id === enemyId) continue;
    if (n.isCompanion && n.companionMode === "JOIN_ACTIVE") parts.push(n.id);
    else if (n.isCompanion && n.companionMode === "STAY_NEAR") {
      // may refuse to join
    }
  }
  w.combat = {
    active: true,
    round: 1,
    participantIds: parts,
    turn: "player",
    log: [`Стычка. В зоне только физически присутствующие.`],
    enemyIds: [enemyId],
  };
  w.overlay = { kind: "combat" };
  raiseAlert(w, "SUSPICION");
}

function companionCombatDecision(w: World, n: Npc): string {
  const profile: CombatProfile = n.combatProfile;
  const threat = 40 + (100 - n.hp) / 2;
  if (profile === "COWARD_SURVIVALIST" || n.companionMode === "RETREAT") return "flee";
  if (profile === "RELIGIOUS_RESTRAINED") return "defend";
  if (profile === "SELF_INTERESTED" && threat > n.trust) return "hold";
  if (profile === "CAUTIOUS" && threat > 70) return "hold";
  if (n.companionMode === "STAY_NEAR") return "hold";
  return "attack";
}

function applyCombatMove(w: World, actor: "player" | string, move: string, targetId?: string): void {
  const enemy = npcById(w, w.combat.enemyIds[0] ?? "");
  if (actor === "player") {
    if (move === "attack" && enemy) {
      const roll = d20(w);
      const dmg = roll >= 12 ? 18 + Math.floor(rng(w) * 12) : roll >= 8 ? 8 : 0;
      enemy.hp = Math.max(0, enemy.hp - dmg);
      w.combat.log.push(`Вы бьёте. D20=${roll}. Урон ${dmg}. HP ${enemy.name}: ${enemy.hp}.`);
      addHistory(w, {
        actorId: "player",
        action: "attack",
        targetId: enemy.id,
        severity: dmg > 15 ? "notable" : "minor",
        text: `Удар по ${enemy.name}`,
        causeTrace: `D20 ${roll} → ${dmg} dmg`,
      });
      if (enemy.hp <= 0) {
        enemy.conscious = false;
        if (enemy.hp <= 0) {
          w.combat.log.push(`${enemy.name} без сознания.`);
        }
      }
    } else if (move === "defend") {
      w.combat.log.push("Вы держите позицию.");
    } else if (move === "threaten" && enemy) {
      const roll = d20(w);
      if (roll + Math.floor(w.player.status / 20) >= 12) {
        enemy.fear = Math.min(100, enemy.fear + 20);
        w.combat.log.push(`Угроза действует. Страх ${enemy.fear}. Стычка может закончиться.`);
        if (enemy.fear > 50) {
          w.combat.active = false;
          log(w, `${enemy.name} отступает. CONTROL над кораблём от этого не появляется.`, "social");
          closeOverlay(w);
          return;
        }
      } else w.combat.log.push("Угроза не взяла.");
    } else if (move === "negotiate") {
      w.combat.log.push("Пауза насилия. Если другая сторона способна слышать — это разговор.");
      w.combat.active = false;
      const e = enemy;
      if (e) openDialogue(w, e);
      return;
    } else if (move === "flee") {
      w.combat.log.push("Вы меняете позицию.");
      w.combat.active = false;
      closeOverlay(w);
      advanceTime(w, 5, "отступление");
      return;
    }
    w.combat.turn = "companion";
  }
}

function resolveCompanionAndEnemy(w: World): void {
  if (!w.combat.active) return;
  const companions = w.combat.participantIds.filter((id) => id !== "player" && !w.combat.enemyIds.includes(id));
  for (const id of companions) {
    const n = npcById(w, id);
    if (!n) continue;
    const dec = companionCombatDecision(w, n);
    const enemy = npcById(w, w.combat.enemyIds[0] ?? "");
    if (dec === "attack" && enemy && enemy.alive) {
      const roll = d20(w);
      const dmg = roll >= 11 ? 10 : 0;
      enemy.hp = Math.max(0, enemy.hp - dmg);
      w.combat.log.push(`${n.name} действует сам. Решение: удар. D20=${roll}.`);
      if (enemy.hp <= 0) enemy.conscious = false;
    } else if (dec === "flee") {
      w.combat.log.push(`${n.name} отступает. Отказ не отнимает ваш ход — уже был ваш.`);
      n.companionMode = "RETREAT";
    } else if (dec === "defend") {
      w.combat.log.push(`${n.name} отказывается убивать. Держит защиту.`);
    } else {
      w.combat.log.push(`${n.name} держит. Причина: оценка угрозы и своих ценностей.`);
    }
  }
  const enemy = npcById(w, w.combat.enemyIds[0] ?? "");
  if (enemy && enemy.alive && enemy.conscious && enemy.hp > 0) {
    const roll = d20(w);
    const dmg = roll >= 13 ? 12 : roll >= 9 ? 5 : 0;
    w.player.hp = Math.max(0, w.player.hp - dmg);
    w.combat.log.push(`${enemy.name} отвечает. D20=${roll}. Вам ${dmg}. HP ${w.player.hp}.`);
    if (w.player.hp <= 0) {
      w.player.hp = 0;
      w.combat.log.push("Вы без сознания.");
      w.combat.active = false;
      log(w, "Тьма. Мир продолжается без вашего взгляда.", "alert");
      advanceTime(w, 90, "бессознательность");
      w.player.hp = 25;
      w.player.fatigue = 80;
      closeOverlay(w);
      return;
    }
  }
  if (enemy && (!enemy.conscious || enemy.hp <= 0)) {
    w.combat.active = false;
    if (enemy.hp <= 0) killNpc(w, enemy, "Насильственная смерть в стычке. Есть свидетели или их нет — проверить отдельно.");
    else {
      enemy.pathologies.push({ id: uid(w, "tr"), name: "глубокая рана", severity: 40, treated: false });
      log(w, `Травма ${enemy.name} сохраняется после боя.`, "alert");
    }
    closeOverlay(w);
    raiseAlert(w, "ALERT");
    w.criminalEvents.push({ time: w.worldTime, severity: "grave" });
    return;
  }
  w.combat.round += 1;
  w.combat.turn = "player";
}

function talkTopic(w: World, n: Npc, topic: string): void {
  n.lastTalkAt = w.worldTime;
  n.askedTopics[topic] = (n.askedTopics[topic] ?? 0) + 1;
  const repeats = n.askedTopics[topic] ?? 1;

  const say = (text: string) => log(w, `${n.name}: ${text}`, "social");

  if (topic === "greet") {
    n.contactStage = "GREETED";
    bumpRelation(n, 1);
    if (n.isSelma) say("О, живой пассажир. Рекаф почти как кофе, если не вспоминать вкус. Я Селма. Не хмурьтесь — коридор этого не стоит.");
    else if (n.isMemoryGap) say("Наконец-то. На Варнаке ты вечно опаздывал. Или это был не Варнак? Неважно, ты это ты.");
    else say("А. Здравствуйте. Вы тот, с квотой.");
    if (n.isMemoryGap) {
      addKnowledge(w, {
        subjectId: n.id,
        proposition: "Кален Дрост помнит вас иначе, чем вы, возможно, помните себя.",
        kind: "OBSERVATION",
        sourceType: "NPC",
        sourceId: n.id,
        observedAt: w.worldTime,
        confidence: 0.55,
        epistemicState: "OBSERVED",
        scope: "memory",
      });
    }
    advanceTime(w, 5, "приветствие");
    return;
  }
  if (topic === "smalltalk") {
    if (n.contactStage === "GREETED" && n.trust + n.relation * 4 > 28) stageUp(n);
    if (n.isSelma) say("Империум большой, а каюты маленькие. Зато можно услышать, кто храпит — и кто притворяется.");
    else if (n.id === "captain") say("Курс держится. Пассажиры не курс.");
    else if (n.id === "dockboss") say("Бумага ваша. Кран мой. Пока кран живой.");
    else say("До порта долетим, если никто не будет героем.");
    bumpTrust(n, 2);
    advanceTime(w, 10, "разговор");
    return;
  }
  if (topic === "work") {
    say(n.goals[0] ? `Хочу: ${n.goals[0]}. Это не ваша квота.` : "Работа есть. Разговоры — после.");
    if (n.id === "dockboss") {
      addKnowledge(w, {
        subjectId: n.id,
        proposition: "Бригадир Унн — фактический хозяин дока, не экзаменатор.",
        kind: "INFERENCE",
        sourceType: "NPC",
        sourceId: n.id,
        observedAt: w.worldTime,
        confidence: 0.7,
        epistemicState: "OBSERVED",
        scope: "planet_dock",
      });
    }
    if (n.contactStage === "GREETED") stageUp(n);
    advanceTime(w, 10, "разговор о работе");
    return;
  }
  if (topic === "gossip") {
    if (n.id === "mech" || n.id === "clerk" || n.id === "guardp") {
      say("Стюардесса слишком весёлая. Люди так не живут без причины. Или живут — и это хуже.");
      addKnowledge(w, {
        subjectId: "selma",
        proposition: `${n.name} обсуждает манеру Селмы. Это обычное социальное событие.`,
        kind: "REPORT",
        sourceType: "NPC",
        sourceId: n.id,
        observedAt: w.worldTime,
        confidence: 0.5,
        epistemicState: "OBSERVED",
        scope: "small_ship",
      });
    } else if (n.isNavigator) {
      say("Я ничего не знаю про навигацию. Я просто не ем в общей зоне. Это другое.");
    } else say("Слухи дешевле, чем правда. Правда дороже, чем ваш рейс.");
    advanceTime(w, 12, "сплетни");
    return;
  }
  if (topic === "l1" || topic === "l2" || topic === "l3") {
    if (repeats > 1) {
      bumpRelation(n, -2);
      say("Вы уже спрашивали. Повтор личной темы — это не интерес, это давление.");
    } else if (topic === "l1") {
      n.personalRevealed = Math.max(n.personalRevealed, 1);
      say(n.goals[0] ?? "Хочу, чтобы меня не трогали.");
      bumpTrust(n, 4);
      if (n.trust > 40) stageUp(n);
      if (rng(w) < 0.4) {
        n.pendingQuestion = "А вы? Зачем вам чужой секрет?";
        say("Теперь вы. Зачем вам это?");
      }
    } else if (topic === "l2") {
      n.personalRevealed = Math.max(n.personalRevealed, 2);
      say(n.values.join("; ") || "Потому что иначе я — функция.");
      bumpTrust(n, 3);
    } else {
      n.personalRevealed = 3;
      if (n.trust < 55) {
        say("Скрываю то, что вы не заработали знать.");
        bumpRelation(n, -1);
      } else if (n.hiddenGoal) {
        n.hiddenGoalKnown = true;
        say(n.hiddenGoal);
        addKnowledge(w, {
          subjectId: n.id,
          proposition: `Скрытая цель ${n.name}: ${n.hiddenGoal}`,
          kind: "REPORT",
          sourceType: "NPC",
          sourceId: n.id,
          observedAt: w.worldTime,
          confidence: 0.6,
          epistemicState: "OBSERVED",
          scope: "personal",
          visibility: "SENSITIVE",
        });
      } else say("Скрываю усталость. Это не тайна, это манеры.");
    }
    advanceTime(w, 15, "личная тема");
    return;
  }
  if (topic === "counter_honest") {
    n.pendingQuestion = null;
    bumpRelation(n, 2);
    bumpTrust(n, 5);
    say("Хотя бы не соврали. Это редкость.");
    advanceTime(w, 8, "честный ответ");
    return;
  }
  if (topic === "counter_evade") {
    n.pendingQuestion = null;
    say("Понятно. Молчание тоже ответ.");
    advanceTime(w, 6, "уклончивый ответ");
    return;
  }
  if (topic === "counter_hostile") {
    n.pendingQuestion = null;
    bumpRelation(n, -3);
    say("Тогда разговор кончен.");
    advanceTime(w, 5, "враждебный ответ");
    closeOverlay(w);
    return;
  }
  if (topic === "explain") {
    if (!n.isSocialGuide) {
      say("Я не ваш учебник.");
      return;
    }
    // guide explains only if they have a reason
    const busy = n.fatigue > 75 || n.companionMode === "WAIT";
    if (busy) {
      say("Сейчас не до уроков. Я занят своим.");
      log(w, "SOCIAL_GUIDE может молчать. Он не видит WORLD_TRUTH по запросу.", "sys");
    } else if (w.worldTime - n.lastExplainAt < 30) {
      say("Я только что говорил. Слушайте мир, не меня.");
    } else {
      n.lastExplainAt = w.worldTime;
      const lessons = [
        "Формальный начальник — экзаменатор. Фактический — бригадир у крана. Приказ первому не двигает ящик.",
        "Долг не равен дружбе. Человек, которому вы должны, может вас ненавидеть аккуратно.",
        "Публичное унижение меняет комнату. Частный спор меняет двоих.",
        "Согласие ещё не выполнение. Слово — intent. Результат — после eligibility и времени.",
        "Торговец уже решил, вы клиент, равный, риск или добыча. Цена — следствие, не начало.",
      ];
      const lesson = lessons[Math.floor(rng(w) * lessons.length)]!;
      say(lesson);
      addKnowledge(w, {
        subjectId: "social",
        proposition: lesson,
        kind: "INFERENCE",
        sourceType: "NPC",
        sourceId: n.id,
        observedAt: w.worldTime,
        confidence: 0.65,
        epistemicState: "OBSERVED",
        scope: "guide",
      });
    }
    advanceTime(w, 12, "пояснение");
    return;
  }
  if (topic === "command") {
    const can = w.player.formalPower >= n.formalPower + 10;
    if (!can) {
      log(w, "Канал DIRECT_COMMAND недоступен. Попробуйте просьбу, сделку, посредника или угрозу.", "sys");
      return;
    }
    say("Приказ принят как intent. Результат будет, если я жив и способен.");
    advanceTime(w, 8, "приказ");
    return;
  }
  if (topic === "request") {
    const roll = d20(w) + n.relation;
    if (roll >= 10) {
      say("Могу. Не бесплатно и не сразу.");
      bumpTrust(n, 2);
    } else say("Нет. И это не кубик — мне это не нужно.");
    advanceTime(w, 10, "просьба");
    return;
  }
  if (topic === "gift") {
    if (w.player.money >= 10) {
      w.player.money -= 10;
      bumpRelation(n, 1);
      say("Приму. Это не дружба.");
    } else say("Дарить нечего — и видно.");
    advanceTime(w, 5, "подарок");
    return;
  }
  if (topic === "ask_help" || topic === "sensitive") {
    if (topic === "sensitive" && n.contactStage !== "TRUSTED") {
      log(w, "Канал закрыт стадией контакта.", "sys");
      return;
    }
    say(n.relation >= 2 ? "Сделаю, если это не убивает меня." : "Сначала станьте кем-то, а не квотой.");
    advanceTime(w, 10, "просьба");
    return;
  }
  if (topic === "trade") {
    startTrade(w, n);
    return;
  }
  if (topic === "leave") {
    closeOverlay(w);
  }
}

function medicalScan(w: World, patientId: string): void {
  const isSelf = patientId === "player";
  const n = isSelf ? null : npcById(w, patientId);
  advanceTime(w, 30, "сканирование");
  const path: Pathology[] = isSelf
    ? w.player.fatigue > 70
      ? [{ id: "stress", name: "хронический стресс", severity: 20, treated: false }]
      : [{ id: "eye", name: "напряжение глаз", severity: 10, treated: false }]
    : (n?.pathologies ?? []);
  const names = path.map((p) => p.name).join(", ") || "известных патологий нет";
  log(w, `Скан: ${isSelf ? "вы" : n?.name}: ${names}. 30 минут. Запись создана.`, "sys");
  addKnowledge(w, {
    subjectId: patientId,
    proposition: `Медицинская запись: ${names}`,
    kind: "DOCUMENT",
    sourceType: "SYSTEM_OBSERVATION",
    sourceId: "scan",
    observedAt: w.worldTime,
    confidence: 0.9,
    epistemicState: "CONFIRMED",
    scope: "med",
  });
}

function medicalTreat(w: World, patientId: string, firstAid: boolean): void {
  const cost = firstAid ? 0 : 40;
  if (!firstAid && w.player.money < cost) {
    log(w, "Обычное лечение блокировано: нет источника оплаты. Первая помощь остаётся отдельным методом.", "alert");
    return;
  }
  if (!firstAid) w.player.money -= cost;
  advanceTime(w, firstAid ? 15 : 45, firstAid ? "первая помощь" : "лечение");
  if (patientId === "player") {
    w.player.hp = Math.min(100, w.player.hp + (firstAid ? 10 : 35));
    log(w, firstAid ? "Первая помощь. Не полноценный treat." : "Лечение завершено. 45 минут, 40₡.", "sys");
  } else {
    const n = npcById(w, patientId);
    if (!n) return;
    n.hp = Math.min(100, n.hp + (firstAid ? 8 : 40));
    n.pathologies = n.pathologies.map((p) => (firstAid ? p : { ...p, treated: true }));
    bumpRelation(n, firstAid ? 1 : 2);
    log(w, `${n.name}: ${firstAid ? "первая помощь" : "лечение"}. HP ${n.hp}.`, "sys");
    addHistory(w, {
      actorId: "player",
      action: "treat",
      targetId: n.id,
      severity: "notable",
      text: `Помощь ${n.name}`,
      causeTrace: firstAid ? "first-aid" : `treat 45m 40c`,
    });
  }
}

function moveSideLot(w: World): void {
  const side = w.cargo.find((c) => c.kind === "side");
  if (!side || side.loaded) return;
  if (side.locationId === w.playerLocationId || w.playerInventory.includes("item_junk") || w.flags.hauled_side) {
    side.locationId = "planet_dock";
    w.flags.hauled_side = true;
    log(w, "Хлам перемещён физически. Он не появился на доке сам.", "econ");
  }
}

function tryBoardLarge(w: World): void {
  const main = w.cargo.find((c) => c.kind === "main");
  if (w.exam.passed === false && w.exam.attempts === 0) {
    log(w, "Без допуска экзамена вас могут не пустить как оператора. Как пассажира — ещё можно спорить.", "sys");
  }
  if (main && !main.loaded) {
    log(w, "Основной груз ещё на планете. Можно уйти без него — обязательство останется в истории.", "econ");
  }
  w.phase = "large_ship";
  w.playerLocationId = "large_cabin";
  w.boardedLarge = true;
  w.ships.small.status = "DOCKED";
  w.ships.large.status = "EN_ROUTE";
  const remain = Math.round(w.travelDurationBase * (1 - w.accelerated));
  w.ships.large.eta = w.worldTime + remain;
  for (const n of Object.values(w.npcs)) {
    if (n.isCompanion) {
      n.area = "large_ship";
      n.locationId = "large_cabin";
    }
    if (n.isNavigator || n.isMemoryGap || n.id === "merchant") {
      n.area = "large_ship";
      n.locationId = n.isNavigator ? "large_corridor" : "large_galley";
    }
  }
  followCompanions(w);
  log(w, "Большой корабль. Людей больше. Никто не квест по умолчанию.", "sys");
  closeOverlay(w);
  advanceTime(w, 25, "посадка на большой корабль");
}

function tryDeliver(w: World): void {
  const main = w.cargo.find((c) => c.kind === "main");
  const side = w.cargo.find((c) => c.kind === "side");
  if (main && main.loaded && !main.received) {
    main.received = true;
    main.locationId = "st_store";
    log(w, "Основной груз принят физически. Подпись стоит.", "econ");
  } else if (main && !main.loaded) {
    log(w, "Груза нет. Приёмка по контракту не равна желанию.", "alert");
  }
  if (side && (side.loaded || w.flags.hauled_side) && !side.received) {
    if (side.locationId === "large_cargo" || side.loaded) {
      side.received = true;
      log(w, "Хлам принят. Он был привезён.", "econ");
    }
  }
  addHistory(w, {
    actorId: "player",
    action: "deliver",
    targetId: "cargo",
    severity: "notable",
    text: "Попытка физической приёмки",
    causeTrace: `main=${!!main?.received} side=${!!side?.received}`,
  });
  maybeReport(w);
}

function maybeReport(w: World): void {
  const main = w.cargo.find((c) => c.kind === "main");
  const side = w.cargo.find((c) => c.kind === "side");
  if (main?.received && side?.received) {
    w.pendingEvent = {
      id: "end_normal",
      title: "Пролог закрывается",
      text: "Основной груз принят. Хлам обработан. Корабль разгружен. Отчёт будет о людях и следах, не только о тоннах.",
      options: [{ id: "report", label: "Открыть отчёт" }],
    };
    w.overlay = { kind: "event", eventId: "end_normal" };
  }
}

function buildReport(w: World, ending: "station" | "escape"): ReportData {
  return {
    ending,
    scenes: w.history.slice(-12).map((h) => `${h.text} (${h.causeTrace})`),
    people: Object.values(w.npcs)
      .filter((n) => n.contactStage !== "STRANGER" || !n.alive)
      .map((n) => `${n.name}: ${n.alive ? n.contactStage : "мёртв"}, отношение ${n.relation}`),
    traces: w.knowledge.slice(-10).map((k) => k.proposition),
    autonomous: w.log.filter((l) => l.tone === "social").slice(0, 8).map((l) => l.text),
  };
}

function applySleep(w: World, untilArrival: boolean): void {
  const target = untilArrival
    ? Math.max(w.worldTime + 60, w.phase === "small_ship" ? w.assignment.planetEta : w.ships.large.eta)
    : w.worldTime + 240;
  const span = Math.min(target - w.worldTime, 14 * 60);
  const events = Math.min(3, Math.floor(span / 180));
  for (let i = 0; i < events; i++) {
    if (rng(w) < 0.55) {
      const ev = SLEEP_EVENTS[Math.floor(rng(w) * SLEEP_EVENTS.length)]!;
      log(w, `${ev.title}: ${ev.text}`, "alert");
      addKnowledge(w, {
        subjectId: "sleep",
        proposition: ev.title + " — событие сна. Разрешено один раз.",
        kind: "EXPERIENCE",
        sourceType: "EVENT",
        sourceId: ev.id,
        observedAt: w.worldTime,
        confidence: 0.4,
        epistemicState: "OBSERVED",
        scope: "sleep",
      });
      w.player.stress = Math.min(100, w.player.stress + 6);
    }
  }
  advanceTime(w, span, untilArrival ? "сон до прибытия" : "сон");
  w.player.fatigue = Math.max(0, w.player.fatigue - 45);
  w.player.sleepDebt = Math.max(0, w.player.sleepDebt - 30);
  w.player.hp = Math.min(100, w.player.hp + 8);
  log(w, "Сон продвинул WORLD_TIME. Автономия не останавливалась.", "sys");
}

function handleExamTalk(w: World, choice: string): void {
  const mods: Record<string, number> = {
    same: 1,
    limits: 2,
    lost: 3,
    bad: -2,
    think: 0,
  };
  const mod = mods[choice] ?? 0;
  const roll = d20(w);
  w.exam.s3 = Math.max(0, Math.min(1, (roll + mod) / 20));
  w.exam.talked = true;
  const final = 0.3 * w.exam.s1 + 0.4 * w.exam.s2 + 0.3 * w.exam.s3;
  w.exam.passed = final >= 0.75;
  w.exam.attempts += 1;
  w.exam.stage = "done";
  log(w, `Экзамен: ${(final * 100).toFixed(0)}%. D20=${roll}, мод ${mod}. ${w.exam.passed ? "Допуск." : "Провал создаёт состояние, не конец."}`, "sys");
  if (!w.exam.passed) {
    w.player.stress += 10;
    const n = w.npcs.examiner;
    if (n) bumpRelation(n, -1);
    addHistory(w, {
      actorId: "player",
      action: "exam_fail",
      targetId: "examiner",
      severity: "notable",
      text: "Провал экзамена",
      causeTrace: `final=${final.toFixed(2)}`,
    });
  } else {
    w.examUnlocked = true;
    if (w.player.access === "low") w.player.access = "medium";
  }
  closeOverlay(w);
}

function resolveIncident(w: World, optionId: string): void {
  const inc = w.loading.incident;
  if (!inc) return;
  const opt = inc.options.find((o) => o.id === optionId);
  const result = opt?.result ?? "ignore";
  let trace = result;
  if (result === "repair") {
    if (w.playerInventory.includes("item_tool") || w.background === "tech") {
      log(w, "Вы чините сами. Компетенция имеет потребителя.", "econ");
      advanceTime(w, 30, "ремонт");
    } else {
      log(w, "Без инструмента ремонт — это желание. Вы теряете время.", "alert");
      advanceTime(w, 50, "неудачный ремонт");
      w.cargo[0] && (w.cargo[0].progress = Math.max(0, w.cargo[0].progress - 10));
    }
  } else if (result === "call") {
    advanceTime(w, 40, "ожидание механика");
    log(w, "Механик пришёл. Intent стал execution.", "econ");
  } else if (result === "wait") {
    advanceTime(w, 60, "ожидание");
    log(w, "Время починяет дешевле людей. Дедлайн не согласен.", "sys");
  } else if (result === "aid") {
    medicalTreat(w, "workerp", true);
    const y = w.npcs.workerp;
    if (y) {
      y.hp = Math.max(20, y.hp - 15);
      y.pathologies.push({ id: uid(w, "tr"), name: "прищемлённая рука", severity: 30, treated: false });
    }
  } else if (result === "doc") {
    advanceTime(w, 20, "путь к медблоку");
    w.playerLocationId = "planet_med";
  } else if (result === "docs") {
    log(w, "Документы приняты. Формальный канал сработал.", "sys");
    advanceTime(w, 15, "проверка");
  } else if (result === "bribe") {
    if (w.player.money >= 40) {
      w.player.money -= 40;
      log(w, "Взятка меняет мотивацию, не истину.", "econ");
      addHistory(w, {
        actorId: "player",
        action: "bribe",
        targetId: "faction_check",
        severity: "notable",
        text: "Взятка на доке",
        causeTrace: "40c",
      });
      w.criminalEvents.push({ time: w.worldTime, severity: "notable" });
    } else log(w, "Платить нечем.", "alert");
    advanceTime(w, 10, "взятка");
  } else if (result === "auth") {
    if (w.player.formalPower >= 50 || w.playerInventory.includes("item_warrant")) {
      log(w, "Полномочия в scope. Проверка сворачивается.", "sys");
    } else log(w, "Полномочий нет. Канал закрыт.", "alert");
    advanceTime(w, 10, "полномочия");
  } else if (result === "hide") {
    const roll = d20(w);
    if (roll >= 12) log(w, "Спрятали. Свидетелей меньше.", "sys");
    else {
      raiseAlert(w, "SUSPICION");
      log(w, "Прятать при свидетелях — новая причина.", "alert");
    }
    advanceTime(w, 15, "сокрытие");
  } else if (result === "reassign") {
    log(w, "Сервитору назначена задача. Он не передумал — у него нет воли.", "econ");
    advanceTime(w, 10, "переназначение");
  } else if (result === "break") {
    bumpRelation(w.npcs.dockboss, 1);
    log(w, "Драку разняли. Бригадир это запомнил.", "social");
    advanceTime(w, 15, "драка");
  } else if (result === "ignore" || result === "leave") {
    log(w, "Игнорирование тоже причина: задержка.", "alert");
    w.cargo[0] && (w.cargo[0].progress = Math.max(0, w.cargo[0].progress - 8));
    advanceTime(w, 5, "уход от ситуации");
  } else {
    advanceTime(w, 20, "реакция");
  }
  addHistory(w, {
    actorId: "player",
    action: "incident",
    targetId: inc.id,
    severity: "notable",
    text: inc.title,
    causeTrace: trace,
  });
  inc.resolved = true;
  w.loading.incident = null;
  w.loading.paused = false;
  closeOverlay(w);
}

function scoreAlloc(alloc: number[]): number {
  const demand = [1.2, 2.0, 1.5, 1.3];
  let unmet = 0;
  let over = 0;
  alloc.forEach((a, i) => {
    unmet += Math.max(0, demand[i]! - a);
    over += Math.max(0, a - demand[i]! * 1.45);
  });
  const sum = alloc.reduce((s, x) => s + x, 0);
  const capPen = Math.abs(sum - 6) * 0.08;
  return Math.max(0, Math.min(1, 1 - unmet / 6 - over / 6 - capPen));
}

function scoreJobs(jobs: number[]): number {
  const c0 = jobs.filter((j) => j === 0).length;
  const c1 = jobs.filter((j) => j === 1).length;
  let s = 0.4;
  if (c0 > 0 && c1 > 0) s += 0.3;
  if (c0 <= 2 && c1 <= 2) s += 0.3;
  if (c0 === 3 || c1 === 3) s -= 0.25;
  return Math.max(0, Math.min(1, s));
}

function handleEvent(w: World, optionId: string): void {
  const ev = w.pendingEvent;
  w.pendingEvent = null;
  if (!ev) {
    closeOverlay(w);
    return;
  }
  if (ev.id === "arrive_planet" || optionId === "disembark") {
    w.phase = "planet";
    w.playerLocationId = "planet_pad";
    for (const n of Object.values(w.npcs)) {
      if (n.isCompanion) {
        n.area = "planet";
        n.locationId = "planet_pad";
      }
    }
    followCompanions(w);
    log(w, `${w.assignment.planet}. Шум, пар, никто не встречает по имени.`, "sys");
    closeOverlay(w);
    return;
  }
  if (ev.id === "arrive_station" || optionId === "station") {
    w.phase = "station";
    w.playerLocationId = "st_dock";
    for (const n of Object.values(w.npcs)) {
      if (n.isCompanion) {
        n.area = "station";
        n.locationId = "st_dock";
      }
    }
    followCompanions(w);
    closeOverlay(w);
    return;
  }
  if (ev.id === "end_normal" || optionId === "report") {
    w.report = buildReport(w, "station");
    w.screen = "report";
    w.overlay = { kind: "report" };
    return;
  }
  closeOverlay(w);
}

function askSpeed(w: World): void {
  const cap = w.npcs.l_captain;
  if (!cap) return;
  let mod = 0;
  if (w.background === "admin" || w.background === "trader") mod += 2;
  if (cap.relation >= 3) mod += 1;
  if (w.threatenedCaptain) mod -= 2;
  if (w.exam.passed) mod += 3;
  const roll = d20(w) + mod;
  let cut = 0;
  if (roll <= 5) {
    log(w, "Капитан отказал. Его обязательства важнее вашей квоты.", "social");
    bumpRelation(cap, -1);
  } else if (roll <= 11) cut = 0.1;
  else if (roll <= 17) cut = 0.22;
  else {
    cut = 0.35;
    bumpRelation(cap, 1);
  }
  if (cut > 0) {
    w.accelerated = Math.max(w.accelerated, cut);
    w.ships.large.eta = w.worldTime + Math.round(w.travelDurationBase * (1 - w.accelerated));
    log(w, `Маршрут сокращён примерно на ${Math.round(cut * 100)}%. D20+мод=${roll}.`, "econ");
  }
  w.captainRelation = cap.relation;
  advanceTime(w, 20, "разговор с капитаном");
  closeOverlay(w);
}

function orderWork(w: World, n: Npc): void {
  if (n.companionMode === "STAY_NEAR") {
    log(w, `${n.name} остаётся рядом. Вы видите, как он ставит задачу сервитору. Сам факт поручения не есть выполнение.`, "sys");
    const s = w.npcs.serv1;
    if (s) log(w, `${s.name} принял задачу в очередь. Execution начнётся, когда кран свободен.`, "econ");
    addKnowledge(w, {
      subjectId: n.id,
      proposition: "STAY_NEAR позволяет наблюдать старт делегированной работы, не выполнять её за вас.",
      kind: "EXPERIENCE",
      sourceType: "SELF",
      sourceId: "player",
      observedAt: w.worldTime,
      confidence: 0.9,
      epistemicState: "CONFIRMED",
      scope: "companion",
    });
  } else if (n.companionMode === "JOIN_ACTIVE") {
    const refuse = n.combatProfile === "SELF_INTERESTED" && rng(w) < 0.3;
    if (refuse) {
      log(w, `${n.name} отказывается: «это не моя смена и не мой кран». Отказ оставляет состояние. Ваш ход не отобран.`, "social");
    } else {
      log(w, `${n.name} начинает. Проверяет кран, ставит сервитору задачу, докладывает только после старта.`, "econ");
      if (!w.loading.active && w.phase === "planet") w.loading.active = true;
    }
  } else {
    log(w, `${n.name} не в режиме участия. Сначала JOIN_ACTIVE или STAY_NEAR.`, "sys");
  }
  advanceTime(w, 8, "поручение");
}

export function inspectLabel(w: World, targetId: string): { title: string; body: string } {
  const n = npcById(w, targetId);
  if (n) {
    const state = !n.alive ? "мёртв" : n.sleeping ? "спит (не свидетель)" : !n.conscious ? "без сознания" : n.moodLine;
    return {
      title: n.name,
      body: `${n.role}. ${FACTION(n.faction)} Стадия: ${n.contactStage}. ${state}${n.actorClass === "NON_AGENT_EXECUTOR" ? " Нет собственной воли." : ""}`,
    };
  }
  const obj = w.locations[w.playerLocationId]?.objects.find((o) => o.id === targetId);
  if (obj) return { title: obj.name, body: obj.description };
  const loc = w.locations[targetId];
  if (loc) return { title: loc.name, body: loc.detail };
  return { title: "Объект", body: "Наблюдение." };
}

function FACTION(f: string): string {
  return f ? `${f}.` : "";
}

export function reduce(input: World, action: GameAction): World {
  const w = structuredClone(input) as World;

  switch (action.type) {
    case "SELECT_BACKGROUND": {
      return createWorld(w.masterSeed, action.id);
    }
    case "BEGIN": {
      w.screen = "play";
      w.phase = "small_ship";
      w.playerLocationId = "small_airlock";
      log(w, "Шлюз. Три скафандра. Дальше — живые люди.", "sys");
      addKnowledge(w, {
        subjectId: "self",
        proposition: `Предыстория: ${BACKGROUNDS.find((b) => b.id === w.background)?.title ?? "—"}. Это стартовый пакет, не выбор планеты.`,
        kind: "DOCUMENT",
        sourceType: "DOCUMENT",
        sourceId: "bg",
        observedAt: w.worldTime,
        confidence: 1,
        epistemicState: "CONFIRMED",
        scope: "player",
      });
      break;
    }
    case "MOVE": {
      const gate = canEnter(w, action.locationId);
      if (!gate.ok) {
        log(w, gate.reason ?? "Нет доступа.", "alert");
        break;
      }
      const loc = w.locations[action.locationId]!;
      const cost = loc.moveMinutes;
      w.playerLocationId = loc.id;
      followCompanions(w);
      advanceTime(w, cost, `перемещение: ${loc.name}`);
      log(w, loc.short, "obs");
      // movement creates observations
      for (const n of presentNpcs(w)) {
        if (n.sleeping) continue;
        if (n.isSelma) observeNpc(w, n);
      }
      closeOverlay(w);
      break;
    }
    case "INSPECT": {
      w.inspectId = action.targetId;
      w.overlay = { kind: "inspect", targetId: action.targetId };
      const n = npcById(w, action.targetId);
      if (n) observeNpc(w, n);
      advanceTime(w, 2, "осмотр");
      break;
    }
    case "CLOSE": {
      if (w.overlay.kind === "pda") closeOverlay(w);
      else if (w.overlay.kind === "combat" && w.combat.active) break;
      else closeOverlay(w);
      break;
    }
    case "PDA": {
      if (w.overlay.kind === "pda" && !action.tab) closeOverlay(w);
      else {
        if (action.tab) w.pdaTab = action.tab;
        w.overlay = { kind: "pda" };
      }
      break;
    }
    case "METHOD": {
      applyMethod(w, action.id, action.targetId);
      break;
    }
    case "DIALOGUE": {
      const n = w.dialogueNpcId ? npcById(w, w.dialogueNpcId) : undefined;
      if (!n) break;
      talkTopic(w, n, action.optionId);
      if (w.overlay.kind === "dialogue" && n.alive) w.dialogueOptions = dialogueOptions(w, n);
      break;
    }
    case "TRADE": {
      applyTrade(w, action);
      break;
    }
    case "COMBAT": {
      applyCombatMove(w, "player", action.move, action.targetId);
      if (w.combat.active) resolveCompanionAndEnemy(w);
      break;
    }
    case "COMPANION_MODE": {
      const n = npcById(w, action.npcId);
      if (n?.isCompanion) {
        n.companionMode = action.mode;
        followCompanions(w);
        log(w, `${n.name}: режим ${action.mode}.`, "sys");
      }
      break;
    }
    case "WAIT": {
      advanceTime(w, action.minutes, "ожидание");
      log(w, "Мир шёл без вашего участия. Часть событий можно было пропустить.", "sys");
      break;
    }
    case "SLEEP": {
      applySleep(w, action.until === "arrival");
      closeOverlay(w);
      break;
    }
    case "EVENT": {
      handleEvent(w, action.optionId);
      break;
    }
    case "EXAM_ALLOC": {
      w.exam.alloc = action.alloc;
      break;
    }
    case "EXAM_JOBS": {
      w.exam.jobs = action.jobs;
      break;
    }
    case "EXAM_NEXT": {
      if (w.exam.stage === 1) {
        w.exam.s1 = scoreAlloc(w.exam.alloc);
        w.exam.stage = 2;
        log(w, `Симулятор: ${(w.exam.s1 * 100).toFixed(0)}%. Порог ориентир 75%.`, "sys");
      } else if (w.exam.stage === 2) {
        w.exam.s2 = scoreJobs(w.exam.jobs);
        w.exam.stage = 3;
        log(w, `Сервиторы: ${(w.exam.s2 * 100).toFixed(0)}%. Порог ориентир 80%.`, "sys");
      }
      break;
    }
    case "EXAM_TALK": {
      handleExamTalk(w, action.choice);
      break;
    }
    case "LOADING_START": {
      w.loading.active = true;
      w.overlay = { kind: "loading" };
      moveSideLot(w);
      log(w, "Погрузка запущена. Тик 10 минут. Можно уйти — процесс живой.", "econ");
      advanceTime(w, 10, "старт погрузки");
      break;
    }
    case "LOADING_RESOLVE": {
      resolveIncident(w, action.optionId);
      break;
    }
    case "MEDICAL": {
      if (action.act === "scan") medicalScan(w, action.patientId);
      else if (action.act === "firstaid") medicalTreat(w, action.patientId, true);
      else medicalTreat(w, action.patientId, false);
      closeOverlay(w);
      break;
    }
    case "FINISH": {
      w.report = buildReport(w, w.phase === "station" ? "station" : "escape");
      w.screen = "report";
      break;
    }
  }

  // loss of normal authority derived
  const grave = w.criminalEvents.filter((e) => e.severity === "grave" && w.worldTime - e.time <= 24 * 60);
  const notable = w.criminalEvents.filter((e) => w.worldTime - e.time <= 24 * 60);
  if (grave.length >= 2 || notable.length >= 3 || w.ships.small.control === "PLAYER_CONTROL") {
    w.lossOfNormalAuthority = true;
  }

  return w;
}

function applyMethod(w: World, id: string, targetId: string): void {
  const n = npcById(w, targetId);
  if (id === "leave") {
    closeOverlay(w);
    return;
  }
  if (id === "inspect_only") {
    const info = inspectLabel(w, targetId);
    log(w, `${info.title}: ${info.body}`, "obs");
    advanceTime(w, 3, "осмотр");
    return;
  }
  if (n) {
    if (id === "greet") {
      talkTopic(w, n, "greet");
      openDialogue(w, n);
      return;
    }
    if (id === "talk") {
      openDialogue(w, n);
      return;
    }
    if (id === "trade") {
      startTrade(w, n);
      return;
    }
    if (id === "explain") {
      openDialogue(w, n);
      talkTopic(w, n, "explain");
      return;
    }
    if (id === "mode_join") {
      n.companionMode = "JOIN_ACTIVE";
      followCompanions(w);
      log(w, `${n.name} идёт вместе и считает себя участником.`, "sys");
      return;
    }
    if (id === "mode_near") {
      n.companionMode = "STAY_NEAR";
      followCompanions(w);
      log(w, `${n.name} идёт рядом. Не обязан вмешиваться.`, "sys");
      return;
    }
    if (id === "mode_wait") {
      n.companionMode = "WAIT";
      log(w, `${n.name} ждёт. Остаётся субъектом мира.`, "sys");
      return;
    }
    if (id === "mode_guard") {
      n.companionMode = "GUARD";
      log(w, `${n.name} охраняет. Дальше scope не следует.`, "sys");
      return;
    }
    if (id === "order_work") {
      orderWork(w, n);
      return;
    }
    if (id === "ask_speed") {
      askSpeed(w);
      return;
    }
    if (id === "gift") {
      talkTopic(w, n, "gift");
      return;
    }
    if (id === "threaten") {
      n.fear = Math.min(100, n.fear + 15);
      bumpRelation(n, -3);
      w.threatenedCaptain = n.id.includes("captain") || w.threatenedCaptain;
      addHistory(w, {
        actorId: "player",
        action: "threaten",
        targetId: n.id,
        severity: "notable",
        text: `Угроза ${n.name}`,
        causeTrace: "coercion",
      });
      if (n.combatProfile === "VIOLENT" || n.combatProfile === "LOYAL_BRAVE") startCombat(w, n.id);
      else log(w, `${n.name} запоминает. Страх ${n.fear}.`, "alert");
      advanceTime(w, 5, "угроза");
      return;
    }
    if (id === "attack" || id === "kill" || id === "finish") {
      if (n.sleeping || !n.conscious) {
        n.hp = 0;
        killNpc(w, n, "Насилие в уязвимом состоянии. Спящий не был свидетелем — но тело будет.");
        w.criminalEvents.push({ time: w.worldTime, severity: "grave" });
        closeOverlay(w);
        advanceTime(w, 8, "насилие");
        return;
      }
      startCombat(w, n.id);
      return;
    }
    if (id === "wake_soft") {
      n.sleeping = false;
      bumpRelation(n, 1);
      log(w, `${n.name} просыпается. Теперь может быть свидетелем.`, "social");
      advanceTime(w, 5, "пробуждение");
      openDialogue(w, n);
      return;
    }
    if (id === "wake_kick") {
      n.sleeping = false;
      bumpRelation(n, -2);
      n.fear += 10;
      log(w, `${n.name} просыпается злостью.`, "alert");
      advanceTime(w, 2, "пинок");
      return;
    }
    if (id === "search") {
      const witnesses = presentNpcs(w).filter((x) => x.id !== n.id && !x.sleeping);
      if (witnesses.length) raiseAlert(w, "SUSPICION");
      log(w, `Обыск ${n.name}. ${n.inventory.length ? "Есть вещи." : "Пусто."}`, "obs");
      if (n.isSelma && n.hiddenGoal) {
        addKnowledge(w, {
          subjectId: n.id,
          proposition: "У Селмы в подкладке костяной образок. Цель ещё не ясна.",
          kind: "OBSERVATION",
          sourceType: "SELF",
          sourceId: "player",
          observedAt: w.worldTime,
          confidence: 0.8,
          epistemicState: "OBSERVED",
          scope: "selma",
          visibility: "SENSITIVE",
        });
      }
      advanceTime(w, 10, "обыск");
      addHistory(w, {
        actorId: "player",
        action: "search",
        targetId: n.id,
        severity: witnesses.length ? "notable" : "minor",
        text: `Обыск ${n.name}`,
        causeTrace: "search",
      });
      return;
    }
    if (id === "firstaid_npc") {
      medicalTreat(w, n.id, true);
      return;
    }
    if (id === "assign_task") {
      if (w.player.formalPower < 20 && w.background !== "tech" && w.background !== "admin") {
        log(w, "Назначать сервитора вне AUTHORITY_SCOPE нельзя. Попросите бригадира или помощника.", "alert");
      } else {
        log(w, `${n.name} поставлен в очередь. Он не согласился — у него нет согласия.`, "econ");
        if (!w.loading.active && w.phase === "planet") w.loading.active = true;
      }
      advanceTime(w, 10, "назначение");
      return;
    }
    if (id === "hide_body") {
      log(w, "Тело перемещено. Новые риски созданы.", "alert");
      raiseAlert(w, "SUSPICION");
      advanceTime(w, 20, "сокрытие");
      closeOverlay(w);
      return;
    }
  }

  // objects
  if (id === "sleep_rest") {
    applySleep(w, false);
    return;
  }
  if (id === "sleep_arrival") {
    applySleep(w, true);
    return;
  }
  if (id === "med_self") {
    medicalScan(w, "player");
    return;
  }
  if (id === "search_obj" || id === "pry") {
    if (id === "pry" && !w.playerInventory.includes("item_tool")) {
      log(w, "Нужен инструмент. Физическая реальность проверяема.", "alert");
      return;
    }
    if (targetId === "obj_crate" || targetId === "obj_seals") {
      addKnowledge(w, {
        subjectId: "service",
        proposition: "Пломбы срывали до вас. Кто-то ходил служебной зоной.",
        kind: "OBSERVATION",
        sourceType: "SELF",
        sourceId: "player",
        observedAt: w.worldTime,
        confidence: 0.8,
        epistemicState: "OBSERVED",
        scope: "small_service",
      });
      log(w, "Следы доступа. Не ваши.", "obs");
    }
    if (targetId === "obj_junk") {
      w.flags.hauled_side = true;
      const side = w.cargo.find((c) => c.kind === "side");
      if (side) side.locationId = w.playerLocationId;
      log(w, "Хлам теперь в вашей физической зоне ответственности.", "econ");
    }
    if (targetId === "obj_toolbox" && !w.playerInventory.includes("item_tool")) {
      w.playerInventory.push("item_tool");
      w.items.item_tool.custodyId = "player";
      log(w, "Инструмент у вас. Механик это может заметить.", "econ");
      bumpRelation(w.npcs.mech, -1);
    }
    advanceTime(w, id === "pry" ? 15 : 10, "поиск");
    return;
  }
  if (id === "read_papers") {
    addKnowledge(w, {
      subjectId: "nav",
      proposition: "В списке экипажа одна строка замазана. Рядом пометки навигации.",
      kind: "DOCUMENT",
      sourceType: "DOCUMENT",
      sourceId: "papers",
      observedAt: w.worldTime,
      confidence: 0.6,
      epistemicState: "OBSERVED",
      scope: "small_service",
    });
    log(w, "Документ: замазанная строка. Это сигнал, не кнопка пиратства.", "obs");
    advanceTime(w, 12, "чтение");
    return;
  }
  if (id === "look_nav") {
    addKnowledge(w, {
      subjectId: "nav",
      proposition: "Навигационный замок отделён. Обычный пассажир сюда не допускается.",
      kind: "OBSERVATION",
      sourceType: "SELF",
      sourceId: "player",
      observedAt: w.worldTime,
      confidence: 0.85,
      epistemicState: "OBSERVED",
      scope: "bridge",
    });
    if (presentNpcs(w).some((x) => x.isNavigator)) {
      addKnowledge(w, {
        subjectId: "nav",
        proposition: "Иллат Керн стоит у навигации так, будто это его место.",
        kind: "OBSERVATION",
        sourceType: "SELF",
        sourceId: "player",
        observedAt: w.worldTime,
        confidence: 0.7,
        epistemicState: "OBSERVED",
        scope: "bridge",
      });
    }
    advanceTime(w, 8, "навигация");
    return;
  }
  if (id === "start_exam") {
    w.overlay = { kind: "exam" };
    return;
  }
  if (id === "start_load") {
    w.loading.active = true;
    w.overlay = { kind: "loading" };
    log(w, "Погрузка идёт во времени. Тик 10 минут.", "econ");
    return;
  }
  if (id === "board_large") {
    tryBoardLarge(w);
    return;
  }
  if (id === "deliver") {
    tryDeliver(w);
    return;
  }
  if (id === "check_gear") {
    log(w, "Два рабочих скафандра, один пыльный. Аварийный ящик вскрывали.", "obs");
    advanceTime(w, 10, "проверка");
    return;
  }
  if (id === "check_cargo") {
    const main = w.cargo.find((c) => c.kind === "main");
    const side = w.cargo.find((c) => c.kind === "side");
    log(w, `Манифест: основной ${main?.progress ?? 0}% / хлам ${side?.locationId}.`, "econ");
    advanceTime(w, 10, "манифест");
    return;
  }
  closeOverlay(w);
}

function applyTrade(w: World, action: Extract<GameAction, { type: "TRADE" }>): void {
  const t = w.trade;
  if (!t) return;
  const n = npcById(w, t.npcId);
  if (action.kind === "leave") {
    t.state = "ABANDONED";
    if (n) bumpRelation(n, -1);
    log(w, "Торг оставлен.", "econ");
    w.trade = null;
    closeOverlay(w);
    return;
  }
  if (action.kind === "reject") {
    t.state = "REJECTED";
    log(w, "Отказ. Резерв не сошёлся.", "econ");
    w.trade = null;
    closeOverlay(w);
    return;
  }
  if (action.kind === "accept") {
    const price = t.lastCounter;
    if (w.player.money < price) {
      log(w, "Денег нет. Обещание создало бы долг — вы не предложили обещание.", "alert");
      return;
    }
    w.player.money -= price;
    t.state = "ACCEPTED";
    w.playerInventory.push(t.itemId);
    const it = w.items[t.itemId];
    if (it) {
      it.custodyId = "player";
      it.ownershipId = "player";
    }
    if (n) {
      n.cash += price;
      bumpRelation(n, 1);
    }
    log(w, `Сделка: ${t.itemName} за ${price}₡. Причина цены: ${t.cause}`, "econ");
    addHistory(w, {
      actorId: "player",
      action: "trade",
      targetId: t.npcId,
      severity: "minor",
      text: `Купля ${t.itemName}`,
      causeTrace: t.cause,
    });
    w.trade = null;
    closeOverlay(w);
    advanceTime(w, 10, "сделка");
    return;
  }
  if (action.kind === "offer") {
    const amount = action.amount ?? t.lastCounter;
    t.offered = amount;
    t.rounds += 1;
    t.state = "OFFERED";
    if (t.rounds > t.maxRounds) {
      t.state = "REJECTED";
      if (n) bumpRelation(n, -2);
      log(w, "Слишком много кругов. Торг закрыт, отношение испорчено.", "econ");
      w.trade = null;
      closeOverlay(w);
      return;
    }
    if (amount >= t.ask) {
      t.lastCounter = amount;
      applyTrade(w, { type: "TRADE", kind: "accept" });
      return;
    }
    if (amount < t.reserve) {
      t.state = "COUNTERED";
      t.lastCounter = Math.round((t.lastCounter + t.reserve) / 2);
      log(w, `${n?.name}: контрпредложение ${t.lastCounter}₡. Резерв не озвучен, но он есть.`, "econ");
    } else {
      t.state = "COUNTERED";
      t.lastCounter = amount;
      log(w, `${n?.name} почти согласен. ${amount}₡ близко к приемлемому.`, "econ");
    }
    advanceTime(w, 8, "торг");
  }
}

export function neighborsOf(w: World): LocationDefPublic[] {
  const loc = w.locations[w.playerLocationId];
  if (!loc) return [];
  return loc.neighbors
    .map((id) => w.locations[id])
    .filter(Boolean)
    .map((l) => ({ id: l!.id, name: l!.name, access: l!.access }));
}

export type LocationDefPublic = { id: string; name: string; access: string };

export function locationsInPhase(w: World) {
  return Object.values(w.locations).filter((l) => l.area === w.phase);
}

