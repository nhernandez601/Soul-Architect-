/**
 * InventorySystem — manages items the player collects throughout the story.
 *
 * Items are primarily narrative objects (letters, artifacts, memories).
 * They can gate dialogue, unlock codex entries, or reveal character secrets.
 */

import { BaseService } from '../../engine/core/BaseService';
import type { InventoryItem } from '@t/save';
import type { SoulCondition } from '@t/soul';
import type { ID } from '@t/core';

export interface ItemDefinition {
  id: ID;
  name: string;
  description: string;
  iconPath: string;
  category: 'letter' | 'artifact' | 'memory' | 'key' | 'document' | 'token' | 'relic';
  isStackable: boolean;
  maxStack: number;
  useCondition?: SoulCondition[];
  onUseFlag?: string;
  onUseSoulDelta?: Record<string, number>;
  isConsumable: boolean;
  isQuestItem: boolean;
  loreText?: string;
}

export class InventorySystem extends BaseService {
  private readonly definitions = new Map<ID, ItemDefinition>();
  private items = new Map<ID, InventoryItem>();
  private capacity = 50;

  protected async onInit(): Promise<void> {
    this.subscribe('flag:set', ({ key }) => {
      // Items can be added via flag events from scenes
      if (key.startsWith('give_item:')) {
        const itemId = key.replace('give_item:', '');
        this.addItem(itemId);
      }
    });
  }

  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void {
    this.definitions.clear();
    this.items.clear();
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  registerItem(def: ItemDefinition): void {
    this.definitions.set(def.id, def);
  }

  registerItems(defs: ItemDefinition[]): void {
    defs.forEach((d) => this.registerItem(d));
  }

  // ---------------------------------------------------------------------------
  // Item management
  // ---------------------------------------------------------------------------

  addItem(id: ID, quantity = 1): boolean {
    const def = this.definitions.get(id);
    if (!def) { this.warn(`Item "${id}" not defined`); return false; }

    if (!def.isStackable && this.items.has(id)) {
      this.warn(`Item "${id}" is not stackable and already in inventory`);
      return false;
    }

    if (this.items.size >= this.capacity) {
      this.warn('Inventory full');
      this.bus.emit('ui:notification', { message: 'Inventory is full', type: 'warn' });
      return false;
    }

    const existing = this.items.get(id);
    if (existing && def.isStackable) {
      existing.quantity = Math.min(existing.quantity + quantity, def.maxStack);
    } else {
      this.items.set(id, {
        id,
        name: def.name,
        description: def.description,
        iconPath: def.iconPath,
        quantity,
        category: def.category,
        obtained: Date.now(),
        used: false,
      });
    }

    this.bus.emit('ui:notification', { message: `Obtained: ${def.name}`, type: 'info' });
    this.log(`Added: "${def.name}" x${quantity}`);
    return true;
  }

  removeItem(id: ID, quantity = 1): boolean {
    const item = this.items.get(id);
    if (!item) return false;

    item.quantity -= quantity;
    if (item.quantity <= 0) this.items.delete(id);
    return true;
  }

  useItem(id: ID): boolean {
    const item = this.items.get(id);
    const def = this.definitions.get(id);
    if (!item || !def) return false;

    if (def.useCondition) {
      const { registry } = require('../../engine/core/ServiceRegistry') as typeof import('../../engine/core/ServiceRegistry');
      const soul = registry.get<import('../soul/SoulSystem').SoulSystem>('soul');
      const met = def.useCondition.every((c) => soul.evaluateCondition(c));
      if (!met) {
        this.bus.emit('ui:notification', { message: 'Cannot use this yet.', type: 'warn' });
        return false;
      }
    }

    item.used = true;

    if (def.onUseFlag) {
      this.bus.emit('flag:set', { key: def.onUseFlag, value: true });
    }

    if (def.onUseSoulDelta) {
      const { registry } = require('../../engine/core/ServiceRegistry') as typeof import('../../engine/core/ServiceRegistry');
      const soul = registry.get<import('../soul/SoulSystem').SoulSystem>('soul');
      soul.applyDelta(def.onUseSoulDelta, `item:${id}`);
    }

    if (def.isConsumable) this.removeItem(id);

    this.log(`Used: "${def.name}"`);
    return true;
  }

  hasItem(id: ID): boolean { return this.items.has(id); }

  getItem(id: ID): InventoryItem | undefined { return this.items.get(id); }

  getAll(): InventoryItem[] {
    return [...this.items.values()].sort((a, b) => b.obtained - a.obtained);
  }

  getByCategory(category: string): InventoryItem[] {
    return this.getAll().filter((i) => i.category === category);
  }

  getCapacity(): number { return this.capacity; }
  getUsed(): number { return this.items.size; }

  setCapacity(n: number): void { this.capacity = n; }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  serialize(): { items: Record<ID, InventoryItem>; capacity: number } {
    return {
      items: Object.fromEntries(this.items),
      capacity: this.capacity,
    };
  }

  deserialize(data: { items: Record<ID, InventoryItem>; capacity: number }): void {
    this.items = new Map(Object.entries(data.items));
    this.capacity = data.capacity;
  }
}
