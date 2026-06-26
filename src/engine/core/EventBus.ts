/**
 * EventBus — typed publish/subscribe event system.
 *
 * All engine subsystems communicate through this bus to remain decoupled.
 * Listeners receive strongly-typed payloads derived from the EngineEventMap.
 */

import EventEmitter from 'eventemitter3';
import type { CharacterID, EmotionTag } from '@t/character';
import type { SoulAttribute, SoulDelta, SoulState } from '@t/soul';
import type { ID, EngineState } from '@t/core';
import type { SaveSlotMeta } from '@t/save';

// ---------------------------------------------------------------------------
// Engine Event Map — every event and its payload shape
// ---------------------------------------------------------------------------

export interface EngineEventMap {
  // Engine lifecycle
  'engine:ready': void;
  'engine:state_change': { from: EngineState; to: EngineState };
  'engine:error': { message: string; fatal: boolean };
  'engine:pause': void;
  'engine:resume': void;

  // Scene events
  'scene:load_start': { sceneId: ID };
  'scene:load_complete': { sceneId: ID };
  'scene:node_enter': { nodeId: ID; sceneId: ID };
  'scene:node_exit': { nodeId: ID; sceneId: ID };
  'scene:transition_start': { from: ID; to: ID };
  'scene:transition_complete': { sceneId: ID };
  'scene:end': { sceneId: ID };

  // Dialogue events
  'dialogue:line_start': { nodeId: ID; speaker: CharacterID | 'narrator' | null; text: string };
  'dialogue:line_complete': { nodeId: ID };
  'dialogue:skip': { nodeId: ID };
  'dialogue:typewriter_tick': { charIndex: number; total: number };

  // Choice events
  'choice:presented': { nodeId: ID; count: number };
  'choice:selected': { nodeId: ID; choiceId: ID; choiceIndex: number };
  'choice:timeout': { nodeId: ID };

  // Character events
  'character:show': { characterId: CharacterID; emotion: EmotionTag };
  'character:hide': { characterId: CharacterID };
  'character:emote': { characterId: CharacterID; emotion: EmotionTag };
  'character:move': { characterId: CharacterID; position: string };

  // Soul events
  'soul:change': { delta: SoulDelta; source: string };
  'soul:attribute_change': { attribute: SoulAttribute; oldValue: number; newValue: number };
  'soul:archetype_change': { oldArchetype: string; newArchetype: string };
  'soul:milestone': { milestoneId: ID };
  'soul:state_snapshot': { state: SoulState };

  // Relationship events
  'relationship:change': { characterId: CharacterID; stat: string; delta: number; newValue: number };
  'relationship:event_unlocked': { characterId: CharacterID; eventId: ID };
  'relationship:flag_set': { characterId: CharacterID; flag: string };

  // Save events
  'save:start': { slotId: number };
  'save:complete': { slotId: number; meta: SaveSlotMeta };
  'save:fail': { slotId: number; error: string };
  'load:start': { slotId: number };
  'load:complete': { slotId: number };
  'load:fail': { slotId: number; error: string };
  'autosave:triggered': void;
  'quicksave:triggered': void;

  // Audio events
  'audio:music_start': { trackId: ID };
  'audio:music_stop': { trackId: ID };
  'audio:music_crossfade': { from: ID; to: ID };
  'audio:sfx_play': { soundId: ID };
  'audio:volume_change': { channel: string; volume: number };

  // UI events
  'ui:menu_open': { menuId: string };
  'ui:menu_close': { menuId: string };
  'ui:screen_change': { screen: string };
  'ui:notification': { message: string; type: 'info' | 'warn' | 'success' | 'error' };

  // Input events
  'input:key_down': { key: string; modifiers: string[] };
  'input:key_up': { key: string };
  'input:action': { action: string };
  'input:gamepad_button': { button: string };

  // Gallery / achievement events
  'gallery:cg_unlocked': { cgId: ID };
  'gallery:music_unlocked': { trackId: ID };
  'gallery:scene_unlocked': { sceneId: ID };
  'achievement:unlocked': { achievementId: ID };

  // Codex / quest events
  'codex:unlocked': { entryId: ID };
  'quest:activated': { questId: ID };

  // Ending events
  'ending:reached': { endingId: ID; isNewEnding: boolean };
  'ending:unlocked': { endingId: ID };

  // Transition events
  'transition:start': { style: 'fade' | 'flash' | 'iris'; durationMs: number; color?: number };
  'transition:complete': { style: 'fade' | 'flash' | 'iris' };
  'transition:midpoint': void;

  // VFX / post-processing events
  'postprocessing:preset': { preset: string };
  'postprocessing:effect_change': { effect: string; enabled: boolean };

  // Flag / variable events
  'flag:set': { key: string; value: boolean | string | number };
  'variable:set': { key: string; value: boolean | string | number };
}

// ---------------------------------------------------------------------------
// EventBus implementation
// ---------------------------------------------------------------------------

export type Listener<T> = T extends void
  ? () => void | Promise<void>
  : (payload: T) => void | Promise<void>;

export class EventBus {
  private readonly emitter = new EventEmitter();
  private readonly debugMode: boolean;

  constructor(debug = false) {
    this.debugMode = debug;
  }

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends keyof EngineEventMap>(
    event: K,
    listener: Listener<EngineEventMap[K]>
  ): () => void {
    this.emitter.on(event as string, listener as EventEmitter.ListenerFn);
    return () => this.off(event, listener);
  }

  /** Subscribe to an event, auto-unsubscribe after first fire. */
  once<K extends keyof EngineEventMap>(
    event: K,
    listener: Listener<EngineEventMap[K]>
  ): () => void {
    this.emitter.once(event as string, listener as EventEmitter.ListenerFn);
    return () => this.off(event, listener);
  }

  /** Unsubscribe from an event. */
  off<K extends keyof EngineEventMap>(
    event: K,
    listener: Listener<EngineEventMap[K]>
  ): void {
    this.emitter.off(event as string, listener as EventEmitter.ListenerFn);
  }

  /** Emit an event synchronously. */
  emit<K extends keyof EngineEventMap>(
    event: K,
    ...args: EngineEventMap[K] extends void ? [] : [payload: EngineEventMap[K]]
  ): void {
    if (this.debugMode) {
      console.debug(`[EventBus] ${String(event)}`, args[0]);
    }
    this.emitter.emit(event as string, args[0]);
  }

  /** Remove all listeners for an event (or all events if none specified). */
  removeAllListeners(event?: keyof EngineEventMap): void {
    this.emitter.removeAllListeners(event as string | undefined);
  }

  /** Returns the number of listeners for a given event. */
  listenerCount(event: keyof EngineEventMap): number {
    return this.emitter.listenerCount(event as string);
  }
}

/** Singleton event bus — shared across the entire engine. */
export const engineBus = new EventBus(
  typeof process !== 'undefined' && process.env['NODE_ENV'] === 'development'
);
