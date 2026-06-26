/**
 * JournalSystem — manages the player's in-game journal.
 *
 * Journal entries are written by the story (via scene nodes or scripts)
 * and reflect the player's discoveries, reflections, and narrative progress.
 * Supports full-text search, tagging, and character-linked entries.
 */

import { BaseService } from '../../engine/core/BaseService';
import type { JournalEntry } from '@t/save';
export type { JournalEntry };
import type { ID } from '@t/core';

export class JournalSystem extends BaseService {
  private entries: JournalEntry[] = [];
  private nextId = 1;

  protected async onInit(): Promise<void> {
    this.subscribe('dialogue:line_complete', () => {
      // Memory log is handled by MemoryLogSystem; journal is manual/scripted.
    });
  }

  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void { this.entries = []; }

  // ---------------------------------------------------------------------------
  // Entries
  // ---------------------------------------------------------------------------

  addEntry(partial: Omit<JournalEntry, 'id' | 'timestamp' | 'isNew'>): JournalEntry {
    const entry: JournalEntry = {
      ...partial,
      id: `journal_${this.nextId++}`,
      timestamp: Date.now(),
      isNew: true,
    };
    this.entries.push(entry);
    this.entries.sort((a, b) => b.timestamp - a.timestamp);

    this.bus.emit('ui:notification', {
      message: `Journal updated: ${entry.title}`,
      type: 'info',
    });

    this.log(`Entry added: "${entry.title}"`);
    return entry;
  }

  updateEntry(id: ID, patch: Partial<Omit<JournalEntry, 'id'>>): void {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return;
    Object.assign(entry, patch);
  }

  deleteEntry(id: ID): void {
    this.entries = this.entries.filter((e) => e.id !== id);
  }

  markRead(id: ID): void {
    const entry = this.entries.find((e) => e.id === id);
    if (entry) entry.isNew = false;
  }

  markAllRead(): void {
    this.entries.forEach((e) => { e.isNew = false; });
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  getAll(): JournalEntry[] {
    return [...this.entries];
  }

  getByCharacter(characterId: string): JournalEntry[] {
    return this.entries.filter((e) => e.characterId === characterId);
  }

  getByTag(tag: string): JournalEntry[] {
    return this.entries.filter((e) => e.tags.includes(tag));
  }

  search(query: string): JournalEntry[] {
    const q = query.toLowerCase();
    return this.entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  getNewCount(): number {
    return this.entries.filter((e) => e.isNew).length;
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  serialize(): JournalEntry[] {
    return [...this.entries];
  }

  deserialize(entries: JournalEntry[]): void {
    this.entries = entries;
    this.nextId = entries.length + 1;
  }
}
