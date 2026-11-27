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
  /** Where to find it, in a sentence or two (data/descriptions.json). */
  where?: string;
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
  distance?: number; // hops from current region (undefined when unknown or unreachable)
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
  /**
   * Counters only: the checklist's per-location rows, for display. Kept out of `items` so
   * they never reach "can get now", Remaining or the 100% count (the counter value does).
   * Always unmapped until a rule ties a flag to a spot.
   */
  spots?: TrackedItem[];
  /** For counters */
  value?: number | null;
  max?: number;
  counterConfidence?: string;
}

export interface SlotSummary {
  name: string; // slot_03
  mtimeMs: number;
  area?: string;
  // From the slot's caption.sav; absent when it doesn't say or can't be read.
  hearts?: number; // 4.75 = four and three quarters
  maxHearts?: number;
  savedAt?: number; // ms epoch, the caption's date read as local time
  autoSave?: boolean;
  rupees?: number;
  tokens?: number;
  songs?: number;
  medals?: number;
  stones?: number;
  age?: 'child' | 'adult';
  /** Rekarina: a finished save the game hasn't put in place yet (it does on its next start). */
  pending?: boolean;
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

/** Per-dungeon room-key info that isn't a checklist row; `held` is null when unreadable. */
export type KeyInfo = Record<string, { held: number | null; max?: number }>;

export interface AppState {
  status: 'ok' | 'no-folder' | 'no-slots' | 'error' | 'loading';
  message?: string;
  saveDir?: string;
  slots: SlotSummary[];
  slotMode: 'recent' | 'manual';
  activeSlot?: string;
  summary?: Summary;
  categories: TrackedCategory[];
  keys?: KeyInfo;
  lastChanges?: ChangeReport;
  snapshots: { file: string; label: string }[];
  snapshotDiff?: { from: string; to: string; rows: ChangeRow[] };
  toasts: Toast[];
  devPanel: boolean;
  version: string;
  /** The system the tracker runs on (process.platform): help texts name its folders. */
  platform: string;
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
  /** Show/hide the overlay with a controller button */
  pad: PadState;
  /** Reading progress straight from the running game (read-only) */
  live: LiveInfo & { enabled: boolean; using: boolean };
  /** Local log of tracked changes */
  changeLog: { enabled: boolean; dir: string };
  /** Settings → Developer options: show the WIP 100% sections */
  wipFeatures: boolean;
}

/**
 * off: turned off · unavailable: can't read memory on this system · no-game: no supported game is
 * running · searching: looking for the progress tables · waiting: found the game, but it
 * doesn't match the latest save (title screen, other file) · live: in use
 */
export interface LiveInfo {
  status: 'off' | 'unavailable' | 'no-game' | 'searching' | 'waiting' | 'live';
  detail?: string;
}

/** "Which one was this?" question shown after collecting an unplaced Skulltula/heart piece. */
export interface IdentifyRequest {
  id: string; // stable: sorted new flags
  categoryLabel: string;
  area: string;
  flags: string[]; // newly set, unidentified
  pick: number; // how many rows to choose
  candidates: { id: string; number: number; name: string }[];
  /** Rows of the same group in other areas (the question was narrowed to where you were) */
  others?: { id: string; number: number; name: string }[];
  at?: string;
}

export type OverlayMode = 'counters' | 'remaining' | 'available';

/** The controller toggle, as Settings shows it. */
export interface PadState {
  /** false: not on this system (Windows only for now); `status` says why */
  supported: boolean;
  enabled: boolean;
  mode: 'hold' | 'press';
  holdMs: number;
  /** The button, in words ("Left stick click (L3)") */
  button: string;
  /** A button was chosen (otherwise the default, L3) */
  custom: boolean;
  learning: boolean;
  /** "DualSense connected", "No controller found", "Press a button on your controller (10 s)…" */
  status: string;
  /** A controller is connected, but there's no default button for it: choose one */
  needsChoose: boolean;
  /** Result of the last "Choose button…" */
  note?: string;
}

export interface OverlayState {
  visible: boolean;
  locked: boolean;
  opacity: number; // 0.2–1
  mode: OverlayMode;
}

/** Search and filters of the "Can get now" list. null = no restriction. */
export interface AvailableFilters {
  search: string;
  area: string | null;
  /** A categoryLabel */
  category: string | null;
  age: 'child' | 'adult' | null;
  nightOnly: boolean;
  hereOnly: boolean;
}

export const NO_FILTERS: AvailableFilters = { search: '', area: null, category: null, age: null, nightOnly: false, hereOnly: false };

/** How the main checklist cards flow: fit (sized to tiles), masonry (packed columns), or stack (one card per row). */
export type ChecklistLayout = 'fit' | 'masonry' | 'stack';

export interface UiPrefs {
  hideCollected: boolean;
  hiddenCategories: string[];
  /** Categories shown as header only */
  collapsed: string[];
  showParts: { B: boolean; C: boolean };
  /** Height of the "Can get now" panel in pixels (user-resized) */
  availableHeight?: number;
  /** Sidebar checklist focus: 'all' (full checklist) or a card id */
  checklistFocus?: 'all' | string;
  /** Display selector: when false, only categories NOT in hiddenCategories show (default true = all) */
  checklistAll?: boolean;
  /** Categories hidden from the left bar entirely (Settings -> Left bar). Empty/absent = all shown. */
  sidebarHidden?: string[];
  /** Advanced surfaces (live read, change log, dev tools) — off by default */
  advanced?: boolean;
  /** Checklist card flow; defaults to 'masonry' */
  layout?: ChecklistLayout;
  availableFilters?: AvailableFilters;
  /** Show the category sidebar (default true) */
  showSidebar?: boolean;
  /** Show the "Can get now" column (default true) */
  showCanGetNow?: boolean;
  /** First-run guide finished (or skipped); shown until then */
  guideSeen?: boolean;
}

/**
 * Which in-app update path a build uses.
 * off: running from source (dev) — no update feature at all.
 * full: can download and install (Windows NSIS installer, Linux AppImage).
 * check-only: can only say a newer version exists (portable exe, Linux tar.gz).
 */
export type UpdateMode = 'off' | 'full' | 'check-only';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'downloading'
  | 'downloaded'
  | 'error';

/** In-app update state, pushed to the UI with `updates:state`. */
export interface UpdateState {
  mode: UpdateMode;
  status: UpdateStatus;
  /** The user's switch settings; the main process rides them on every push so the
   *  Settings window reads them back instead of falling back to off (e.g. after a restart). */
  check?: boolean;
  autoDownload?: boolean;
  /** Newest release version found (check-only) or the available update (full) */
  version?: string;
  /** Download progress 0–100 (full mode only) */
  progress?: number;
  /** Error message, in plain words (no raw stack) */
  error?: string;
  /** Release notes of the newer version */
  notes?: string;
  /** Link to the release page (check-only) */
  url?: string;
}
