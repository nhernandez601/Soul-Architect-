/**
 * Scene, dialogue, and choice type definitions.
 * Defines the complete data model for the story scripting system.
 */

import type { ID, Dict } from './core';
import type { CharacterID, EmotionTag } from './character';
import type { SoulDelta, SoulCondition } from './soul';

// ---------------------------------------------------------------------------
// Scene types
// ---------------------------------------------------------------------------

export type SceneType =
  | 'standard'
  | 'flashback'
  | 'dream'
  | 'vision'
  | 'memory'
  | 'cg'
  | 'epilogue'
  | 'prologue'
  | 'ending'
  | 'event';

export interface SceneDefinition {
  id: ID;
  type: SceneType;
  title: string;
  background: BackgroundSpec;
  music?: MusicSpec;
  ambience?: AmbienceSpec;
  weather?: WeatherSpec;
  lighting?: LightingSpec;
  timeOfDay?: TimeOfDay;
  nodes: SceneNode[];
  entryConditions: SoulCondition[];
  tags: string[];
  chapter: number;
  act: number;
  isReplayable: boolean;
  wordCount: number; // populated at build time
}

// ---------------------------------------------------------------------------
// Background / environment
// ---------------------------------------------------------------------------

export interface BackgroundSpec {
  id: ID;
  path: string;
  parallaxLayers?: ParallaxLayer[];
  animated: boolean;
  transitionIn: TransitionType;
  transitionOut: TransitionType;
}

export interface ParallaxLayer {
  path: string;
  depth: number; // 0-1, 0 = foreground
  speedX: number;
  speedY: number;
}

export type TransitionType =
  | 'none'
  | 'fade'
  | 'fade-white'
  | 'fade-black'
  | 'dissolve'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'iris-in'
  | 'iris-out'
  | 'shatter'
  | 'ripple'
  | 'dream-fade'
  | 'flash'
  | 'custom';

// ---------------------------------------------------------------------------
// Time of day / weather
// ---------------------------------------------------------------------------

export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'evening' | 'night' | 'midnight';

export type WeatherType = 'clear' | 'rain' | 'storm' | 'snow' | 'fog' | 'ash' | 'sakura' | 'sand' | 'void';

export interface WeatherSpec {
  type: WeatherType;
  intensity: number; // 0-1
  windStrength: number;
}

export interface LightingSpec {
  ambientColor: number;
  ambientIntensity: number;
  bloomEnabled: boolean;
  bloomStrength: number;
  godRaysEnabled: boolean;
  volumetricLightEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Music / Audio
// ---------------------------------------------------------------------------

export interface MusicSpec {
  trackId: ID;
  volume: number;
  fadeInMs: number;
  loop: boolean;
}

export interface AmbienceSpec {
  layers: AmbienceLayer[];
}

export interface AmbienceLayer {
  soundId: ID;
  volume: number;
  loop: boolean;
}

// ---------------------------------------------------------------------------
// Scene Nodes (the instruction set for a scene)
// ---------------------------------------------------------------------------

export type SceneNode =
  | DialogueNode
  | ChoiceNode
  | CharacterShowNode
  | CharacterHideNode
  | CharacterMoveNode
  | CharacterEmoteNode
  | BackgroundChangeNode
  | MusicChangeNode
  | SoundPlayNode
  | SoulChangeNode
  | RelationshipChangeNode
  | FlagSetNode
  | FlagCheckNode
  | GotoNode
  | WaitNode
  | CameraNode
  | EffectNode
  | WeatherChangeNode
  | NarratorNode
  | CGShowNode
  | VideoPlayNode
  | CodexUnlockNode
  | AchievementUnlockNode
  | CustomNode;

export type NodeType =
  | 'dialogue'
  | 'choice'
  | 'show_character'
  | 'hide_character'
  | 'move_character'
  | 'emote_character'
  | 'change_background'
  | 'change_music'
  | 'play_sound'
  | 'soul_change'
  | 'relationship_change'
  | 'flag_set'
  | 'flag_check'
  | 'goto'
  | 'wait'
  | 'camera'
  | 'effect'
  | 'weather_change'
  | 'narrator'
  | 'show_cg'
  | 'play_video'
  | 'codex_unlock'
  | 'achievement_unlock'
  | 'custom';

interface BaseNode {
  id: ID;
  type: NodeType;
  /** Conditions that must be true to execute this node. */
  conditions?: SoulCondition[];
  /** Skip this node if conditions fail (vs. block until they pass). */
  skipOnConditionFail?: boolean;
}

export interface DialogueNode extends BaseNode {
  type: 'dialogue';
  speaker: CharacterID | 'narrator' | null;
  speakerDisplayName?: string; // override display name
  text: string;
  emotion?: EmotionTag;
  voiceLineId?: ID;
  typewriterSpeed?: number; // ms per char override
  shake?: boolean;
  color?: string; // text color override
  nextNodeId?: ID;
}

export interface ChoiceNode extends BaseNode {
  type: 'choice';
  prompt?: string;
  choices: Choice[];
  timeoutMs?: number;    // auto-select defaultChoice if time runs out
  defaultChoice?: number;
  layout: 'vertical' | 'grid' | 'radial';
}

export interface Choice {
  id: ID;
  text: string;
  conditions?: SoulCondition[];
  soulDelta?: SoulDelta;
  relationshipDeltas?: Dict<number>; // characterId -> delta
  flagsSet?: Dict<boolean | string | number>;
  gotoNodeId: ID;
  gotoSceneId?: ID;
  tooltip?: string;
  disabled?: boolean;
  disabledReason?: string;
  highlight?: 'light' | 'dark' | 'gold' | 'red';
  isSecret?: boolean;
}

export interface CharacterShowNode extends BaseNode {
  type: 'show_character';
  characterId: CharacterID;
  emotion: EmotionTag;
  tags?: string[];
  position: 'left' | 'center' | 'right';
  transitionIn: TransitionType;
  durationMs: number;
  nextNodeId?: ID;
}

export interface CharacterHideNode extends BaseNode {
  type: 'hide_character';
  characterId: CharacterID;
  transitionOut: TransitionType;
  durationMs: number;
  nextNodeId?: ID;
}

export interface CharacterMoveNode extends BaseNode {
  type: 'move_character';
  characterId: CharacterID;
  targetPosition: 'left' | 'center' | 'right';
  durationMs: number;
  easing: string;
  nextNodeId?: ID;
}

export interface CharacterEmoteNode extends BaseNode {
  type: 'emote_character';
  characterId: CharacterID;
  emotion: EmotionTag;
  tags?: string[];
  nextNodeId?: ID;
}

export interface BackgroundChangeNode extends BaseNode {
  type: 'change_background';
  backgroundSpec: BackgroundSpec;
  nextNodeId?: ID;
}

export interface MusicChangeNode extends BaseNode {
  type: 'change_music';
  musicSpec: MusicSpec | null; // null = stop music
  nextNodeId?: ID;
}

export interface SoundPlayNode extends BaseNode {
  type: 'play_sound';
  soundId: ID;
  volume?: number;
  loop?: boolean;
  positional?: boolean;
  nextNodeId?: ID;
}

export interface SoulChangeNode extends BaseNode {
  type: 'soul_change';
  delta: SoulDelta;
  animate: boolean;
  label?: string;
  nextNodeId?: ID;
}

export interface RelationshipChangeNode extends BaseNode {
  type: 'relationship_change';
  characterId: CharacterID;
  delta: number;
  stat: 'affinity' | 'trust' | 'tension';
  nextNodeId?: ID;
}

export interface FlagSetNode extends BaseNode {
  type: 'flag_set';
  flags: Dict<boolean | string | number>;
  nextNodeId?: ID;
}

export interface FlagCheckNode extends BaseNode {
  type: 'flag_check';
  conditions: SoulCondition[];
  trueNodeId: ID;
  falseNodeId: ID;
}

export interface GotoNode extends BaseNode {
  type: 'goto';
  targetNodeId?: ID;
  targetSceneId?: ID;
  targetEnding?: ID;
}

export interface WaitNode extends BaseNode {
  type: 'wait';
  durationMs: number;
  awaitInput?: boolean;
  nextNodeId?: ID;
}

export interface CameraNode extends BaseNode {
  type: 'camera';
  effect: CameraEffect;
  durationMs: number;
  nextNodeId?: ID;
}

export type CameraEffect =
  | 'shake'
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'
  | 'rotate'
  | 'reset'
  | 'focus';

export interface EffectNode extends BaseNode {
  type: 'effect';
  effectId: string;
  params: Dict<number | string | boolean>;
  durationMs: number;
  nextNodeId?: ID;
}

export interface WeatherChangeNode extends BaseNode {
  type: 'weather_change';
  weatherSpec: WeatherSpec;
  transitionMs: number;
  nextNodeId?: ID;
}

export interface NarratorNode extends BaseNode {
  type: 'narrator';
  text: string;
  style: 'standard' | 'thought' | 'memory' | 'echo' | 'system';
  voiceLineId?: ID;
  nextNodeId?: ID;
}

export interface CGShowNode extends BaseNode {
  type: 'show_cg';
  cgId: ID;
  transitionIn: TransitionType;
  durationMs: number;
  nextNodeId?: ID;
}

export interface VideoPlayNode extends BaseNode {
  type: 'play_video';
  videoPath: string;
  skippable: boolean;
  nextNodeId?: ID;
}

export interface CodexUnlockNode extends BaseNode {
  type: 'codex_unlock';
  entryId: ID;
  nextNodeId?: ID;
}

export interface AchievementUnlockNode extends BaseNode {
  type: 'achievement_unlock';
  achievementId: ID;
  nextNodeId?: ID;
}

export interface CustomNode extends BaseNode {
  type: 'custom';
  command: string;
  params: Dict<unknown>;
  nextNodeId?: ID;
}
