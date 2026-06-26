/**
 * SoulSystem — manages the 12 soul attributes and all hidden variables.
 *
 * Every choice, scene event, and relationship change runs through here.
 * Provides condition evaluation, archetype computation, and milestone detection.
 */

import { BaseService } from '../../engine/core/BaseService';
import type {
  SoulStats,
  SoulState,
  SoulAttribute,
  SoulDelta,
  SoulChange,
  SoulArchetype,
  SoulCondition,
  SoulMilestone,
  HiddenVariables,
  SOUL_ATTRIBUTES,
} from '@t/soul';
import { ARCHETYPE_THRESHOLDS } from '@t/soul';
import type { ConditionOperator } from '@t/soul';

const DEFAULT_SOUL_STATS: SoulStats = {
  hope: 50,
  faith: 50,
  fear: 10,
  love: 50,
  knowledge: 30,
  compassion: 50,
  pride: 30,
  regret: 10,
  memory: 50,
  purpose: 50,
  light: 50,
  shadow: 20,
};

export class SoulSystem extends BaseService {
  private stats: SoulStats = { ...DEFAULT_SOUL_STATS };
  private hidden: HiddenVariables = {};
  private history: SoulChange[] = [];
  private milestones: SoulMilestone[] = [];
  private flags: Record<string, boolean | string | number> = {};

  protected async onInit(): Promise<void> {
    this.subscribe('flag:set', ({ key, value }) => {
      this.flags[key] = value;
      this.bus.emit('variable:set', { key, value });
    });
  }

  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void { /* nothing */ }

  // ---------------------------------------------------------------------------
  // Delta application
  // ---------------------------------------------------------------------------

  applyDelta(delta: SoulDelta, source: string): void {
    const changes: SoulChange[] = [];

    (Object.keys(delta) as SoulAttribute[]).forEach((attr) => {
      const d = delta[attr];
      if (d === undefined) return;

      const oldValue = this.stats[attr];
      const newValue = Math.max(0, Math.min(100, oldValue + d));
      this.stats[attr] = newValue;

      const change: SoulChange = { attribute: attr, delta: d, source, timestamp: Date.now() };
      changes.push(change);
      this.history.push(change);

      this.bus.emit('soul:attribute_change', { attribute: attr, oldValue, newValue });
    });

    if (changes.length > 0) {
      this.bus.emit('soul:change', { delta, source });
    }

    const prevArchetype = this.computeArchetype();
    const newArchetype = this.recomputeArchetype();
    if (prevArchetype !== newArchetype) {
      this.bus.emit('soul:archetype_change', { oldArchetype: prevArchetype, newArchetype });
    }

    this.checkMilestones();
  }

  setHidden(key: string, value: number | boolean | string): void {
    this.hidden[key] = value;
    this.bus.emit('variable:set', { key, value: value as string | number | boolean });
  }

  getHidden(key: string): number | boolean | string | undefined {
    return this.hidden[key];
  }

  // ---------------------------------------------------------------------------
  // Condition evaluation
  // ---------------------------------------------------------------------------

  evaluateCondition(condition: SoulCondition): boolean {
    const { attribute, operator, value, value2 } = condition;

    let current: number | boolean | string;

    // Check soul attributes first
    if (attribute in this.stats) {
      current = this.stats[attribute as SoulAttribute];
    } else if (attribute in this.hidden) {
      current = this.hidden[attribute] ?? 0;
    } else if (attribute in this.flags) {
      current = this.flags[attribute] ?? false;
    } else {
      current = 0;
    }

    return this.compare(current, operator, value, value2);
  }

  private compare(
    current: number | boolean | string,
    op: ConditionOperator,
    value: number | boolean | string,
    value2?: number
  ): boolean {
    switch (op) {
      case '==':      return current === value;
      case '!=':      return current !== value;
      case '>':       return (current as number) > (value as number);
      case '<':       return (current as number) < (value as number);
      case '>=':      return (current as number) >= (value as number);
      case '<=':      return (current as number) <= (value as number);
      case 'between': return (
        typeof current === 'number' &&
        typeof value === 'number' &&
        typeof value2 === 'number' &&
        current >= value &&
        current <= value2
      );
      default: return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Archetype computation
  // ---------------------------------------------------------------------------

  private computeArchetype(): SoulArchetype {
    return this._currentArchetype;
  }

  private _currentArchetype: SoulArchetype = 'seeker';

  private recomputeArchetype(): SoulArchetype {
    const archetypes = Object.keys(ARCHETYPE_THRESHOLDS) as SoulArchetype[];

    for (const archetype of archetypes) {
      if (archetype === 'seeker') continue;
      const thresholds = ARCHETYPE_THRESHOLDS[archetype];
      const match = (Object.keys(thresholds) as SoulAttribute[]).every((attr) => {
        const [min, max] = thresholds[attr]!;
        return this.stats[attr] >= min && this.stats[attr] <= max;
      });
      if (match) {
        this._currentArchetype = archetype;
        return archetype;
      }
    }

    this._currentArchetype = 'seeker';
    return 'seeker';
  }

  // ---------------------------------------------------------------------------
  // Milestones
  // ---------------------------------------------------------------------------

  registerMilestone(milestone: SoulMilestone): void {
    this.milestones.push(milestone);
  }

  private checkMilestones(): void {
    this.milestones.forEach((m) => {
      const met = m.condition.every((c) => this.evaluateCondition(c));
      if (met) {
        this.bus.emit('soul:milestone', { milestoneId: m.id });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  getState(): SoulState {
    return {
      stats: { ...this.stats },
      hidden: { ...this.hidden },
      history: [...this.history],
      archetype: this._currentArchetype,
    };
  }

  loadState(state: SoulState): void {
    this.stats = { ...state.stats };
    this.hidden = { ...state.hidden };
    this.history = [...state.history];
    this._currentArchetype = state.archetype;
  }

  getFlag(key: string): boolean | string | number | undefined {
    return this.flags[key];
  }

  getStats(): Readonly<SoulStats> {
    return this.stats;
  }

  getAttribute(attr: SoulAttribute): number {
    return this.stats[attr];
  }

  get archetype(): SoulArchetype {
    return this._currentArchetype;
  }
}
