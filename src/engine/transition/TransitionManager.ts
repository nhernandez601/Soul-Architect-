/**
 * TransitionManager — orchestrates screen transitions between scenes.
 *
 * Runs fade-to/from-black, white flash, and iris-in/out transitions.
 * Uses a two-phase approach: fade-out (to midpoint) → scene load → fade-in.
 * The React layer renders the overlay; this manager drives the timeline.
 */

import { BaseService } from '../core/BaseService';

export type TransitionStyle = 'fade' | 'flash' | 'iris';

export interface TransitionOptions {
  style?: TransitionStyle;
  durationMs?: number;
  color?: number;  // 0x000000 (black) or 0xffffff (white)
  holdMs?: number; // ms to hold at full opacity before fade-in
}

const DEFAULTS: Required<TransitionOptions> = {
  style: 'fade',
  durationMs: 600,
  color: 0x000000,
  holdMs: 80,
};

export class TransitionManager extends BaseService {
  private activeTransition: Promise<void> | null = null;
  private resolveTransition: (() => void) | null = null;

  protected async onInit(): Promise<void> {
    this.subscribe('transition:midpoint', () => {
      // Scene loading can call .resolveMidpoint() after this fires
    });
  }

  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void {
    this.resolveTransition?.();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Run a full two-phase transition (out → midpoint → in).
   * The optional `onMidpoint` callback fires at the black frame so the caller
   * can swap scenes or load assets without the user seeing the swap.
   */
  async run(opts: TransitionOptions = {}, onMidpoint?: () => Promise<void> | void): Promise<void> {
    if (this.activeTransition) await this.activeTransition;

    const config = { ...DEFAULTS, ...opts };

    this.activeTransition = this._run(config, onMidpoint);
    await this.activeTransition;
    this.activeTransition = null;
  }

  private async _run(
    config: Required<TransitionOptions>,
    onMidpoint?: () => Promise<void> | void,
  ): Promise<void> {
    // Phase 1: fade out
    this.bus.emit('transition:start', {
      style: config.style,
      durationMs: config.durationMs,
      color: config.color,
    });

    // Wait for the fade-out to complete — the React layer fires 'transition:midpoint'
    await this.waitForMidpoint(config.durationMs + config.holdMs);

    // Run caller-supplied work at the invisible frame
    if (onMidpoint) await onMidpoint();

    this.bus.emit('transition:midpoint');

    // Phase 2: fade in — same duration
    await this.delay(config.durationMs);
    this.bus.emit('transition:complete', { style: config.style });
  }

  /** Convenience: just fade the screen to black (no automatic fade-in). */
  async fadeOut(durationMs = 600, color = 0x000000): Promise<void> {
    this.bus.emit('transition:start', { style: 'fade', durationMs, color });
    await this.delay(durationMs);
  }

  /** Convenience: fade in from black. */
  async fadeIn(durationMs = 600): Promise<void> {
    await this.delay(durationMs);
    this.bus.emit('transition:complete', { style: 'fade' });
  }

  /** Flash (instant black frame). */
  async flash(color = 0xffffff, durationMs = 200): Promise<void> {
    this.bus.emit('transition:start', { style: 'flash', durationMs, color });
    await this.delay(durationMs);
    this.bus.emit('transition:complete', { style: 'flash' });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private waitForMidpoint(fallbackMs: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.resolveTransition = resolve;
      // Safety fallback — resolve automatically after expected duration
      setTimeout(resolve, fallbackMs + 200);
    });
  }

  resolveMidpoint(): void {
    this.resolveTransition?.();
    this.resolveTransition = null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
