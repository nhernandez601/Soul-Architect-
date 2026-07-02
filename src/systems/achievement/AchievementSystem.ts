/**
 * AchievementSystem — Steam-ready achievement tracking.
 *
 * Achievements are defined in data files and unlocked via conditions,
 * scene visits, soul milestones, choice counts, or explicit unlock calls.
 * Fires events consumed by UI toast and save system.
 * Stub hooks for Steam Greenworks / GOG Galaxy integration.
 */

import { BaseService } from '../../engine/core/BaseService';
import { registry } from '../../engine/core/ServiceRegistry';
import type { Achievement } from '@t/save';
import type { SoulCondition } from '@t/soul';
import type { ID } from '@t/core';

export interface AchievementDefinition {
  id: ID;
  title: string;
  description: string;
  iconPath: string;
  category: 'story' | 'soul' | 'relationship' | 'exploration' | 'ending' | 'secret';
  isSecret: boolean;
  condition?: SoulCondition[];
  triggerFlag?: string;
  triggerScene?: ID;
  triggerEnding?: ID;
  progressMax?: number; // if set, achievement tracks progress
  progressFlag?: string; // flag key that holds progress value
  points: number; // arbitrary score weight
}

export class AchievementSystem extends BaseService {
  private readonly definitions = new Map<ID, AchievementDefinition>();
  private readonly achievements = new Map<ID, Achievement>();

  protected async onInit(): Promise<void> {
    this.subscribe('flag:set', ({ key, value }) => {
      this.checkFlagTriggers(key, value);
      this.updateProgressAchievements(key, value);
    });
    this.subscribe('soul:attribute_change', () => {
      this.checkConditionAchievements();
    });
    this.subscribe('scene:end', ({ sceneId }) => {
      this.checkSceneTriggers(sceneId);
    });
    this.subscribe('soul:milestone', ({ milestoneId }) => {
      this.unlock(milestoneId);
    });
    this.subscribe('ending:reached', ({ endingId }) => {
      this.checkEndingTriggers(endingId);
    });
  }

  private checkEndingTriggers(endingId: ID): void {
    this.definitions.forEach((def, id) => {
      if (def.triggerEnding === endingId) this.unlock(id);
    });
  }

  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void {
    this.definitions.clear();
    this.achievements.clear();
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  registerAchievement(def: AchievementDefinition): void {
    this.definitions.set(def.id, def);
    this.achievements.set(def.id, {
      id: def.id,
      title: def.title,
      description: def.description,
      iconPath: def.iconPath,
      isSecret: def.isSecret,
      category: def.category,
      progress: def.progressMax ? 0 : undefined,
      maxProgress: def.progressMax,
    });
  }

  registerAchievements(defs: AchievementDefinition[]): void {
    defs.forEach((d) => this.registerAchievement(d));
  }

  // ---------------------------------------------------------------------------
  // Unlock
  // ---------------------------------------------------------------------------

  unlock(id: ID): void {
    const achievement = this.achievements.get(id);
    if (!achievement || achievement.unlockedAt) return;

    achievement.unlockedAt = Date.now();
    this.log(`Achievement unlocked: "${achievement.title}"`);
    this.bus.emit('achievement:unlocked', { achievementId: id });
    this.bus.emit('ui:notification', {
      message: `Achievement: ${achievement.title}`,
      type: 'success',
    });

    // Steam integration hook (no-op unless Electron + Greenworks)
    this.notifyPlatform(id);
  }

  setProgress(id: ID, value: number): void {
    const achievement = this.achievements.get(id);
    if (!achievement || achievement.unlockedAt) return;
    if (achievement.maxProgress === undefined) return;

    achievement.progress = Math.min(value, achievement.maxProgress);
    if (achievement.progress >= achievement.maxProgress) {
      this.unlock(id);
    }
  }

  incrementProgress(id: ID, amount = 1): void {
    const achievement = this.achievements.get(id);
    if (!achievement) return;
    this.setProgress(id, (achievement.progress ?? 0) + amount);
  }

  // ---------------------------------------------------------------------------
  // Trigger checks
  // ---------------------------------------------------------------------------

  private checkFlagTriggers(key: string, _value: unknown): void {
    this.definitions.forEach((def, id) => {
      if (def.triggerFlag === key) this.unlock(id);
    });
  }

  private updateProgressAchievements(key: string, value: unknown): void {
    this.definitions.forEach((def, id) => {
      if (def.progressFlag === key && typeof value === 'number') {
        this.setProgress(id, value);
      }
    });
  }

  private checkSceneTriggers(sceneId: ID): void {
    this.definitions.forEach((def, id) => {
      if (def.triggerScene === sceneId) this.unlock(id);
    });
  }

  private checkConditionAchievements(): void {
    const soul = registry.get<import('../soul/SoulSystem').SoulSystem>('soul');

    this.definitions.forEach((def, id) => {
      const a = this.achievements.get(id);
      if (!def.condition || !a || a.unlockedAt) return;
      const met = def.condition.every((c) => soul.evaluateCondition(c));
      if (met) this.unlock(id);
    });
  }

  // ---------------------------------------------------------------------------
  // Platform integration stub
  // ---------------------------------------------------------------------------

  private notifyPlatform(id: ID): void {
    // In production Electron build: call Greenworks / GOG Galaxy SDK
    if (typeof window !== 'undefined' && (window as unknown as { greenworks?: { activateAchievement: (id: string, cb: () => void, eb: () => void) => void } }).greenworks) {
      (window as unknown as { greenworks: { activateAchievement: (id: string, cb: () => void, eb: () => void) => void } }).greenworks.activateAchievement(id, () => {}, () => {});
    }
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  getAchievement(id: ID): Achievement | undefined { return this.achievements.get(id); }

  getUnlocked(): Achievement[] {
    return [...this.achievements.values()].filter((a) => !!a.unlockedAt);
  }

  getAll(): Achievement[] { return [...this.achievements.values()]; }

  getTotalPoints(): number {
    return this.getUnlocked().reduce((sum, a) => {
      const def = this.definitions.get(a.id);
      return sum + (def?.points ?? 0);
    }, 0);
  }

  getCompletionPercent(): number {
    const total = this.achievements.size;
    if (total === 0) return 0;
    return Math.round((this.getUnlocked().length / total) * 100);
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  serialize(): Record<ID, Achievement> {
    return Object.fromEntries(this.achievements);
  }

  deserialize(data: Record<ID, Achievement>): void {
    Object.entries(data).forEach(([id, achievement]) => {
      this.achievements.set(id, achievement);
    });
  }
}
