/**
 * CameraManager — controls the PixiJS stage viewport (zoom, pan, shake).
 *
 * All visual effects that move or transform the camera run through here.
 */

import { Container } from 'pixi.js';
import { gsap } from 'gsap';
import { BaseService } from '../core/BaseService';
import type { CameraEffect } from '@t/scene';

export class CameraManager extends BaseService {
  private viewport: Container | null = null;
  private baseX = 0;
  private baseY = 0;
  private baseScale = 1;

  protected async onInit(): Promise<void> { /* nothing */ }
  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void { this.viewport = null; }

  attachViewport(container: Container): void {
    this.viewport = container;
  }

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  async applyEffect(effect: CameraEffect, durationMs: number): Promise<void> {
    if (!this.viewport) return;
    const sec = durationMs / 1000;

    switch (effect) {
      case 'shake':     await this.shake(sec); break;
      case 'zoom-in':   await this.zoom(1.2, sec); break;
      case 'zoom-out':  await this.zoom(1.0 / 1.2, sec); break;
      case 'pan-left':  await this.pan(-100, 0, sec); break;
      case 'pan-right': await this.pan(100, 0, sec); break;
      case 'pan-up':    await this.pan(0, -80, sec); break;
      case 'pan-down':  await this.pan(0, 80, sec); break;
      case 'reset':     await this.reset(sec); break;
      default: this.warn(`Unknown camera effect: ${effect}`);
    }
  }

  private async shake(durationSec: number): Promise<void> {
    if (!this.viewport) return;
    const strength = 15;
    await gsap.to(this.viewport, {
      keyframes: [
        { x: this.baseX + strength, duration: 0.05 },
        { x: this.baseX - strength, duration: 0.05 },
        { x: this.baseX + strength * 0.5, duration: 0.05 },
        { x: this.baseX - strength * 0.5, duration: 0.05 },
        { x: this.baseX, duration: 0.05 },
      ],
      repeat: Math.floor(durationSec / 0.25),
    });
  }

  private async zoom(factor: number, durationSec: number): Promise<void> {
    if (!this.viewport) return;
    this.baseScale *= factor;
    await gsap.to(this.viewport.scale, {
      x: this.baseScale,
      y: this.baseScale,
      duration: durationSec,
      ease: 'power2.inOut',
    });
  }

  private async pan(dx: number, dy: number, durationSec: number): Promise<void> {
    if (!this.viewport) return;
    this.baseX += dx;
    this.baseY += dy;
    await gsap.to(this.viewport, {
      x: this.baseX,
      y: this.baseY,
      duration: durationSec,
      ease: 'power2.inOut',
    });
  }

  private async reset(durationSec: number): Promise<void> {
    if (!this.viewport) return;
    this.baseX = 0;
    this.baseY = 0;
    this.baseScale = 1;
    await gsap.to(this.viewport, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: durationSec, ease: 'power2.out' });
  }
}
