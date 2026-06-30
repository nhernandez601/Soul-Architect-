/**
 * EndingSystem — manages narrative endings, unlock tracking, and New Game+.
 *
 * Each ending has a condition set evaluated against soul stats, relationship
 * values, and flags. The system listens for scene:end events and checks if the
 * completed scene triggers an ending. Supports NG+ inheritance and
 * multi-playthrough tracking.
 */

import { BaseService } from '../../engine/core/BaseService';
import { registry } from '../../engine/core/ServiceRegistry';
import type { ID } from '@t/core';
import type { SoulCondition } from '@t/soul';

export interface EndingDefinition {
  id: ID;
  title: string;
  subtitle: string;
  description: string;
  category: 'true' | 'good' | 'neutral' | 'bad' | 'secret' | 'joke';
  conditions: {
    soul?: SoulCondition[];
    flags?: Record<string, boolean | string | number>;
    minPlaythrough?: number;
    requiresNGPlus?: boolean;
  };
  triggerScene: ID;
  isSecret: boolean;
  artPath?: string;
  musicId?: string;
  creditsSuffix?: string;
}

export interface EndingRecord {
  id: ID;
  title: string;
  subtitle: string;
  category: EndingDefinition['category'];
  isSecret: boolean;
  artPath?: string;
  firstSeenAt?: number;
  seenCount: number;
}

export interface NGPlusState {
  enabled: boolean;
  playthroughNumber: number;
  inheritedFlags: Record<string, boolean | string | number>;
  unlockedEndingIds: ID[];
}

export class EndingSystem extends BaseService {
  private readonly definitions = new Map<ID, EndingDefinition>();
  private readonly records = new Map<ID, EndingRecord>();
  private ngPlus: NGPlusState = {
    enabled: false,
    playthroughNumber: 1,
    inheritedFlags: {},
    unlockedEndingIds: [],
  };
  private currentEndingId: ID | null = null;

  protected async onInit(): Promise<void> {
    this.subscribe('scene:end', ({ sceneId }) => {
      this.checkEndingTriggers(sceneId);
    });
  }

  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void {
    this.definitions.clear();
    this.records.clear();
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  registerEnding(def: EndingDefinition): void {
    this.definitions.set(def.id, def);
    if (!this.records.has(def.id)) {
      this.records.set(def.id, {
        id: def.id,
        title: def.title,
        subtitle: def.subtitle,
        category: def.category,
        isSecret: def.isSecret,
        artPath: def.artPath,
        seenCount: 0,
      });
    }
  }

  registerEndings(defs: EndingDefinition[]): void {
    defs.forEach((d) => this.registerEnding(d));
  }

  // ---------------------------------------------------------------------------
  // Trigger resolution
  // ---------------------------------------------------------------------------

  private checkEndingTriggers(sceneId: ID): void {
    this.definitions.forEach((def) => {
      if (def.triggerScene !== sceneId) return;
      if (this.meetsConditions(def)) {
        this.reachEnding(def.id);
      }
    });
  }

  reachEnding(id: ID): void {
    const def = this.definitions.get(id);
    const record = this.records.get(id);
    if (!def || !record) {
      this.warn(`Ending "${id}" not registered`);
      return;
    }

    const isNewEnding = record.seenCount === 0;
    record.seenCount++;
    record.firstSeenAt ??= Date.now();
    this.currentEndingId = id;

    if (isNewEnding && !this.ngPlus.unlockedEndingIds.includes(id)) {
      this.ngPlus.unlockedEndingIds.push(id);
    }

    this.log(`Ending reached: "${def.title}" (playthrough ${this.ngPlus.playthroughNumber})`);
    this.bus.emit('ending:reached', { endingId: id, isNewEnding });

    if (isNewEnding) {
      this.bus.emit('ending:unlocked', { endingId: id });
      this.bus.emit('ui:notification', {
        message: `New ending unlocked: ${def.title}`,
        type: 'success',
      });
    }
  }

  private meetsConditions(def: EndingDefinition): boolean {
    const soul = registry.get<import('../../systems/soul/SoulSystem').SoulSystem>('soul');
    const { conditions } = def;

    if (conditions.minPlaythrough !== undefined &&
        this.ngPlus.playthroughNumber < conditions.minPlaythrough) return false;

    if (conditions.requiresNGPlus && !this.ngPlus.enabled) return false;

    if (conditions.soul) {
      if (!conditions.soul.every((c) => soul.evaluateCondition(c))) return false;
    }

    if (conditions.flags) {
      for (const [key, expected] of Object.entries(conditions.flags)) {
        if (soul.getFlag(key) !== expected) return false;
      }
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // New Game+
  // ---------------------------------------------------------------------------

  beginNGPlus(carryFlagKeys: string[] = []): void {
    const soul = registry.get<import('../../systems/soul/SoulSystem').SoulSystem>('soul');
    const inheritedFlags: Record<string, boolean | string | number> = {};

    carryFlagKeys.forEach((key) => {
      const val = soul.getFlag(key);
      if (val !== undefined) inheritedFlags[key] = val;
    });

    this.ngPlus = {
      enabled: true,
      playthroughNumber: this.ngPlus.playthroughNumber + 1,
      inheritedFlags,
      unlockedEndingIds: [...this.ngPlus.unlockedEndingIds],
    };

    this.log(`New Game+ started — playthrough ${this.ngPlus.playthroughNumber}`);
    this.bus.emit('flag:set', { key: 'ng_plus', value: true });
    this.bus.emit('flag:set', { key: 'playthrough_number', value: this.ngPlus.playthroughNumber });

    Object.entries(inheritedFlags).forEach(([key, value]) => {
      this.bus.emit('flag:set', { key, value });
    });
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  getDefinition(id: ID): EndingDefinition | undefined { return this.definitions.get(id); }
  getRecord(id: ID): EndingRecord | undefined { return this.records.get(id); }
  getCurrentEndingId(): ID | null { return this.currentEndingId; }

  getAllRecords(): EndingRecord[] { return [...this.records.values()]; }

  getSeenEndings(): EndingRecord[] {
    return [...this.records.values()].filter((r) => r.seenCount > 0);
  }

  getUnseenNonSecret(): EndingRecord[] {
    return [...this.records.values()].filter((r) => r.seenCount === 0 && !r.isSecret);
  }

  getCompletionPercent(): number {
    const visible = [...this.records.values()].filter((r) => !r.isSecret);
    if (visible.length === 0) return 0;
    const seen = visible.filter((r) => r.seenCount > 0).length;
    return Math.round((seen / visible.length) * 100);
  }

  getTotalEndingCount(): number { return this.records.size; }
  getNGPlusState(): Readonly<NGPlusState> { return this.ngPlus; }
  isNGPlus(): boolean { return this.ngPlus.enabled; }
  getPlaythroughNumber(): number { return this.ngPlus.playthroughNumber; }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  serialize(): { records: Record<ID, EndingRecord>; ngPlus: NGPlusState } {
    return { records: Object.fromEntries(this.records), ngPlus: { ...this.ngPlus } };
  }

  deserialize(data: { records: Record<ID, EndingRecord>; ngPlus: NGPlusState }): void {
    Object.entries(data.records).forEach(([id, r]) => this.records.set(id, r));
    this.ngPlus = data.ngPlus;
  }
}
