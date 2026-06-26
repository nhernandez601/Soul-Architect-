/**
 * Character type definitions.
 * Every character in Soul Architect is fully described by these interfaces,
 * from portrait variants and biography to relationship flags and secrets.
 */

import type { ID, FilePath, Dict } from './core';
import type { SoulDelta, SoulCondition } from './soul';

// ---------------------------------------------------------------------------
// Character registry
// ---------------------------------------------------------------------------

export const CHARACTER_IDS = [
  'seeker',
  'voice',
  'light',
  'shadow',
  'watcher',
  'aurelia',
  'nyx',
  'seraphine',
  'mira',
  'echo',
  'elian',
] as const;

export type CharacterID = (typeof CHARACTER_IDS)[number];

// ---------------------------------------------------------------------------
// Portrait / Expression system
// ---------------------------------------------------------------------------

export type EmotionTag =
  | 'neutral'
  | 'smile'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'fearful'
  | 'disgusted'
  | 'contempt'
  | 'pensive'
  | 'determined'
  | 'loving'
  | 'terrified'
  | 'hopeful'
  | 'broken'
  | 'transcendent';

export interface PortraitVariant {
  id: ID;
  emotion: EmotionTag;
  /** Additional tags for costume / lighting state (e.g. "corrupted", "divine") */
  tags: string[];
  path: FilePath;
  offsetX: number;
  offsetY: number;
  scale: number;
}

// ---------------------------------------------------------------------------
// Character biography
// ---------------------------------------------------------------------------

export interface CharacterBiography {
  fullName: string;
  title: string;
  age: string; // intentionally string ("Unknown", "Ancient", etc.)
  origin: string;
  occupation: string;
  archetype: string;
  summary: string;
  secretSummary: string; // revealed when secret flag is unlocked
  voiceDescription: string;
}

// ---------------------------------------------------------------------------
// Character stats (per-character numerical attributes)
// ---------------------------------------------------------------------------

export interface CharacterStats {
  affinity: number;       // 0-100, general relationship strength
  trust: number;          // 0-100
  tension: number;        // 0-100 (conflict level)
  mysteryLevel: number;   // 0-100 (how much is revealed)
  corruptionLevel: number;
  divineLevel: number;
}

// ---------------------------------------------------------------------------
// Relationship event
// ---------------------------------------------------------------------------

export interface RelationshipEvent {
  id: ID;
  label: string;
  condition: SoulCondition[];
  affinityThreshold: number;
  sceneId: ID;
  unlocksCG?: ID;
  unlocksDialogue?: ID[];
  soulDelta: SoulDelta;
  isSecret: boolean;
}

// ---------------------------------------------------------------------------
// Character flags
// ---------------------------------------------------------------------------

export type CharacterFlag =
  | 'met'
  | 'introduced'
  | 'trusted'
  | 'betrayed'
  | 'loved'
  | 'feared'
  | 'secret_revealed'
  | 'pact_made'
  | 'broken'
  | 'redeemed'
  | 'lost'
  | string; // extensible

// ---------------------------------------------------------------------------
// CG (Computer Graphic / event illustration) reference
// ---------------------------------------------------------------------------

export interface CGReference {
  id: ID;
  title: string;
  path: FilePath;
  unlockCondition: SoulCondition[];
  characters: CharacterID[];
  sceneId: ID;
  isSecret: boolean;
}

// ---------------------------------------------------------------------------
// Voice placeholder
// ---------------------------------------------------------------------------

export interface VoiceLine {
  id: ID;
  text: string;
  emotion: EmotionTag;
  path: FilePath; // empty string = placeholder
  duration: number; // ms, 0 = auto
}

// ---------------------------------------------------------------------------
// Full Character definition
// ---------------------------------------------------------------------------

export interface CharacterDefinition {
  id: CharacterID;
  biography: CharacterBiography;
  portraits: PortraitVariant[];
  defaultPortrait: EmotionTag;
  stats: CharacterStats;
  flags: Set<CharacterFlag>;
  relationships: RelationshipEvent[];
  cgReferences: CGReference[];
  voiceLines: Dict<VoiceLine>;
  secrets: CharacterSecret[];
  themeMusic?: ID;
  animationSet: string; // refers to an animation bundle ID
  isPlayable: boolean;
  isNarrator: boolean;
  displayPosition: 'left' | 'center' | 'right' | 'full';
  zIndex: number;
}

// ---------------------------------------------------------------------------
// Secret (unlockable lore)
// ---------------------------------------------------------------------------

export interface CharacterSecret {
  id: ID;
  title: string;
  content: string;
  unlockCondition: SoulCondition[];
  unlocksAt: 'scene' | 'choice' | 'affinity' | 'soul';
  referenceId: ID;
  discovered: boolean;
}

// ---------------------------------------------------------------------------
// Runtime character state (what changes during play)
// ---------------------------------------------------------------------------

export interface CharacterRuntimeState {
  id: CharacterID;
  stats: CharacterStats;
  flags: Set<CharacterFlag>;
  currentEmotion: EmotionTag;
  currentTags: string[];
  visible: boolean;
  position: 'left' | 'center' | 'right' | 'offscreen';
  opacity: number;
  scale: number;
  discoveredSecrets: Set<ID>;
}
