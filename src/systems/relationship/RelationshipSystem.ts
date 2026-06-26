/**
 * RelationshipSystem — tracks per-character affinity, trust, and tension.
 *
 * Values gate relationship events, unlock special dialogue, and influence
 * endings. The system fires events on threshold crossings.
 */

import { BaseService } from '../../engine/core/BaseService';
import type { CharacterID, CharacterStats, RelationshipEvent } from '@t/character';

type RelationshipStat = 'affinity' | 'trust' | 'tension' | 'mysteryLevel' | 'corruptionLevel' | 'divineLevel';

interface CharacterRelationshipData {
  stats: CharacterStats;
  events: RelationshipEvent[];
  triggeredEvents: Set<string>;
}

const DEFAULT_STATS: CharacterStats = {
  affinity: 0,
  trust: 0,
  tension: 0,
  mysteryLevel: 0,
  corruptionLevel: 0,
  divineLevel: 0,
};

export class RelationshipSystem extends BaseService {
  private readonly data = new Map<CharacterID, CharacterRelationshipData>();

  protected async onInit(): Promise<void> { /* nothing */ }
  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void { this.data.clear(); }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  registerCharacter(id: CharacterID, events: RelationshipEvent[] = []): void {
    if (!this.data.has(id)) {
      this.data.set(id, {
        stats: { ...DEFAULT_STATS },
        events,
        triggeredEvents: new Set(),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Delta application
  // ---------------------------------------------------------------------------

  applyDelta(characterId: CharacterID, stat: string, delta: number): void {
    const entry = this.data.get(characterId);
    if (!entry) { this.warn(`Character "${characterId}" not registered in RelationshipSystem`); return; }

    const s = stat as RelationshipStat;
    const oldValue = entry.stats[s] ?? 0;
    const newValue = Math.max(0, Math.min(100, oldValue + delta));
    entry.stats[s] = newValue;

    this.bus.emit('relationship:change', {
      characterId,
      stat,
      delta,
      newValue,
    });

    this.checkEvents(characterId, entry);
  }

  setStat(characterId: CharacterID, stat: RelationshipStat, value: number): void {
    const entry = this.data.get(characterId);
    if (!entry) return;
    entry.stats[stat] = Math.max(0, Math.min(100, value));
  }

  // ---------------------------------------------------------------------------
  // Event checking
  // ---------------------------------------------------------------------------

  private checkEvents(characterId: CharacterID, entry: CharacterRelationshipData): void {
    const { SoulSystem } = require('../../systems/soul/SoulSystem') as typeof import('../../systems/soul/SoulSystem');
    const soul = require('../../engine/core/ServiceRegistry').registry.get('soul') as InstanceType<typeof SoulSystem>;

    entry.events.forEach((event) => {
      if (entry.triggeredEvents.has(event.id)) return;
      if (entry.stats.affinity < event.affinityThreshold) return;

      const conditionsMet = event.condition.every((c) => soul.evaluateCondition(c));
      if (!conditionsMet) return;

      entry.triggeredEvents.add(event.id);
      this.bus.emit('relationship:event_unlocked', { characterId, eventId: event.id });
    });
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  getStats(characterId: CharacterID): CharacterStats | undefined {
    return this.data.get(characterId)?.stats;
  }

  getAllStats(): Record<CharacterID, CharacterStats> {
    const result = {} as Record<CharacterID, CharacterStats>;
    this.data.forEach((entry, id) => { result[id] = { ...entry.stats }; });
    return result;
  }

  loadStats(allStats: Record<string, CharacterStats>): void {
    Object.entries(allStats).forEach(([id, stats]) => {
      const entry = this.data.get(id as CharacterID);
      if (entry) entry.stats = { ...stats };
    });
  }
}
