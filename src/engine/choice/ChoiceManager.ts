/**
 * ChoiceManager — presents choice menus and resolves the selected option.
 *
 * Works with the UI layer (which renders the actual buttons) via the event bus.
 * Also applies soul deltas and flag changes immediately on selection.
 */

import { BaseService } from '../core/BaseService';
import { registry } from '../core/ServiceRegistry';
import type { ChoiceNode, Choice } from '@types/scene';

export class ChoiceManager extends BaseService {
  private resolveChoice: ((choice: Choice) => void) | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  protected async onInit(): Promise<void> { /* nothing */ }
  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void {
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
  }

  // ---------------------------------------------------------------------------
  // Present a choice node — returns the selected Choice
  // ---------------------------------------------------------------------------

  present(node: ChoiceNode): Promise<Choice> {
    this.bus.emit('choice:presented', { nodeId: node.id, count: node.choices.length });

    return new Promise<Choice>((resolve) => {
      this.resolveChoice = resolve;

      // Timeout auto-select
      if (node.timeoutMs && node.defaultChoice !== undefined) {
        this.timeoutHandle = setTimeout(() => {
          const defaultOpt = node.choices[node.defaultChoice!];
          if (defaultOpt) this.selectChoice(node.id, defaultOpt);
        }, node.timeoutMs);
      }

      // Listen for UI selection event
      const unsub = this.bus.on('choice:selected', ({ nodeId, choiceId }) => {
        if (nodeId !== node.id) return;
        unsub();

        const selected = node.choices.find((c) => c.id === choiceId);
        if (!selected) { this.warn(`Choice "${choiceId}" not found in node "${node.id}"`); return; }

        this.selectChoice(node.id, selected);
      });
    });
  }

  private selectChoice(nodeId: string, choice: Choice): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    // Apply soul delta
    if (choice.soulDelta) {
      const soul = registry.get<import('../../systems/soul/SoulSystem').SoulSystem>('soul');
      soul.applyDelta(choice.soulDelta, `choice:${choice.id}`);
    }

    // Apply relationship deltas
    if (choice.relationshipDeltas) {
      const rel = registry.get<import('../../systems/relationship/RelationshipSystem').RelationshipSystem>('relationship');
      Object.entries(choice.relationshipDeltas).forEach(([charId, delta]) => {
        rel.applyDelta(charId as import('@types/character').CharacterID, 'affinity', delta);
      });
    }

    // Apply flags
    if (choice.flagsSet) {
      Object.entries(choice.flagsSet).forEach(([key, value]) => {
        this.bus.emit('flag:set', { key, value });
      });
    }

    this.resolveChoice?.(choice);
    this.resolveChoice = null;
  }

  // ---------------------------------------------------------------------------
  // External trigger (from UI component)
  // ---------------------------------------------------------------------------

  confirmSelection(nodeId: string, choiceIndex: number, choiceId: string): void {
    this.bus.emit('choice:selected', { nodeId, choiceId, choiceIndex });
  }
}
