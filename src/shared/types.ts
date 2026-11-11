// Types shared by the main process and the UI. No imports from Electron or Node.

export type ItemState = 'yes' | 'no' | 'unknown' | 'unmapped';

export interface TrackedItem {
  id: string;
  number: number;
  name: string;
  chapter?: string;
  region?: string;
  requirement?: string;
  details?: Record<string, string>;
  newInRemake?: boolean;
  iconId: string;
  /** What the save says (unmapped = no rule yet). */
  state: ItemState;
  /** Ticked by hand in the tracker (saved per slot). */
  manual: boolean;
  /** Collected, by save or by hand. */
  done: boolean;
  confidence?: 'confirmed' | 'likely' | 'guess';
  evidence?: string;
  /** Became collected in the latest save. */
  justCollected?: boolean;
  /** "Can get now" logic, if the row has a logic entry */
  logic?: ItemLogic;
}

export interface ItemLogic {
  ages: ('child' | 'adult')[]; // empty = not yet
  region: string;
  needs?: string;
  night?: boolean;
  unsure?: boolean;
  note?: string;
  missing: string[];
}

export interface AvailableEntry {
  id: string;
  categoryId: string;
  categoryLabel: string;
  number: number;
  name: string;
  region: string;
  ages: ('child' | 'adult')[];
  night?: boolean;
  unsure?: boolean;
  here: boolean; // in the area you last saved in
}

export interface TrackedCategory {
  id: string;
  label: string;
  part: 'A' | 'B' | 'C';
  countsToward100: boolean;
  kind: 'list' | 'counter';
  note?: string;
  /** e.g. "Your save has 3 pieces; 0 matched to a location yet" */
  hint?: string;
  items: TrackedItem[];
  done: number;
  total: number;
  /** For counters */
  value?: number | null;
  max?: number;
  counterConfidence?: string;
}

export interface SlotSummary {
  name: string; // slot_03
  mtimeMs: number;
  area?: string;
}

export interface Summary {
  hearts: number | null;
  maxHeartsPossible: number;
  heartPiecesHeld: number | null;
  tokens: number | null;
  nextReward: { tokens: number; reward: string } | null;
  /** Rewards whose token count is reached but not yet collected at the House of Skulltula */
  claimable: { tokens: number; reward: string }[];
  percent: number; // 0–100, Part A only
  doneA: number;
  totalA: number;
  area?: string;
  lastSavedMs?: number;
}

export interface ChangeRow {
  key: string; // "0x1234ABCD" or "b64:0x..."
  name?: string;
  type: string;
  old: string;
  new: string;
  /** Checklist entries whose rules read this key */
  entries?: string[];
}

export interface ChangeReport {
  atMs: number;
  slot: string;
  known: ChangeRow[]; // keys used by the mapping
  unknown: ChangeRow[]; // other keys (noise filtered)
  hiddenNoise: number;
}

export interface Toast { id: number; text: string }

export interface AppState {
  status: 'ok' | 'no-folder' | 'no-slots' | 'error' | 'loading';
  message?: string;
  saveDir?: string;
  slots: SlotSummary[];
  slotMode: 'recent' | 'manual';
  activeSlot?: string;
  summary?: Summary;
  categories: TrackedCategory[];
  lastChanges?: ChangeReport;
  snapshots: { file: string; label: string }[];
  snapshotDiff?: { from: string; to: string; rows: ChangeRow[] };
  toasts: Toast[];
  devPanel: boolean;
  version: string;
  /** Checklist regions matching the save's current area (for the overlay) */
  areaRegions: string[];
  /** 100% entries obtainable right now (logic), current area first */
  available: AvailableEntry[];
  /** Whether time travel is unlocked (adult entries possible) */
  canBeAdult: boolean;
  /** Open "which one was this?" questions, oldest first */
  identify: IdentifyRequest[];
  /** How many spots the user has identified so far */
  learnedCount: number;
  overlay: OverlayState;
  hotkeys: { toggleOverlay: string; lockOverlay: string; errors: string[] };
}

/** "Which one was this?" question shown after collecting an unplaced Skulltula/heart piece. */
export interface IdentifyRequest {
  id: string; // stable: sorted new flags
  categoryLabel: string;
  area: string;
  flags: string[]; // newly set, unidentified
  pick: number; // how many rows to choose
  candidates: { id: string; number: number; name: string }[];
  at?: string;
}

export type OverlayMode = 'counters' | 'remaining' | 'available';

export interface OverlayState {
  visible: boolean;
  locked: boolean;
  opacity: number; // 0.2–1
  mode: OverlayMode;
}

export interface UiPrefs {
  hideCollected: boolean;
  hiddenCategories: string[];
  /** Categories shown as header only */
  collapsed: string[];
  showParts: { B: boolean; C: boolean };
  /** Height of the "Can get now" panel in pixels (user-resized) */
  availableHeight?: number;
}
