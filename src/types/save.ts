/**
 * Save system types.
 * Defines the full serialization schema for game saves including
 * soul state, character state, story progress, settings, and metadata.
 */

import type { ID, SemVer, Timestamp, Dict } from './core';
import type { SoulState } from './soul';
import type { CharacterRuntimeState } from './character';

// ---------------------------------------------------------------------------
// Save slot metadata
// ---------------------------------------------------------------------------

export interface SaveSlotMeta {
  slotId: number;
  saveType: SaveType;
  version: SemVer;
  timestamp: Timestamp;
  playtimeMs: number;
  chapterTitle: string;
  sceneId: ID;
  nodeIndex: number;
  thumbnailDataUrl: string; // base64 encoded thumbnail
  soulArchetype: string;
  characterName?: string; // seeker's chosen name
}

export type SaveType = 'manual' | 'quick' | 'auto' | 'chapter';

// ---------------------------------------------------------------------------
// Full save data
// ---------------------------------------------------------------------------

export interface SaveData {
  meta: SaveSlotMeta;
  story: StoryProgress;
  soul: SoulState;
  characters: Record<string, CharacterRuntimeState>;
  inventory: InventorySaveData;
  journal: JournalSaveData;
  quests: QuestSaveData;
  achievements: AchievementSaveData;
  gallery: GallerySaveData;
  settings: UserSettings;
  flags: GlobalFlags;
  variables: PersistentVariables;
}

// ---------------------------------------------------------------------------
// Story progress
// ---------------------------------------------------------------------------

export interface StoryProgress {
  currentSceneId: ID;
  currentNodeId: ID;
  visitedScenes: Set<ID>;
  visitedNodes: Set<ID>;
  readDialogueIds: Set<ID>;
  completedEndings: Set<ID>;
  activeParallelBranches: ID[];
  chapterHistory: ChapterEntry[];
  totalChoicesMade: number;
  currentChapter: number;
  currentAct: number;
  playthroughNumber: number;
  newGamePlus: boolean;
}

export interface ChapterEntry {
  chapterId: ID;
  title: string;
  completedAt: Timestamp;
  endingSeen?: ID;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export interface InventoryItem {
  id: ID;
  name: string;
  description: string;
  iconPath: string;
  quantity: number;
  category: string;
  obtained: Timestamp;
  used: boolean;
}

export interface InventorySaveData {
  items: Dict<InventoryItem>;
  capacity: number;
}

// ---------------------------------------------------------------------------
// Journal / Memory Log
// ---------------------------------------------------------------------------

export interface JournalEntry {
  id: ID;
  title: string;
  content: string;
  timestamp: Timestamp;
  characterId?: string;
  tags: string[];
  isNew: boolean;
}

export interface JournalSaveData {
  entries: JournalEntry[];
  memoryLog: MemoryLogEntry[];
}

export interface MemoryLogEntry {
  id: ID;
  sceneId: ID;
  nodeId: ID;
  text: string;
  speaker?: string;
  timestamp: Timestamp;
}

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

export type QuestStatus = 'locked' | 'active' | 'completed' | 'failed' | 'abandoned';

export interface QuestObjective {
  id: ID;
  description: string;
  completed: boolean;
  optional: boolean;
}

export interface Quest {
  id: ID;
  title: string;
  description: string;
  status: QuestStatus;
  objectives: QuestObjective[];
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  category: 'main' | 'side' | 'relationship' | 'hidden';
  characterId?: string;
}

export interface QuestSaveData {
  quests: Dict<Quest>;
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export interface Achievement {
  id: ID;
  title: string;
  description: string;
  iconPath: string;
  unlockedAt?: Timestamp;
  isSecret: boolean;
  category: string;
  progress?: number;
  maxProgress?: number;
}

export interface AchievementSaveData {
  achievements: Dict<Achievement>;
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

export interface GallerySaveData {
  unlockedCGs: Set<ID>;
  unlockedMusic: Set<ID>;
  unlockedScenes: Set<ID>;
  newItems: Set<ID>;
}

// ---------------------------------------------------------------------------
// User Settings (persisted with save, overrideable per-slot)
// ---------------------------------------------------------------------------

export interface UserSettings {
  textSpeed: 'slow' | 'normal' | 'fast' | 'instant';
  autoSpeed: number;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  ambientVolume: number;
  fullscreen: boolean;
  resolution: string;
  locale: string;
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  screenReaderHints: boolean;
  closedCaptions: boolean;
  dyslexicFont: boolean;
  skipReadText: boolean;
  skipAllText: boolean;
  autoSaveEnabled: boolean;
  showSoulMeter: boolean;
  showRelationshipWheel: boolean;
  keybindings: Dict<string>;
}

// ---------------------------------------------------------------------------
// Global flags (persist across chapters/playthroughs)
// ---------------------------------------------------------------------------

export type GlobalFlags = Dict<boolean | string | number>;

// ---------------------------------------------------------------------------
// Persistent variables (story-script-set variables)
// ---------------------------------------------------------------------------

export type PersistentVariables = Dict<boolean | string | number>;

// ---------------------------------------------------------------------------
// Save validation
// ---------------------------------------------------------------------------

export interface SaveValidationResult {
  valid: boolean;
  version: SemVer;
  needsMigration: boolean;
  errors: string[];
}
