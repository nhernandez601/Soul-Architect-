/**
 * AnimationManager — GSAP-powered animation orchestration.
 *
 * Provides a named timeline library for reusable scene animations,
 * character entrance/exit effects, screen effects, and UI transitions.
 */

import { gsap } from 'gsap';
import { BaseService } from '../core/BaseService';

type AnimationTarget = object;

export interface AnimationDef {
  targets: AnimationTarget | AnimationTarget[];
  vars: gsap.TweenVars;
  stagger?: number;
}

export class AnimationManager extends BaseService {
  private readonly timelines = new Map<string, gsap.core.Timeline>();

  protected async onInit(): Promise<void> { /* nothing */ }
  protected async onStart(): Promise<void> { /* nothing */ }
  protected onPause(): void { gsap.globalTimeline.pause(); }
  protected onResume(): void { gsap.globalTimeline.resume(); }
  protected onDestroy(): void {
    this.timelines.forEach((tl) => tl.kill());
    this.timelines.clear();
    gsap.killTweensOf('*');
  }

  // ---------------------------------------------------------------------------
  // One-shot animations
  // ---------------------------------------------------------------------------

  async play(def: AnimationDef): Promise<void> {
    const targets = Array.isArray(def.targets) ? def.targets : [def.targets];
    await gsap.to(targets, def.vars);
  }

  async fadeIn(target: AnimationTarget, durationSec = 0.5): Promise<void> {
    await gsap.fromTo(target, { alpha: 0 }, { alpha: 1, duration: durationSec });
  }

  async fadeOut(target: AnimationTarget, durationSec = 0.5): Promise<void> {
    await gsap.to(target, { alpha: 0, duration: durationSec });
  }

  async slideIn(
    target: AnimationTarget,
    direction: 'left' | 'right' | 'up' | 'down' = 'left',
    durationSec = 0.4
  ): Promise<void> {
    const from: gsap.TweenVars = { alpha: 0 };
    if (direction === 'left')  from['x'] = -100;
    if (direction === 'right') from['x'] = 100;
    if (direction === 'up')    from['y'] = -100;
    if (direction === 'down')  from['y'] = 100;

    await gsap.fromTo(target, from, { alpha: 1, x: 0, y: 0, duration: durationSec, ease: 'power2.out' });
  }

  async pulse(target: AnimationTarget, scale = 1.05, durationSec = 0.2): Promise<void> {
    await gsap.to(target, { scale, duration: durationSec, yoyo: true, repeat: 1, ease: 'sine.inOut' });
  }

  shake(target: AnimationTarget, strength = 10, durationSec = 0.4): void {
    gsap.to(target, {
      keyframes: [
        { x: strength, duration: 0.05 },
        { x: -strength, duration: 0.05 },
        { x: strength * 0.5, duration: 0.05 },
        { x: -strength * 0.5, duration: 0.05 },
        { x: 0, duration: 0.05 },
      ],
      repeat: Math.floor(durationSec / 0.25),
      ease: 'none',
    });
  }

  // ---------------------------------------------------------------------------
  // Named timelines (for complex, reusable sequences)
  // ---------------------------------------------------------------------------

  createTimeline(id: string, vars?: gsap.TimelineVars): gsap.core.Timeline {
    const tl = gsap.timeline({ paused: true, ...vars });
    this.timelines.set(id, tl);
    return tl;
  }

  getTimeline(id: string): gsap.core.Timeline | undefined {
    return this.timelines.get(id);
  }

  async playTimeline(id: string): Promise<void> {
    const tl = this.timelines.get(id);
    if (!tl) { this.warn(`Timeline "${id}" not found`); return; }
    await tl.play(0);
  }

  killTimeline(id: string): void {
    this.timelines.get(id)?.kill();
    this.timelines.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Screen effects
  // ---------------------------------------------------------------------------

  async screenFlash(color = 0xffffff, durationSec = 0.3): Promise<void> {
    // These are handled at the PixiJS level through ParticleManager.
    // This method exists as a coordination point.
    this.bus.emit('ui:notification', {
      message: `flash:${color}:${durationSec}`,
      type: 'info',
    });
  }

  screenShake(strength = 15, durationSec = 0.5): void {
    this.bus.emit('input:action', { action: 'camera-shake' });
    void strength; void durationSec;
  }
}
