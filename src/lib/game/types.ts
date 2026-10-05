export type Screen = "title" | "background" | "assignment" | "play" | "report";

export type Phase = "small_ship" | "planet" | "large_ship" | "station";

export type BackgroundId =
  | "heir"
  | "admin"
  | "trader"
  | "tech"
  | "local"
  | "stranger";

export type ContactStage = "STRANGER" | "GREETED" | "ACQUAINTED" | "TRUSTED";

export type AlertLevel = "LOW" | "SUSPICION" | "ALERT" | "ORGANIZED";

export type EpistemicState =
  | "UNKNOWN"
  | "OBSERVED"
  | "CONFIRMED"
  | "CONTRADICTED"
  | "INVALIDATED";

export type KnowledgeKind =
  | "OBSERVATION"
  | "INFERENCE"
  | "REPORT"
  | "DOCUMENT"
  | "EXPERIENCE";

export type CompanionMode =
  | "JOIN_ACTIVE"
  | "STAY_NEAR"
  | "GUARD"
  | "WAIT"
  | "RETREAT"
  | "NONE";

export type ActorClass = "AGENT" | "NON_AGENT_EXECUTOR";

export type CombatProfile =
  | "LOYAL_BRAVE"
  | "CAUTIOUS"
  | "COWARD_SURVIVALIST"
  | "VIOLENT"
  | "RELIGIOUS_RESTRAINED"
  | "SELF_INTERESTED";

export type TradeState =
  | "OPEN"
  | "OFFERED"
  | "COUNTERED"
  | "ACCEPTED"
  | "REJECTED"
  | "ABANDONED";

export type Overlay =
  | { kind: "none" }
  | { kind: "inspect"; targetId: string }
  | { kind: "dialogue"; npcId: string }
  | { kind: "trade"; npcId: string }
  | { kind: "combat" }
  | { kind: "medical"; patientId: string }
  | { kind: "exam" }
  | { kind: "loading" }
  | { kind: "sleep" }
  | { kind: "event"; eventId: string }
  | { kind: "pda" }
  | { kind: "report" };

export type PdaTab =
  | "map"
  | "people"
  | "tasks"
  | "economy"
  | "factions"
  | "chronicle"
  | "inventory";

export type AuthorityChannel =
  | "DIRECT_COMMAND"
  | "DELEGATION"
  | "REQUEST"
  | "PETITION"
  | "NEGOTIATION"
  | "COERCION"
  | "INFORMATION";

export type ScheduleBlock = {
  start: number;
  end: number;
  locationId: string;
};

export type Pathology = {
  id: string;
  name: string;
  severity: number;
  treated: boolean;
};

export type KnowledgeEntry = {
  id: string;
  ownerId: string;
  subjectId: string;
  proposition: string;
  value?: string;
  kind: KnowledgeKind;
  sourceType: string;
  sourceId: string;
  observedAt: number;
  confidence: number;
  epistemicState: EpistemicState;
  scope: string;
  derivedFrom: string[];
  contradicts: string[];
  invalidatedBy: string[];
  lastVerifiedAt: number;
  visibility: "PLAYER_ONLY" | "SHAREABLE" | "SENSITIVE";
  notes: string;
};

export type HistoryEvent = {
  id: string;
  time: number;
  locationId: string;
  actorId: string;
  action: string;
  targetId: string;
  severity: "minor" | "notable" | "grave";
  witnesses: string[];
  spread: number;
  text: string;
  appliedCallbacks: string[];
  causeTrace: string;
};

export type Item = {
  id: string;
  name: string;
  type: string;
  mass: number;
  condition: number;
  value: number;
  risk: number;
  locationId: string;
  custodyId: string;
  ownershipId: string;
  methods: string[];
  notes: string;
};

export type Npc = {
  id: string;
  name: string;
  role: string;
  faction: string;
  actorClass: ActorClass;
  locationId: string;
  homeLocationId: string;
  area: Phase;
  alive: boolean;
  conscious: boolean;
  sleeping: boolean;
  hp: number;
  fatigue: number;
  relation: number;
  trust: number;
  fear: number;
  debt: number;
  status: number;
  formalPower: number;
  informalInfluence: number;
  contactStage: ContactStage;
  askedTopics: Record<string, number>;
  pendingQuestion: string | null;
  personalRevealed: number;
  schedule: ScheduleBlock[];
  goals: string[];
  values: string[];
  quirks: string[];
  hiddenGoal: string | null;
  hiddenGoalKnown: boolean;
  combatProfile: CombatProfile;
  companionMode: CompanionMode;
  isCompanion: boolean;
  isSocialGuide: boolean;
  isSelma: boolean;
  isMemoryGap: boolean;
  isNavigator: boolean;
  remembersPlayerAs: string | null;
  inventory: string[];
  pathologies: Pathology[];
  lastTalkAt: number;
  lastExplainAt: number;
  cash: number;
  askPriceMod: number;
  reservePriceMod: number;
  marketKnowledge: number;
  urgency: number;
  riskTolerance: number;
  hasTrade: boolean;
  tradeItemId: string | null;
  moodLine: string;
  access: "low" | "medium" | "high";
};

export type LocationDef = {
  id: string;
  name: string;
  area: Phase;
  access: "all" | "medium" | "restricted";
  scene: string;
  short: string;
  detail: string;
  neighbors: string[];
  moveMinutes: number;
  objects: Inspectable[];
};

export type Inspectable = {
  id: string;
  name: string;
  kind: "object" | "npc" | "exit";
  description: string;
};

export type CargoLot = {
  id: string;
  name: string;
  kind: "main" | "side";
  tons: number;
  progress: number;
  loaded: boolean;
  received: boolean;
  locationId: string;
};

export type ShipState = {
  id: string;
  name: string;
  control:
    | "OWNER_CONTROL"
    | "AUTHORITY_CONTROL"
    | "CREW_CONTROL"
    | "PLAYER_CONTROL"
    | "CONTESTED_CONTROL"
    | "NO_EFFECTIVE_CONTROL";
  capability: number;
  status: string;
  crewCount: number;
  navigatorId: string | null;
  navigationAccess: boolean;
  destination: string;
  eta: number;
};

export type CombatState = {
  active: boolean;
  round: number;
  participantIds: string[];
  turn: "player" | "companion" | "enemy" | "end";
  log: string[];
  enemyIds: string[];
};

export type TradeSession = {
  npcId: string;
  state: TradeState;
  itemId: string;
  itemName: string;
  ask: number;
  reserve: number;
  offered: number;
  rounds: number;
  maxRounds: number;
  lastCounter: number;
  cause: string;
};

export type ExamState = {
  stage: 1 | 2 | 3 | "done";
  s1: number;
  s2: number;
  s3: number;
  alloc: number[];
  jobs: number[];
  passed: boolean;
  attempts: number;
  talked: boolean;
};

export type LoadingIncident = {
  id: string;
  title: string;
  text: string;
  resolved: boolean;
  options: { id: string; label: string; result: string }[];
};

export type Assignment = {
  system: string;
  planet: string;
  station: string;
  resource: string;
  quantity: number;
  reason: string;
  planetEta: number;
  stationDeadline: number;
};

export type LogLine = {
  id: string;
  time: number;
  text: string;
  tone: "obs" | "sys" | "social" | "alert" | "econ";
};

export type World = {
  version: number;
  masterSeed: string;
  rngState: number;
  worldTime: number;
  screen: Screen;
  phase: Phase;
  background: BackgroundId | null;
  assignment: Assignment;
  playerLocationId: string;
  player: {
    name: string;
    hp: number;
    fatigue: number;
    stress: number;
    hunger: number;
    sleepDebt: number;
    warpExposure: number;
    money: number;
    access: "low" | "medium" | "high";
    formalPower: number;
    status: number;
  };
  npcs: Record<string, Npc>;
  locations: Record<string, LocationDef>;
  knowledge: KnowledgeEntry[];
  history: HistoryEvent[];
  items: Record<string, Item>;
  playerInventory: string[];
  cargo: CargoLot[];
  ships: Record<string, ShipState>;
  alert: AlertLevel;
  combat: CombatState;
  trade: TradeSession | null;
  exam: ExamState;
  loading: {
    active: boolean;
    tick: number;
    incident: LoadingIncident | null;
    paused: boolean;
  };
  overlay: Overlay;
  pdaTab: PdaTab;
  inspectId: string | null;
  dialogueNpcId: string | null;
  dialogueOptions: DialogueOption[];
  log: LogLine[];
  pendingEvent: CriticalEvent | null;
  lastCallbackAt: number;
  travelDurationBase: number;
  captainRelation: number;
  threatenedCaptain: boolean;
  accelerated: number;
  examUnlocked: boolean;
  boardedLarge: boolean;
  report: ReportData | null;
  lossOfNormalAuthority: boolean;
  criminalEvents: { time: number; severity: "notable" | "grave" }[];
  flags: Record<string, boolean | number | string>;
};

export type DialogueOption = {
  id: string;
  label: string;
  topic: string;
  channel?: AuthorityChannel;
  disabled?: boolean;
  reason?: string;
};

export type CriticalEvent = {
  id: string;
  title: string;
  text: string;
  options: { id: string; label: string }[];
};

export type ReportData = {
  ending: "station" | "escape";
  scenes: string[];
  people: string[];
  traces: string[];
  autonomous: string[];
};

export type MethodDef = {
  id: string;
  label: string;
  timeCost: number;
  channel?: AuthorityChannel;
  irreversible?: boolean;
  hint?: string;
};
