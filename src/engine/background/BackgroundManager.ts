/**
 * BackgroundManager — handles background display, parallax scrolling,
 * and scene-to-scene transitions using PixiJS sprites.
 */

import { Container, Sprite, Graphics } from 'pixi.js';
import { gsap } from 'gsap';
import { BaseService } from '../core/BaseService';
import { registry } from '../core/ServiceRegistry';
import type { BackgroundSpec, TransitionType } from '@types/scene';

export class BackgroundManager extends BaseService {
  private readonly stage: Container;
  private currentBg: Sprite | null = null;
  private nextBg: Sprite | null = null;
  private readonly parallaxLayers: Sprite[] = [];

  constructor() {
    super('BackgroundManager');
    this.stage = new Container();
    this.stage.label = 'background-layer';
  }

  protected async onInit(): Promise<void> { /* nothing */ }
  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void {
    this.currentBg?.destroy();
    this.nextBg?.destroy();
    this.parallaxLayers.forEach((l) => l.destroy());
  }

  // ---------------------------------------------------------------------------
  // Transition to a new background
  // ---------------------------------------------------------------------------

  async transition(spec: BackgroundSpec): Promise<void> {
    const assetMgr = registry.get<import('../core/AssetManager').AssetManager>('asset');
    const texture = await assetMgr.loadTexture(`/assets/backgrounds/${spec.id}`);

    const newSprite = new Sprite(texture);
    newSprite.width = this.stage.width || 1920;
    newSprite.height = this.stage.height || 1080;
    newSprite.alpha = 0;

    this.stage.addChildAt(newSprite, 0);
    this.nextBg = newSprite;

    await this.playTransition(spec.transitionIn, 600);

    if (this.currentBg) {
      this.stage.removeChild(this.currentBg);
      this.currentBg.destroy();
    }
    this.currentBg = this.nextBg;
    this.nextBg = null;
    this.currentBg.alpha = 1;
  }

  private async playTransition(type: TransitionType, durationMs: number): Promise<void> {
    if (!this.nextBg) return;
    const sec = durationMs / 1000;

    switch (type) {
      case 'fade':
      case 'dissolve':
        if (this.currentBg) await gsap.to(this.currentBg, { alpha: 0, duration: sec });
        await gsap.to(this.nextBg, { alpha: 1, duration: sec });
        break;
      case 'fade-white': {
        const overlay = new Graphics();
        overlay.rect(0, 0, 1920, 1080).fill(0xffffff);
        overlay.alpha = 0;
        this.stage.addChild(overlay);
        await gsap.to(overlay, { alpha: 1, duration: sec / 2 });
        this.nextBg.alpha = 1;
        if (this.currentBg) this.currentBg.alpha = 0;
        await gsap.to(overlay, { alpha: 0, duration: sec / 2 });
        overlay.destroy();
        break;
      }
      case 'none':
      default:
        this.nextBg.alpha = 1;
        if (this.currentBg) this.currentBg.alpha = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Parallax
  // ---------------------------------------------------------------------------

  updateParallax(mouseX: number, mouseY: number, canvasW: number, canvasH: number): void {
    this.parallaxLayers.forEach((layer, i) => {
      const depth = (i + 1) / this.parallaxLayers.length;
      const strength = depth * 20;
      layer.x = (mouseX / canvasW - 0.5) * -strength;
      layer.y = (mouseY / canvasH - 0.5) * -strength;
    });
  }

  get backgroundStage(): Container {
    return this.stage;
  }
}
