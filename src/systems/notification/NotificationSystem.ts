/**
 * NotificationSystem — queues and dispatches in-game toast notifications.
 *
 * Handles soul change flashes, achievement pops, item pickups, and
 * system alerts. Notifications auto-dismiss after a configurable duration.
 */

import { BaseService } from '../../engine/core/BaseService';
import type { ID } from '@t/core';

export type NotificationType = 'info' | 'warn' | 'success' | 'error' | 'soul' | 'achievement' | 'item';

export interface Notification {
  id: ID;
  message: string;
  subtext?: string;
  type: NotificationType;
  iconPath?: string;
  durationMs: number;
  timestamp: number;
  dismissed: boolean;
}

const DEFAULT_DURATION: Record<NotificationType, number> = {
  info:        3000,
  warn:        4000,
  success:     4000,
  error:       6000,
  soul:        2500,
  achievement: 5000,
  item:        3500,
};

export class NotificationSystem extends BaseService {
  private readonly queue: Notification[] = [];
  private readonly active: Notification[] = [];
  private readonly MAX_ACTIVE = 3;
  private idCounter = 0;
  private processInterval: ReturnType<typeof setInterval> | null = null;

  protected async onInit(): Promise<void> {
    // Auto-subscribe to common notification triggers
    this.subscribe('ui:notification', ({ message, type }) => {
      this.push({
        message,
        type: type as NotificationType,
      });
    });

    this.subscribe('soul:attribute_change', ({ attribute, oldValue, newValue }) => {
      const delta = newValue - oldValue;
      if (Math.abs(delta) < 5) return; // only notify on significant changes
      const sign = delta > 0 ? '+' : '';
      this.push({
        message: `${this.formatAttribute(attribute)} ${sign}${delta}`,
        type: 'soul',
        durationMs: 2000,
      });
    });

    this.subscribe('achievement:unlocked', ({ achievementId }) => {
      // Achievement name comes from AchievementSystem separately via ui:notification
      void achievementId;
    });

    this.subscribe('relationship:change', ({ characterId, stat, delta }) => {
      if (Math.abs(delta) < 5) return;
      const sign = delta > 0 ? '+' : '';
      this.push({
        message: `${this.formatCharacter(characterId)} ${stat} ${sign}${delta}`,
        type: 'info',
        durationMs: 2000,
      });
    });
  }

  protected async onStart(): Promise<void> {
    this.processInterval = setInterval(() => this.process(), 500);
  }

  protected onDestroy(): void {
    if (this.processInterval) clearInterval(this.processInterval);
    this.queue.length = 0;
    this.active.length = 0;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  push(partial: Partial<Notification> & { message: string }): Notification {
    const type = partial.type ?? 'info';
    const notification: Notification = {
      id: `notif_${this.idCounter++}`,
      message: partial.message,
      subtext: partial.subtext,
      type,
      iconPath: partial.iconPath,
      durationMs: partial.durationMs ?? DEFAULT_DURATION[type],
      timestamp: Date.now(),
      dismissed: false,
    };

    this.queue.push(notification);
    return notification;
  }

  dismiss(id: ID): void {
    const active = this.active.find((n) => n.id === id);
    if (active) active.dismissed = true;
  }

  dismissAll(): void {
    this.active.forEach((n) => { n.dismissed = true; });
  }

  getActive(): Notification[] {
    return this.active.filter((n) => !n.dismissed);
  }

  // ---------------------------------------------------------------------------
  // Processing
  // ---------------------------------------------------------------------------

  private process(): void {
    const now = Date.now();

    // Remove expired
    for (let i = this.active.length - 1; i >= 0; i--) {
      const n = this.active[i]!;
      if (n.dismissed || now - n.timestamp >= n.durationMs) {
        this.active.splice(i, 1);
      }
    }

    // Admit from queue
    while (this.queue.length > 0 && this.active.length < this.MAX_ACTIVE) {
      const next = this.queue.shift()!;
      next.timestamp = Date.now(); // reset timer when shown
      this.active.push(next);
    }
  }

  // ---------------------------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------------------------

  private formatAttribute(attr: string): string {
    return attr.charAt(0).toUpperCase() + attr.slice(1);
  }

  private formatCharacter(id: string): string {
    const names: Record<string, string> = {
      aurelia: 'Aurelia', nyx: 'Nyx', seraphine: 'Seraphine',
      mira: 'Mira', echo: 'Echo', elian: 'Elian',
    };
    return names[id] ?? id;
  }
}
