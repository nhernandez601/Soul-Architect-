/**
 * CodexSystem — in-game lore encyclopedia.
 *
 * Tracks unlocked codex entries (world-building, characters, concepts, locations).
 * Entries are gated by soul conditions, flags, or scene visits.
 * Fired through the event bus so UI can react instantly.
 */

import { BaseService } from '../../engine/core/BaseService';
import { registry } from '../../engine/core/ServiceRegistry';
import type { SoulCondition } from '@t/soul';
import type { ID } from '@t/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CodexCategory =
  | 'world'
  | 'character'
  | 'concept'
  | 'location'
  | 'artifact'
  | 'event'
  | 'creature'
  | 'philosophy';

export interface CodexEntry {
  id: ID;
  title: string;
  category: CodexCategory;
  summary: string;
  fullContent: string;
  iconPath: string;
  unlockCondition: SoulCondition[];
  relatedEntries: ID[];
  tags: string[];
  isSecret: boolean;
  unlockedAt?: number; // timestamp
  isNew: boolean;
}

export interface CodexSearchResult {
  entry: CodexEntry;
  relevanceScore: number;
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

export class CodexSystem extends BaseService {
  private readonly entries = new Map<ID, CodexEntry>();
  private readonly unlocked = new Set<ID>();
  private readonly newIds = new Set<ID>();

  protected async onInit(): Promise<void> {
    this.subscribe('scene:node_exit', ({ sceneId }) => {
      this.checkSceneUnlocks(sceneId);
    });
    this.subscribe('soul:attribute_change', () => {
      this.checkConditionUnlocks();
    });
    this.subscribe('flag:set', () => {
      this.checkConditionUnlocks();
    });
  }

  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void {
    this.entries.clear();
    this.unlocked.clear();
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  registerEntry(entry: CodexEntry): void {
    this.entries.set(entry.id, entry);
  }

  registerEntries(entries: CodexEntry[]): void {
    entries.forEach((e) => this.registerEntry(e));
  }

  // ---------------------------------------------------------------------------
  // Unlock
  // ---------------------------------------------------------------------------

  unlock(id: ID): void {
    if (this.unlocked.has(id)) return;
    const entry = this.entries.get(id);
    if (!entry) { this.warn(`Codex entry "${id}" not found`); return; }

    this.unlocked.add(id);
    this.newIds.add(id);
    entry.unlockedAt = Date.now();
    entry.isNew = true;

    this.log(`Unlocked: "${entry.title}"`);
    this.bus.emit('codex:unlocked', { entryId: id });
    this.bus.emit('ui:notification', {
      message: `Codex unlocked: ${entry.title}`,
      type: 'info',
    });
  }

  markRead(id: ID): void {
    const entry = this.entries.get(id);
    if (entry) { entry.isNew = false; this.newIds.delete(id); }
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  getEntry(id: ID): CodexEntry | undefined {
    return this.entries.get(id);
  }

  getUnlocked(category?: CodexCategory): CodexEntry[] {
    return [...this.unlocked]
      .map((id) => this.entries.get(id)!)
      .filter((e) => e && (!category || e.category === category))
      .sort((a, b) => (a.unlockedAt ?? 0) - (b.unlockedAt ?? 0));
  }

  search(query: string): CodexSearchResult[] {
    const q = query.toLowerCase();
    return [...this.unlocked]
      .map((id) => this.entries.get(id)!)
      .filter(Boolean)
      .map((entry) => {
        let score = 0;
        if (entry.title.toLowerCase().includes(q)) score += 10;
        if (entry.summary.toLowerCase().includes(q)) score += 5;
        if (entry.fullContent.toLowerCase().includes(q)) score += 2;
        if (entry.tags.some((t) => t.toLowerCase().includes(q))) score += 3;
        return { entry, relevanceScore: score };
      })
      .filter((r) => r.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  getNewCount(): number { return this.newIds.size; }
  isUnlocked(id: ID): boolean { return this.unlocked.has(id); }

  // ---------------------------------------------------------------------------
  // Condition checking
  // ---------------------------------------------------------------------------

  private checkSceneUnlocks(sceneId: ID): void {
    this.entries.forEach((entry, id) => {
      if (this.unlocked.has(id)) return;
      if (entry.tags.includes(`scene:${sceneId}`)) this.unlock(id);
    });
  }

  private checkConditionUnlocks(): void {
    const soul = registry.get<import('../soul/SoulSystem').SoulSystem>('soul');

    this.entries.forEach((entry, id) => {
      if (this.unlocked.has(id)) return;
      if (entry.unlockCondition.length === 0) return;
      const met = entry.unlockCondition.every((c) => soul.evaluateCondition(c));
      if (met) this.unlock(id);
    });
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  serialize(): { unlocked: ID[]; newIds: ID[] } {
    return { unlocked: [...this.unlocked], newIds: [...this.newIds] };
  }

  deserialize(data: { unlocked: ID[]; newIds: ID[] }): void {
    data.unlocked.forEach((id) => this.unlocked.add(id));
    data.newIds.forEach((id) => this.newIds.add(id));
    this.entries.forEach((entry) => {
      if (this.unlocked.has(entry.id)) entry.isNew = this.newIds.has(entry.id);
    });
  }
}
