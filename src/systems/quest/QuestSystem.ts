/**
 * QuestSystem — manages main, side, relationship, and hidden quests.
 *
 * Quests are activated by flags, soul conditions, or scene events.
 * Individual objectives complete independently; the quest completes
 * when all required objectives are done (optional ones are bonus).
 */

import { BaseService } from '../../engine/core/BaseService';
import { registry } from '../../engine/core/ServiceRegistry';
import type { Quest, QuestObjective, QuestStatus } from '@t/save';
import type { SoulCondition } from '@t/soul';
import type { ID } from '@t/core';

export interface QuestDefinition {
  id: ID;
  title: string;
  description: string;
  category: 'main' | 'side' | 'relationship' | 'hidden';
  characterId?: string;
  objectives: Array<Omit<QuestObjective, 'completed'>>;
  activationCondition: SoulCondition[];
  activationFlag?: string;
  completionReward?: { soulDelta?: Record<string, number>; itemIds?: ID[] };
  isSecret: boolean;
  chapter: number;
}

export class QuestSystem extends BaseService {
  private readonly definitions = new Map<ID, QuestDefinition>();
  private readonly quests = new Map<ID, Quest>();

  protected async onInit(): Promise<void> {
    this.subscribe('flag:set', ({ key }) => {
      this.checkFlagActivations(key);
      this.checkObjectiveFlags(key);
    });
    this.subscribe('soul:attribute_change', () => {
      this.checkConditionActivations();
    });
    this.subscribe('scene:end', ({ sceneId }) => {
      this.checkSceneObjectives(sceneId);
    });
  }

  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void {
    this.definitions.clear();
    this.quests.clear();
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  registerQuest(def: QuestDefinition): void {
    this.definitions.set(def.id, def);
    // Initialize as locked
    this.quests.set(def.id, {
      id: def.id,
      title: def.title,
      description: def.description,
      status: 'locked',
      objectives: def.objectives.map((o) => ({ ...o, completed: false })),
      category: def.category,
      characterId: def.characterId,
    });
  }

  // ---------------------------------------------------------------------------
  // State transitions
  // ---------------------------------------------------------------------------

  activate(id: ID): void {
    const quest = this.quests.get(id);
    if (!quest || quest.status !== 'locked') return;
    quest.status = 'active';
    quest.startedAt = Date.now();
    this.log(`Quest activated: "${quest.title}"`);
    this.bus.emit('quest:activated', { questId: id });
    this.bus.emit('ui:notification', { message: `Quest: ${quest.title}`, type: 'info' });
  }

  completeObjective(questId: ID, objectiveId: ID): void {
    const quest = this.quests.get(questId);
    if (!quest || quest.status !== 'active') return;

    const obj = quest.objectives.find((o) => o.id === objectiveId);
    if (!obj || obj.completed) return;

    obj.completed = true;
    this.log(`Objective complete: "${obj.description}" in "${quest.title}"`);

    this.checkQuestCompletion(quest);
  }

  failQuest(id: ID): void {
    const quest = this.quests.get(id);
    if (!quest || quest.status !== 'active') return;
    quest.status = 'failed';
    this.log(`Quest failed: "${quest.title}"`);
  }

  private checkQuestCompletion(quest: Quest): void {
    const allRequired = quest.objectives.filter((o) => !o.optional).every((o) => o.completed);
    if (!allRequired) return;

    quest.status = 'completed';
    quest.completedAt = Date.now();
    this.log(`Quest completed: "${quest.title}"`);
    this.bus.emit('ui:notification', { message: `Quest complete: ${quest.title}`, type: 'success' });
  }

  // ---------------------------------------------------------------------------
  // Condition / flag checks
  // ---------------------------------------------------------------------------

  private checkFlagActivations(flag: string): void {
    this.definitions.forEach((def, id) => {
      if (def.activationFlag === flag) this.activate(id);
    });
  }

  private checkConditionActivations(): void {
    const soul = registry.get<import('../soul/SoulSystem').SoulSystem>('soul');

    this.definitions.forEach((def, id) => {
      const quest = this.quests.get(id);
      if (!quest || quest.status !== 'locked') return;
      if (def.activationCondition.length === 0) return;
      const met = def.activationCondition.every((c) => soul.evaluateCondition(c));
      if (met) this.activate(id);
    });
  }

  private checkObjectiveFlags(flag: string): void {
    this.quests.forEach((quest) => {
      if (quest.status !== 'active') return;
      quest.objectives.forEach((obj) => {
        if (!obj.completed && obj.id === flag) {
          this.completeObjective(quest.id, obj.id);
        }
      });
    });
  }

  private checkSceneObjectives(sceneId: ID): void {
    this.quests.forEach((quest) => {
      if (quest.status !== 'active') return;
      quest.objectives.forEach((obj) => {
        if (!obj.completed && obj.id === `scene:${sceneId}`) {
          this.completeObjective(quest.id, obj.id);
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  getQuest(id: ID): Quest | undefined { return this.quests.get(id); }

  getActive(): Quest[] {
    return [...this.quests.values()].filter((q) => q.status === 'active');
  }

  getCompleted(): Quest[] {
    return [...this.quests.values()].filter((q) => q.status === 'completed');
  }

  getFailed(): Quest[] {
    return [...this.quests.values()].filter((q) => q.status === 'failed');
  }

  getByCategory(category: Quest['category']): Quest[] {
    return [...this.quests.values()].filter((q) => q.category === category);
  }

  getAll(): Quest[] { return [...this.quests.values()]; }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  serialize(): Record<ID, Quest> {
    return Object.fromEntries(this.quests);
  }

  deserialize(data: Record<ID, Quest>): void {
    Object.entries(data).forEach(([id, quest]) => {
      this.quests.set(id, quest);
    });
  }
}
