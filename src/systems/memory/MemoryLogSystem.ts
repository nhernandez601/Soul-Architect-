/**
 * MemoryLogSystem — records every line of dialogue the player encounters.
 *
 * Acts as a backlog/history view so players can review what was said.
 * Supports scene-grouped entries, speaker filtering, and full-text search.
 * Capacity-limited with oldest entries pruned first.
 */

import { BaseService } from '../../engine/core/BaseService';
import type { MemoryLogEntry } from '@t/save';
import type { CharacterID } from '@t/character';
import type { ID } from '@t/core';

const MAX_ENTRIES = 2000;

export class MemoryLogSystem extends BaseService {
  private entries: MemoryLogEntry[] = [];
  private nextId = 1;
  private currentSceneId = '';
  private currentNodeId = '';

  protected async onInit(): Promise<void> {
    this.subscribe('scene:load_complete', ({ sceneId }) => {
      this.currentSceneId = sceneId;
    });

    this.subscribe('scene:node_enter', ({ nodeId }) => {
      this.currentNodeId = nodeId;
    });

    this.subscribe('dialogue:line_start', ({ nodeId, speaker, text }) => {
      this.record(text, speaker, nodeId);
    });
  }

  protected async onStart(): Promise<void> { /* nothing */ }

  protected onDestroy(): void { this.entries = []; }

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  record(text: string, speaker: CharacterID | 'narrator' | null, nodeId: ID): void {
    const entry: MemoryLogEntry = {
      id: `mem_${this.nextId++}`,
      sceneId: this.currentSceneId,
      nodeId,
      text,
      speaker: speaker ?? undefined,
      timestamp: Date.now(),
    };

    this.entries.push(entry);

    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  getAll(): MemoryLogEntry[] {
    return [...this.entries].reverse(); // newest first
  }

  getByScene(sceneId: ID): MemoryLogEntry[] {
    return this.entries.filter((e) => e.sceneId === sceneId);
  }

  getBySpeaker(speaker: string): MemoryLogEntry[] {
    return this.entries.filter((e) => e.speaker === speaker);
  }

  search(query: string): MemoryLogEntry[] {
    const q = query.toLowerCase();
    return this.entries.filter((e) => e.text.toLowerCase().includes(q)).reverse();
  }

  getLast(count: number): MemoryLogEntry[] {
    return this.entries.slice(-count).reverse();
  }

  clear(): void { this.entries = []; }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  serialize(): MemoryLogEntry[] {
    return [...this.entries];
  }

  deserialize(entries: MemoryLogEntry[]): void {
    this.entries = entries;
    this.nextId = entries.length + 1;
  }
}
