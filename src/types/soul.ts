/**
 * Soul System type definitions.
 * The Soul System tracks 12 primary attributes + hidden variables that drive
 * every conditional branch, dialogue unlock, ending, and artwork in the game.
 */

import type { ID, Dict } from './core';

// ---------------------------------------------------------------------------
// Primary Soul Attributes
// ---------------------------------------------------------------------------

export const SOUL_ATTRIBUTES = [
  'hope',
  'faith',
  'fear',
  'love',
  'knowledge',
  'compassion',
  'pride',
  'regret',
  'memory',
  'purpose',
  'light',
  'shadow',
] as const;

export type SoulAttribute = (typeof SOUL_ATTRIBUTES)[number];

/** Normalized 0-100 range for all soul values. */
export type SoulValue = number;

export type SoulStats = Record<SoulAttribute, SoulValue>;

// ---------------------------------------------------------------------------
// Soul Delta (how much a choice/event changes the soul)
// ---------------------------------------------------------------------------

export type SoulDelta = Partial<Record<SoulAttribute, number>>;

export interface SoulChange {
  attribute: SoulAttribute;
  delta: number;
  source: string; // scene / choice / event ID
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Hidden Variables
// ---------------------------------------------------------------------------

/**
 * Hidden variables are not shown in the UI but gate important content.
 * They are keyed by arbitrary string IDs defined in story scripts.
 */
export type HiddenVariables = Dict<number | boolean | string>;

// ---------------------------------------------------------------------------
// Soul State (serializable)
// ---------------------------------------------------------------------------

export interface SoulState {
  stats: SoulStats;
  hidden: HiddenVariables;
  history: SoulChange[];
  /** Computed soul "archetype" label derived from dominant attributes. */
  archetype: SoulArchetype;
}

// ---------------------------------------------------------------------------
// Soul Archetypes (derived from dominant stats)
// ---------------------------------------------------------------------------

export type SoulArchetype =
  | 'seeker'       // balanced / undefined
  | 'enlightened'  // high light + knowledge + hope
  | 'fallen'       // high shadow + fear + regret
  | 'devoted'      // high faith + love + compassion
  | 'sovereign'    // high pride + purpose + knowledge
  | 'haunted'      // high memory + regret + fear
  | 'radiant'      // high hope + love + light
  | 'void'         // high shadow + fear + regret + low everything else
  | 'transcendent' // maxed light + shadow (balanced extremes)
  | 'forgotten';   // low memory + purpose + love

export const ARCHETYPE_THRESHOLDS: Record<SoulArchetype, Partial<Record<SoulAttribute, [number, number]>>> = {
  seeker: {},
  enlightened: { light: [70, 100], knowledge: [60, 100], hope: [60, 100] },
  fallen: { shadow: [70, 100], fear: [60, 100], regret: [60, 100] },
  devoted: { faith: [70, 100], love: [65, 100], compassion: [65, 100] },
  sovereign: { pride: [70, 100], purpose: [65, 100], knowledge: [60, 100] },
  haunted: { memory: [75, 100], regret: [65, 100], fear: [55, 100] },
  radiant: { hope: [75, 100], love: [70, 100], light: [65, 100] },
  void: { shadow: [80, 100], fear: [75, 100], regret: [70, 100] },
  transcendent: { light: [80, 100], shadow: [80, 100] },
  forgotten: { memory: [0, 30], purpose: [0, 30], love: [0, 30] },
};

// ---------------------------------------------------------------------------
// Soul Condition (used in script conditionals)
// ---------------------------------------------------------------------------

export type ConditionOperator = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'between';

export interface SoulCondition {
  attribute: SoulAttribute | string; // string for hidden vars
  operator: ConditionOperator;
  value: number | boolean | string;
  value2?: number; // for 'between'
}

// ---------------------------------------------------------------------------
// Soul Milestone / Achievement trigger
// ---------------------------------------------------------------------------

export interface SoulMilestone {
  id: ID;
  label: string;
  condition: SoulCondition[];
  rewardId?: ID;
  secret: boolean;
}

// ---------------------------------------------------------------------------
// Soul UI display helpers
// ---------------------------------------------------------------------------

export interface SoulMeterDisplay {
  attribute: SoulAttribute;
  label: string;
  color: string;
  icon: string;
  description: string;
  invertDisplay: boolean; // e.g. Fear shows as "red draining down"
}

export const SOUL_METER_DISPLAY: SoulMeterDisplay[] = [
  { attribute: 'hope',        label: 'Hope',        color: '#FFD700', icon: 'sun',       description: 'The light that pulls you forward.',            invertDisplay: false },
  { attribute: 'faith',       label: 'Faith',       color: '#C0ABFF', icon: 'star',      description: 'Trust in something beyond yourself.',          invertDisplay: false },
  { attribute: 'fear',        label: 'Fear',        color: '#FF4444', icon: 'eye',       description: 'What lurks in the corners of your mind.',      invertDisplay: true  },
  { attribute: 'love',        label: 'Love',        color: '#FF69B4', icon: 'heart',     description: 'The bonds that define you.',                   invertDisplay: false },
  { attribute: 'knowledge',   label: 'Knowledge',   color: '#4FC3F7', icon: 'book',      description: 'Truth, once seen, cannot be unseen.',          invertDisplay: false },
  { attribute: 'compassion',  label: 'Compassion',  color: '#81C784', icon: 'hands',     description: 'To feel another\'s pain as your own.',         invertDisplay: false },
  { attribute: 'pride',       label: 'Pride',       color: '#FF8C00', icon: 'crown',     description: 'Your sense of self, at any cost.',             invertDisplay: false },
  { attribute: 'regret',      label: 'Regret',      color: '#9E9E9E', icon: 'hourglass', description: 'The weight of paths not taken.',               invertDisplay: true  },
  { attribute: 'memory',      label: 'Memory',      color: '#BA68C8', icon: 'feather',   description: 'Who you were shapes who you are.',             invertDisplay: false },
  { attribute: 'purpose',     label: 'Purpose',     color: '#FFF176', icon: 'compass',   description: 'The reason you keep walking forward.',         invertDisplay: false },
  { attribute: 'light',       label: 'Light',       color: '#FFFDE7', icon: 'flame',     description: 'The part of you that refuses to break.',       invertDisplay: false },
  { attribute: 'shadow',      label: 'Shadow',      color: '#263238', icon: 'moon',      description: 'What you hide, even from yourself.',           invertDisplay: false },
];
