import { allLocations, BACKGROUNDS, PLANETS, REASONS, RESOURCES, STATIONS, START_TIME, SYSTEMS } from "./content";
import { hashSeed, makeSeedTag, mulberry32, rngInt, rngPick, type Rng } from "./rng";
import type {
  Assignment,
  BackgroundId,
  CargoLot,
  ExamState,
  Item,
  KnowledgeEntry,
  LocationDef,
  Npc,
  World,
} from "./types";

function item(partial: Item): Item {
  return partial;
}

function knowledge(partial: KnowledgeEntry): KnowledgeEntry {
  return partial;
}

function sched(blocks: [number, number, string][]): Npc["schedule"] {
  return blocks.map(([start, end, locationId]) => ({ start, end, locationId }));
}

function baseNpc(p: Partial<Npc> & Pick<Npc, "id" | "name" | "role" | "locationId" | "area">): Npc {
  return {
    faction: "Independent",
    actorClass: "AGENT",
    homeLocationId: p.locationId,
    alive: true,
    conscious: true,
    sleeping: false,
    hp: 100,
    fatigue: rngish(p.id, 10, 40),
    relation: 0,
    trust: 20,
    fear: 5,
    debt: 0,
    status: 30,
    formalPower: 10,
    informalInfluence: 15,
    contactStage: "STRANGER",
    askedTopics: {},
    pendingQuestion: null,
    personalRevealed: 0,
    schedule: [],
    goals: ["дожить до порта"],
    values: ["своё место"],
    quirks: [],
    hiddenGoal: null,
    hiddenGoalKnown: false,
    combatProfile: "CAUTIOUS",
    companionMode: "NONE",
    isCompanion: false,
    isSocialGuide: false,
    isSelma: false,
    isMemoryGap: false,
    isNavigator: false,
    remembersPlayerAs: null,
    inventory: [],
    pathologies: [],
    lastTalkAt: -999,
    lastExplainAt: -999,
    cash: 40,
    askPriceMod: 1,
    reservePriceMod: 0.7,
    marketKnowledge: 30,
    urgency: 20,
    riskTolerance: 30,
    hasTrade: false,
    tradeItemId: null,
    moodLine: "Смотрит мимо.",
    access: "low",
    ...p,
  };
}

function rngish(id: string, min: number, max: number): number {
  const n = hashSeed(id) % (max - min + 1);
  return min + n;
}

function makeAssignment(rng: Rng): Assignment {
  const planetEta = START_TIME + 14 * 60;
  const stationDeadline = 24 * 60 + 11 * 60 + 30; // Д2 11:30
  return {
    system: rngPick(rng, SYSTEMS),
    planet: rngPick(rng, PLANETS),
    station: rngPick(rng, STATIONS),
    resource: rngPick(rng, RESOURCES),
    quantity: rngPick(rng, [40, 48, 56, 60]),
    reason: rngPick(rng, REASONS),
    planetEta,
    stationDeadline,
  };
}

function companionFor(bg: BackgroundId): { guide: Omit<Npc, keyof ReturnType<typeof baseNpc>> | null } {
  void bg;
  return { guide: null };
}

function makeNpcs(rng: Rng, bg: BackgroundId, locations: Record<string, LocationDef>): Record<string, Npc> {
  void companionFor;
  void locations;
  const npcs: Record<string, Npc> = {};

  const guideNames: Record<BackgroundId, [string, string, string]> = {
    heir: ["Тарен Велл", "семейный поверенный", "Напоминает, кто здесь формально главный, а кто — нет."],
    admin: ["Сержант Холл", "адъютант", "Читает иерархию как устав. Не всегда верно читает людей."],
    trader: ["Мира Сол", "фиксёр", "Видит цены и долги раньше лиц."],
    tech: ["Адепт Кел", "младший техжрец", "Объясняет, кому нельзя приказывать как машине."],
    local: ["Ринн Даш", "проводница", "Знает, кого на Иридоне слушают шёпотом."],
    stranger: ["Вейл", "наёмный проводник", "Помогает за деньги. Не за дружбу."],
  };
  const secondNames: Record<BackgroundId, [string, string]> = {
    heir: ["Браск", "телохранитель"],
    admin: ["Писец Орм", "делопроизводитель"],
    trader: ["Товк", "носильщик"],
    tech: ["Юн", "младший техник"],
    local: ["Гар", "грузчик"],
    stranger: ["Крот", "наёмная сила"],
  };

  const [gName, gRole, gMood] = guideNames[bg];
  const [sName, sRole] = secondNames[bg];

  npcs.guide = baseNpc({
    id: "guide",
    name: gName,
    role: gRole,
    faction: bg === "admin" ? "Guard" : bg === "tech" ? "Mechanicus" : "Independent",
    locationId: "small_common",
    area: "small_ship",
    isCompanion: true,
    isSocialGuide: true,
    companionMode: "STAY_NEAR",
    relation: bg === "stranger" ? 1 : 3,
    trust: bg === "stranger" ? 25 : 45,
    status: 40,
    informalInfluence: 55,
    combatProfile: "CAUTIOUS",
    goals: ["довести игрока живым", "не потерять своё место"],
    values: ["осторожность", "ясность"],
    quirks: ["говорит коротко", "замечает ранги"],
    moodLine: gMood,
    access: "low",
    schedule: sched([
      [0, 420, "small_cabin"],
      [420, 1320, "small_common"],
      [1320, 1440, "small_cabin"],
    ]),
  });

  npcs.second = baseNpc({
    id: "second",
    name: sName,
    role: sRole,
    locationId: "small_common",
    area: "small_ship",
    isCompanion: true,
    companionMode: "JOIN_ACTIVE",
    relation: 2,
    trust: 30,
    combatProfile: bg === "heir" || bg === "stranger" ? "LOYAL_BRAVE" : "SELF_INTERESTED",
    goals: ["выполнить поручение", "не влипнуть"],
    quirks: ["ждёт приказа", "смотрит на руки"],
    moodLine: "Держится чуть сзади.",
    schedule: sched([
      [0, 360, "small_cabin"],
      [360, 1260, "small_common"],
      [1260, 1440, "small_cabin"],
    ]),
  });

  npcs.captain = baseNpc({
    id: "captain",
    name: "Капитан Воррен",
    role: "капитан малого корабля",
    faction: "Crew",
    locationId: "small_bridge",
    area: "small_ship",
    status: 70,
    formalPower: 80,
    informalInfluence: 60,
    access: "high",
    combatProfile: "CAUTIOUS",
    goals: ["доставить корабль по расписанию", "не влезать в чужие квоты"],
    values: ["порядок", "корабль"],
    quirks: ["не любит пассажиров на мостике"],
    moodLine: "Смотрит в курс, не в вас.",
    schedule: sched([
      [360, 1320, "small_bridge"],
      [1320, 360, "small_cabin"],
    ]),
  });

  npcs.pilot = baseNpc({
    id: "pilot",
    name: "Мека Рун",
    role: "пилот",
    faction: "Crew",
    locationId: "small_bridge",
    area: "small_ship",
    status: 45,
    formalPower: 40,
    fatigue: 62,
    quirks: ["трёт глаза", "пьёт холодный рекаф"],
    moodLine: "Устала. Руки точные.",
    schedule: sched([
      [360, 1080, "small_bridge"],
      [1080, 1320, "small_common"],
      [1320, 360, "small_cabin"],
    ]),
  });

  npcs.mech = baseNpc({
    id: "mech",
    name: "Дрел Ковш",
    role: "механик",
    faction: "Mechanicus",
    locationId: "small_engine",
    area: "small_ship",
    status: 35,
    informalInfluence: 50,
    access: "medium",
    quirks: ["пахнет маслом", "не любит весёлых людей без причины"],
    goals: ["чтобы трубы не свистели", "чтобы пассажиры не лезли"],
    moodLine: "Говорит с машиной громче, чем с людьми.",
    schedule: sched([
      [420, 1200, "small_engine"],
      [1200, 1320, "small_common"],
      [1320, 420, "small_cabin"],
    ]),
  });

  npcs.selma = baseNpc({
    id: "selma",
    name: "Селма Тарквин",
    role: "стюардесса",
    faction: "Crew",
    locationId: "small_common",
    area: "small_ship",
    isSelma: true,
    status: 28,
    informalInfluence: 40,
    relation: 1,
    hiddenGoal: "провезти костяной образок мимо досмотра и передать человеку на большом корабле",
    quirks: ["улыбается пассажирам", "напевает", "держит странно бодрый тон"],
    goals: ["чтобы никто не скучал", "своя тихая цель"],
    values: ["тепло", "секрет"],
    moodLine: "Улыбается так, будто коридор — праздник.",
    combatProfile: "RELIGIOUS_RESTRAINED",
    schedule: sched([
      [420, 1260, "small_common"],
      [1260, 420, "small_cabin"],
    ]),
  });

  npcs.memory = baseNpc({
    id: "memory",
    name: "Кален Дрост",
    role: "пассажир",
    faction: "Independent",
    locationId: "small_common",
    area: "small_ship",
    isMemoryGap: true,
    remembersPlayerAs: "сослуживец с Варнака",
    status: 32,
    relation: 2,
    quirks: ["смотрит слишком узнающе", "путает детали"],
    goals: ["вспомнить, почему вы важны", "не выглядеть сумасшедшим"],
    moodLine: "Кивает вам так, будто вы уже здоровались сто раз.",
    schedule: sched([
      [480, 600, "small_cabin"],
      [600, 1080, "small_common"],
      [1080, 1200, "small_corridor"],
      [1200, 480, "small_cabin"],
    ]),
  });

  npcs.nav = baseNpc({
    id: "nav",
    name: "Иллат Керн",
    role: "пассажир",
    faction: "Independent",
    locationId: "small_corridor",
    area: "small_ship",
    isNavigator: true,
    access: "medium",
    status: 22,
    quirks: ["бледный", "не ест в общей зоне", "стоит у двери мостика"],
    goals: ["не быть замеченным", "дотянуть до большого корабля"],
    hiddenGoal: "сохранить навигационный дар в тайне до нужного перехода",
    moodLine: "Смотрит в металл, не в людей.",
    pathologies: [{ id: "eye", name: "напряжение глаз", severity: 20, treated: false }],
    schedule: sched([
      [0, 480, "small_cabin"],
      [480, 900, "small_corridor"],
      [900, 1020, "small_bridge"],
      [1020, 1200, "small_corridor"],
      [1200, 1440, "small_cabin"],
    ]),
  });

  npcs.merchant = baseNpc({
    id: "merchant",
    name: "Хада Сив",
    role: "коробейник",
    faction: "Trade Houses",
    locationId: "small_common",
    area: "small_ship",
    hasTrade: true,
    tradeItemId: "item_charm",
    cash: 200,
    askPriceMod: 1.25,
    reservePriceMod: 0.85,
    marketKnowledge: 70,
    urgency: 35,
    riskTolerance: 40,
    status: 44,
    quirks: ["оценивает карманы", "не торгуется, если видит добычу"],
    moodLine: "Уже считает, клиент вы, равный или добыча.",
    goals: ["продать дороже", "не влезть в чужой долг"],
    schedule: sched([
      [480, 1260, "small_common"],
      [1260, 480, "small_cabin"],
    ]),
  });

  npcs.guardp = baseNpc({
    id: "guardp",
    name: "Ветеран Столб",
    role: "пассажир, бывший гвардеец",
    faction: "Guard",
    locationId: "small_common",
    area: "small_ship",
    combatProfile: "LOYAL_BRAVE",
    status: 40,
    formalPower: 15,
    quirks: ["спит сидя", "не любит, когда шутят про устав"],
    moodLine: "Считает выходы.",
    schedule: sched([
      [0, 540, "small_cabin"],
      [540, 780, "small_common"],
      [780, 960, "small_corridor"],
      [960, 1200, "small_common"],
      [1200, 1440, "small_cabin"],
    ]),
  });

  npcs.clerk = baseNpc({
    id: "clerk",
    name: "Писарь Эндл",
    role: "клерк Администратума",
    faction: "Administratum",
    locationId: "small_common",
    area: "small_ship",
    status: 50,
    formalPower: 45,
    quirks: ["правит чужие формулировки", "боится опоздать к дедлайну"],
    moodLine: "Говорит штампами.",
    schedule: sched([
      [480, 1100, "small_common"],
      [1100, 480, "small_cabin"],
    ]),
  });

  npcs.workerp = baseNpc({
    id: "workerp",
    name: "Йол",
    role: "рабочий",
    faction: "Independent",
    locationId: "small_common",
    area: "small_ship",
    status: 12,
    pathologies: [{ id: "rib", name: "ушиб бока", severity: 25, treated: false }],
    hp: 78,
    quirks: ["не смотрит начальству в глаза"],
    moodLine: "Держит бок рукой, когда думает, что никто не видит.",
    schedule: sched([
      [0, 600, "small_cabin"],
      [600, 1180, "small_common"],
      [1180, 1440, "small_cabin"],
    ]),
  });

  npcs.examiner = baseNpc({
    id: "examiner",
    name: "Экзаменатор Кват",
    role: "экзаменатор допуска",
    faction: "Administratum",
    locationId: "planet_exam",
    area: "planet",
    status: 60,
    formalPower: 65,
    quirks: ["не поднимает глаз от бумаги"],
    moodLine: "Вы — ещё одна строка.",
    schedule: sched([[480, 1200, "planet_exam"]]),
  });

  npcs.dockboss = baseNpc({
    id: "dockboss",
    name: "Бригадир Унн",
    role: "бригадир дока",
    faction: "Local Elites",
    locationId: "planet_dock",
    area: "planet",
    status: 48,
    informalInfluence: 70,
    formalPower: 40,
    quirks: ["формально подчиняется, фактически здесь хозяин"],
    moodLine: "Рабочие смотрят на него, не на вашу бумагу.",
    goals: ["закрыть смену без крови", "не отдать кран чужому"],
    schedule: sched([[420, 1260, "planet_dock"]]),
  });

  npcs.serv1 = baseNpc({
    id: "serv1",
    name: "Сервитор А-12",
    role: "погрузчик",
    faction: "Mechanicus",
    actorClass: "NON_AGENT_EXECUTOR",
    locationId: "planet_dock",
    area: "planet",
    status: 0,
    moodLine: "Ждёт задачу. Не передумает.",
    schedule: sched([[0, 1440, "planet_dock"]]),
  });

  npcs.serv2 = baseNpc({
    id: "serv2",
    name: "Сервитор Б-7",
    role: "погрузчик",
    faction: "Mechanicus",
    actorClass: "NON_AGENT_EXECUTOR",
    locationId: "planet_dock",
    area: "planet",
    status: 0,
    moodLine: "Индикатор горит. Очередь пуста.",
    schedule: sched([[0, 1440, "planet_dock"]]),
  });

  npcs.doc_p = baseNpc({
    id: "doc_p",
    name: "Медик Шав",
    role: "врач",
    faction: "Independent",
    locationId: "planet_med",
    area: "planet",
    status: 40,
    cash: 80,
    quirks: ["считает сначала деньги, потом рану"],
    moodLine: "Очередь живая.",
    schedule: sched([[480, 1200, "planet_med"]]),
  });

  npcs.barkeep = baseNpc({
    id: "barkeep",
    name: "Хозяин Триг",
    role: "хозяин «Трёх гвоздей»",
    faction: "Criminal Networks",
    locationId: "planet_tavern",
    area: "planet",
    hasTrade: true,
    tradeItemId: "item_rumor",
    askPriceMod: 1.1,
    reservePriceMod: 0.6,
    informalInfluence: 65,
    quirks: ["слух дешевле выпивки, если вы ему интересны"],
    moodLine: "Протирает кружку, которой не пользуется.",
    schedule: sched([[540, 1380, "planet_tavern"]]),
  });

  npcs.gunner = baseNpc({
    id: "gunner",
    name: "Продавец Реш",
    role: "оружейник",
    faction: "Independent",
    locationId: "planet_guns",
    area: "planet",
    hasTrade: true,
    tradeItemId: "item_pistol_shop",
    askPriceMod: 1.4,
    reservePriceMod: 0.95,
    riskTolerance: 15,
    quirks: ["смотрит на руки"],
    moodLine: "Решётка между вами — не декорация.",
    schedule: sched([[540, 1140, "planet_guns"]]),
  });

  npcs.l_captain = baseNpc({
    id: "l_captain",
    name: "Капитан Йорн Хекс",
    role: "капитан большого корабля",
    faction: "Crew",
    locationId: "large_bridge",
    area: "large_ship",
    status: 85,
    formalPower: 90,
    access: "high",
    combatProfile: "CAUTIOUS",
    goals: ["расписание", "не стать соучастником"],
    quirks: ["торгуется временем, не улыбкой"],
    moodLine: "У него свои обязательства. Ваши — ваши.",
    schedule: sched([[360, 1320, "large_bridge"]]),
  });

  npcs.l_merchant = baseNpc({
    id: "l_merchant",
    name: "Лавочница Ода",
    role: "торговка ряда",
    faction: "Trade Houses",
    locationId: "large_market",
    area: "large_ship",
    hasTrade: true,
    tradeItemId: "item_stim",
    askPriceMod: 1.3,
    reservePriceMod: 0.8,
    marketKnowledge: 80,
    urgency: 25,
    quirks: ["называет цену и ждёт, кто моргнёт"],
    moodLine: "Контрафакт стоит рядом с пайками.",
    schedule: sched([[480, 1260, "large_market"]]),
  });

  npcs.preacher = baseNpc({
    id: "preacher",
    name: "Проповедник Ивл",
    role: "проповедник",
    faction: "Ecclesiarchy",
    locationId: "large_chapel",
    area: "large_ship",
    combatProfile: "RELIGIOUS_RESTRAINED",
    status: 55,
    informalInfluence: 60,
    quirks: ["слышит грех раньше слов"],
    moodLine: "Свеча между вами.",
    schedule: sched([[480, 1200, "large_chapel"]]),
  });

  npcs.l_doc = baseNpc({
    id: "l_doc",
    name: "Судовой медик Тар",
    role: "врач",
    faction: "Crew",
    locationId: "large_med",
    area: "large_ship",
    schedule: sched([[480, 1200, "large_med"]]),
    moodLine: "Автодок скрипит громче него.",
  });

  npcs.receiver = baseNpc({
    id: "receiver",
    name: "Приёмщик Нолль",
    role: "приёмщик груза",
    faction: "Administratum",
    locationId: "st_recv",
    area: "station",
    status: 50,
    formalPower: 55,
    quirks: ["без физического груза подписи нет"],
    moodLine: "Планшет важнее вашего лица.",
    schedule: sched([[480, 1200, "st_recv"]]),
  });

  npcs.deputy = baseNpc({
    id: "deputy",
    name: "Зам Ольг",
    role: "заместитель по отчётности",
    faction: "Administratum",
    locationId: "st_acc",
    area: "station",
    status: 70,
    formalPower: 75,
    quirks: ["вы — ещё один отчёт"],
    moodLine: "Не поднимает голову, пока не увидит цифры.",
    schedule: sched([[480, 1140, "st_acc"]]),
  });

  npcs.st_bar = baseNpc({
    id: "st_bar",
    name: "Бармен Кашь",
    role: "бармен",
    faction: "Criminal Networks",
    locationId: "st_bar",
    area: "station",
    hasTrade: true,
    tradeItemId: "item_drink",
    informalInfluence: 50,
    moodLine: "Слухи дешевле выпивки.",
    schedule: sched([[600, 1440, "st_bar"]]),
  });

  npcs.st_doc = baseNpc({
    id: "st_doc",
    name: "Станционный медик Вен",
    role: "врач",
    faction: "Independent",
    locationId: "st_med",
    area: "station",
    schedule: sched([[480, 1200, "st_med"]]),
    moodLine: "Очередь длиннее, лекарства есть.",
  });

  // slight rng jitter on relations
  for (const n of Object.values(npcs)) {
    n.fatigue = Math.min(90, n.fatigue + rngInt(rng, -5, 8));
    n.cash += rngInt(rng, -10, 20);
  }

  return npcs;
}

function makeItems(bg: BackgroundId): Record<string, Item> {
  const items: Record<string, Item> = {};
  const add = (it: Item) => {
    items[it.id] = it;
  };
  add(item({ id: "item_key", name: "Ключ-карта", type: "key", mass: 0.1, condition: 80, value: 20, risk: 0, locationId: "player", custodyId: "player", ownershipId: "player", methods: ["open"], notes: "Средний доступ." }));
  add(item({ id: "item_credits", name: "Кредитная карта", type: "money", mass: 0.1, condition: 100, value: 0, risk: 0, locationId: "player", custodyId: "player", ownershipId: "player", methods: [], notes: "" }));
  add(item({ id: "item_docs", name: "Документы назначения", type: "document", mass: 0.2, condition: 100, value: 0, risk: 0, locationId: "player", custodyId: "player", ownershipId: "player", methods: ["show"], notes: "System, planet, station, квота." }));
  add(item({ id: "item_medkit", name: "Аптечка", type: "med", mass: 1, condition: 100, value: 40, risk: 0, locationId: "player", custodyId: "player", ownershipId: "player", methods: ["firstaid"], notes: "Первая помощь. Не заменяет медблок." }));
  add(item({ id: "item_knife", name: "Нож", type: "weapon", mass: 0.4, condition: 90, value: 15, risk: 20, locationId: "player", custodyId: "player", ownershipId: "player", methods: ["cut", "threaten"], notes: "" }));
  add(item({ id: "item_charm", name: "Костяной образок", type: "oddity", mass: 0.2, condition: 70, value: 90, risk: 25, locationId: "merchant", custodyId: "merchant", ownershipId: "merchant", methods: ["trade"], notes: "Хаду Сив держит в рукаве." }));
  add(item({ id: "item_stim", name: "Стимулятор", type: "med", mass: 0.1, condition: 100, value: 55, risk: 10, locationId: "l_merchant", custodyId: "l_merchant", ownershipId: "l_merchant", methods: ["trade"], notes: "" }));
  add(item({ id: "item_pistol_shop", name: "Пистолет с витрины", type: "weapon", mass: 1.2, condition: 85, value: 140, risk: 40, locationId: "gunner", custodyId: "gunner", ownershipId: "gunner", methods: ["trade"], notes: "" }));
  add(item({ id: "item_rumor", name: "Имя на салфетке", type: "info", mass: 0, condition: 100, value: 25, risk: 5, locationId: "barkeep", custodyId: "barkeep", ownershipId: "barkeep", methods: ["trade"], notes: "Слух. Не истина мира." }));
  add(item({ id: "item_drink", name: "Мутная чарка", type: "consumable", mass: 0.3, condition: 100, value: 8, risk: 0, locationId: "st_bar", custodyId: "st_bar", ownershipId: "st_bar", methods: ["trade"], notes: "" }));
  add(item({ id: "item_junk", name: "Попутный хлам", type: "cargo", mass: 12, condition: 50, value: 10, risk: 0, locationId: "small_service", custodyId: "world", ownershipId: "player", methods: ["haul"], notes: "Не телепортируется." }));
  add(item({ id: "item_sleep", name: "Снотворное", type: "med", mass: 0.1, condition: 100, value: 12, risk: 5, locationId: "player", custodyId: "player", ownershipId: "player", methods: ["sleep"], notes: "" }));

  if (bg === "heir") {
    add(item({ id: "item_letter", name: "Семейное письмо", type: "document", mass: 0.1, condition: 100, value: 0, risk: 0, locationId: "player", custodyId: "player", ownershipId: "player", methods: ["show"], notes: "Открывает некоторые двери элит." }));
  }
  if (bg === "admin") {
    add(item({ id: "item_warrant", name: "Служебный ордер", type: "document", mass: 0.1, condition: 100, value: 0, risk: 0, locationId: "player", custodyId: "player", ownershipId: "player", methods: ["show", "command"], notes: "Формальный канал в пределах scope." }));
  }
  if (bg === "tech") {
    add(item({ id: "item_tool", name: "Инструмент", type: "tool", mass: 2, condition: 90, value: 35, risk: 0, locationId: "player", custodyId: "player", ownershipId: "player", methods: ["repair", "pry"], notes: "Техдоступ и взлом замка." }));
  } else {
    add(item({ id: "item_tool", name: "Лом-ключ", type: "tool", mass: 1.5, condition: 60, value: 12, risk: 10, locationId: "small_service", custodyId: "world", ownershipId: "crew", methods: ["repair", "pry"], notes: "Лежит в служебной зоне." }));
  }
  if (bg === "trader") {
    add(item({ id: "item_ledger", name: "Карманная ведомость", type: "document", mass: 0.2, condition: 100, value: 0, risk: 0, locationId: "player", custodyId: "player", ownershipId: "player", methods: ["show"], notes: "Рыночное знание." }));
  }
  return items;
}

function startingInventory(bg: BackgroundId, items: Record<string, Item>): string[] {
  const ids = ["item_key", "item_credits", "item_docs", "item_medkit", "item_knife", "item_sleep"];
  if (items.item_letter) ids.push("item_letter");
  if (items.item_warrant) ids.push("item_warrant");
  if (bg === "tech") ids.push("item_tool");
  if (items.item_ledger) ids.push("item_ledger");
  return ids;
}

function startingKnowledge(bg: BackgroundId, a: Assignment, t: number): KnowledgeEntry[] {
  const k: KnowledgeEntry[] = [
    knowledge({
      id: "k_assign",
      ownerId: "player",
      subjectId: "assignment",
      proposition: `Назначение: ${a.system} / ${a.planet} / ${a.station}. Груз: ${a.quantity} т ${a.resource}.`,
      kind: "DOCUMENT",
      sourceType: "DOCUMENT",
      sourceId: "item_docs",
      observedAt: t,
      confidence: 1,
      epistemicState: "CONFIRMED",
      scope: "mission",
      derivedFrom: [],
      contradicts: [],
      invalidatedBy: [],
      lastVerifiedAt: t,
      visibility: "SHAREABLE",
      notes: a.reason,
    }),
  ];
  if (bg === "local") {
    k.push(knowledge({
      id: "k_local",
      ownerId: "player",
      subjectId: "planet",
      proposition: "На этой планете бригадир дока важнее печати на бумаге.",
      kind: "EXPERIENCE",
      sourceType: "SELF",
      sourceId: "player",
      observedAt: t,
      confidence: 0.7,
      epistemicState: "OBSERVED",
      scope: "planet",
      derivedFrom: [],
      contradicts: [],
      invalidatedBy: [],
      lastVerifiedAt: t,
      visibility: "PLAYER_ONLY",
      notes: "",
    }));
  }
  return k;
}

function cargo(a: Assignment): CargoLot[] {
  return [
    { id: "main", name: `Основной груз (${a.resource})`, kind: "main", tons: a.quantity, progress: 0, loaded: false, received: false, locationId: "planet_dock" },
    { id: "side", name: "Попутный хлам", kind: "side", tons: 4, progress: 0, loaded: false, received: false, locationId: "small_service" },
  ];
}

const emptyExam: ExamState = {
  stage: 1,
  s1: 0,
  s2: 0,
  s3: 0,
  alloc: [1.5, 1.5, 1.5, 1.5],
  jobs: [0, 1, 0],
  passed: false,
  attempts: 0,
  talked: false,
};

export function createWorld(masterSeed: string, background: BackgroundId | null): World {
  const rng = mulberry32(hashSeed(masterSeed + "|root"));
  const assignment = makeAssignment(rng);
  const locs = Object.fromEntries(allLocations().map((l) => [l.id, l]));
  const bg = background ?? "stranger";
  const pack = BACKGROUNDS.find((b) => b.id === bg)!;
  const items = makeItems(bg);
  const npcs = background ? makeNpcs(rng, bg, locs) : {};

  return {
    version: 1,
    masterSeed,
    rngState: hashSeed(masterSeed + "|stream"),
    worldTime: START_TIME,
    screen: background ? "assignment" : "background",
    phase: "small_ship",
    background,
    assignment,
    playerLocationId: "small_cabin",
    player: {
      name: "Вы",
      hp: 100,
      fatigue: 18,
      stress: 12,
      hunger: 20,
      sleepDebt: 0,
      warpExposure: 4,
      money: pack.money,
      access: pack.access,
      formalPower: pack.power,
      status: pack.status,
    },
    npcs,
    locations: locs,
    knowledge: background ? startingKnowledge(bg, assignment, START_TIME) : [],
    history: [],
    items,
    playerInventory: background ? startingInventory(bg, items) : [],
    cargo: cargo(assignment),
    ships: {
      small: {
        id: "small",
        name: "Малый пассажирский",
        control: "OWNER_CONTROL",
        capability: 20,
        status: "EN_ROUTE",
        crewCount: 4,
        navigatorId: null,
        navigationAccess: false,
        destination: assignment.planet,
        eta: assignment.planetEta,
      },
      large: {
        id: "large",
        name: "Большой перевозчик",
        control: "AUTHORITY_CONTROL",
        capability: 80,
        status: "WAITING_DOCK",
        crewCount: 48,
        navigatorId: "nav",
        navigationAccess: false,
        destination: assignment.station,
        eta: assignment.stationDeadline - 90,
      },
    },
    alert: "LOW",
    combat: { active: false, round: 0, participantIds: [], turn: "player", log: [], enemyIds: [] },
    trade: null,
    exam: { ...emptyExam },
    loading: { active: false, tick: 0, incident: null, paused: false },
    overlay: { kind: "none" },
    pdaTab: "map",
    inspectId: null,
    dialogueNpcId: null,
    dialogueOptions: [],
    log: [
      {
        id: "log0",
        time: START_TIME,
        text: "WORLD_TIME запущен. Мир не ждёт.",
        tone: "sys",
      },
    ],
    pendingEvent: null,
    lastCallbackAt: -999,
    travelDurationBase: 9 * 60,
    captainRelation: 0,
    threatenedCaptain: false,
    accelerated: 0,
    examUnlocked: false,
    boardedLarge: false,
    report: null,
    lossOfNormalAuthority: false,
    criminalEvents: [],
    flags: {},
  };
}

export function freshSeed(): string {
  const rng = mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  return makeSeedTag(rng);
}
