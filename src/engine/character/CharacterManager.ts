/**
 * CharacterManager — manages all character visuals, portraits, and state.
 *
 * Handles sprite display, portrait variant selection, entrance/exit animations,
 * position management, and synchronises with the runtime character state store.
 */

import { Container, Sprite } from 'pixi.js';
import { gsap } from 'gsap';
import { BaseService } from '../core/BaseService';
import { registry } from '../core/ServiceRegistry';
import type { EngineConfig, ID } from '@t/core';
import type { CharacterID, EmotionTag, CharacterDefinition, CharacterRuntimeState, PortraitVariant } from '@t/character';
import type { TransitionType } from '@t/scene';

interface ActiveCharacter {
  definition: CharacterDefinition;
  state: CharacterRuntimeState;
  container: Container;
  sprite: Sprite;
  textureLoaded: boolean;
}

const POSITION_X: Record<string, number> = {
  left: 0.2,   // fraction of canvas width
  center: 0.5,
  right: 0.8,
  offscreen: 1.5,
};

export class CharacterManager extends BaseService {
  private readonly stage: Container;
  private readonly active = new Map<CharacterID, ActiveCharacter>();
  private definitions = new Map<CharacterID, CharacterDefinition>();
  private canvasWidth = 1920;
  private canvasHeight = 1080;

  constructor(private readonly config: EngineConfig) {
    super('CharacterManager');
    this.stage = new Container();
    this.stage.label = 'character-layer';
    this.canvasWidth = config.renderer.width;
    this.canvasHeight = config.renderer.height;
  }

  protected async onInit(): Promise<void> { /* nothing to async-init */ }
  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void {
    this.active.forEach(({ container }) => container.destroy());
    this.active.clear();
  }

  // ---------------------------------------------------------------------------
  // Character definition registration
  // ---------------------------------------------------------------------------

  registerCharacter(def: CharacterDefinition): void {
    this.definitions.set(def.id, def);
  }

  registerCharacters(defs: CharacterDefinition[]): void {
    defs.forEach((d) => this.registerCharacter(d));
  }

  // ---------------------------------------------------------------------------
  // Show / Hide
  // ---------------------------------------------------------------------------

  async show(
    id: CharacterID,
    emotion: EmotionTag,
    position: 'left' | 'center' | 'right',
    transition: TransitionType = 'fade',
    durationMs = 500,
    tags: string[] = []
  ): Promise<void> {
    const def = this.definitions.get(id);
    if (!def) { this.warn(`Character "${id}" not registered`); return; }

    let active = this.active.get(id);

    if (!active) {
      const container = new Container();
      const sprite = new Sprite();
      container.addChild(sprite);
      this.stage.addChild(container);

      const state: CharacterRuntimeState = {
        id,
        stats: { ...def.stats },
        flags: new Set(def.flags),
        currentEmotion: emotion,
        currentTags: tags,
        visible: false,
        position,
        opacity: 0,
        scale: 1,
        discoveredSecrets: new Set(),
      };

      active = { definition: def, state, container, sprite, textureLoaded: false };
      this.active.set(id, active);
    }

    // Update state
    active.state.currentEmotion = emotion;
    active.state.currentTags = tags;
    active.state.position = position;
    active.state.visible = true;

    // Load portrait texture
    await this.loadPortrait(active, emotion, tags);

    // Position
    container: {
      const targetX = (POSITION_X[position] ?? 0.5) * this.canvasWidth;
      const targetY = this.canvasHeight; // bottom-aligned
      active.container.x = targetX;
      active.container.y = targetY;
    }

    this.bus.emit('character:show', { characterId: id, emotion });
    await this.playTransitionIn(active, transition, durationMs);
  }

  async hide(id: CharacterID, transition: TransitionType = 'fade', durationMs = 500): Promise<void> {
    const active = this.active.get(id);
    if (!active) return;

    this.bus.emit('character:hide', { characterId: id });
    await this.playTransitionOut(active, transition, durationMs);

    active.state.visible = false;
    active.container.visible = false;
  }

  // ---------------------------------------------------------------------------
  // Move / Emote
  // ---------------------------------------------------------------------------

  async moveTo(
    id: CharacterID,
    position: 'left' | 'center' | 'right',
    durationMs = 400,
    easing = 'power2.inOut'
  ): Promise<void> {
    const active = this.active.get(id);
    if (!active) return;

    const targetX = (POSITION_X[position] ?? 0.5) * this.canvasWidth;
    active.state.position = position;

    this.bus.emit('character:move', { characterId: id, position });

    await new Promise<void>((resolve) => {
      gsap.to(active.container, {
        x: targetX,
        duration: durationMs / 1000,
        ease: easing,
        onComplete: resolve,
      });
    });
  }

  setEmotion(id: CharacterID, emotion: EmotionTag, tags: string[] = []): void {
    const active = this.active.get(id);
    if (!active) return;

    active.state.currentEmotion = emotion;
    active.state.currentTags = tags;
    void this.loadPortrait(active, emotion, tags);
    this.bus.emit('character:emote', { characterId: id, emotion });
  }

  // ---------------------------------------------------------------------------
  // Portrait loading
  // ---------------------------------------------------------------------------

  private async loadPortrait(active: ActiveCharacter, emotion: EmotionTag, tags: string[]): Promise<void> {
    const variant = this.selectPortraitVariant(active.definition, emotion, tags);
    if (!variant) { this.warn(`No portrait variant for ${active.definition.id} / ${emotion}`); return; }

    const assetMgr = registry.get<import('../core/AssetManager').AssetManager>('asset');
    const texture = await assetMgr.loadTexture(variant.path);
    active.sprite.texture = texture;
    active.sprite.anchor.set(0.5, 1); // bottom-center pivot
    active.sprite.x = variant.offsetX;
    active.sprite.y = variant.offsetY;
    active.sprite.scale.set(variant.scale);
    active.textureLoaded = true;
  }

  /** Selects the best-matching portrait variant given emotion + tags. */
  private selectPortraitVariant(
    def: CharacterDefinition,
    emotion: EmotionTag,
    tags: string[]
  ): PortraitVariant | undefined {
    // Prefer exact match on emotion + all tags
    const exact = def.portraits.find(
      (p) => p.emotion === emotion && tags.every((t) => p.tags.includes(t))
    );
    if (exact) return exact;

    // Fallback: match emotion only
    const emotionMatch = def.portraits.find((p) => p.emotion === emotion);
    if (emotionMatch) return emotionMatch;

    // Final fallback: default portrait
    return def.portraits.find((p) => p.emotion === def.defaultPortrait);
  }

  // ---------------------------------------------------------------------------
  // Transition animations
  // ---------------------------------------------------------------------------

  private async playTransitionIn(
    active: ActiveCharacter,
    transition: TransitionType,
    durationMs: number
  ): Promise<void> {
    active.container.visible = true;
    const sec = durationMs / 1000;

    switch (transition) {
      case 'fade':
        active.container.alpha = 0;
        await gsap.to(active.container, { alpha: 1, duration: sec });
        break;
      case 'slide-left':
        active.container.x -= 200;
        active.container.alpha = 0;
        await gsap.to(active.container, { x: active.container.x + 200, alpha: 1, duration: sec, ease: 'power2.out' });
        break;
      case 'none':
      default:
        active.container.alpha = 1;
    }
  }

  private async playTransitionOut(
    active: ActiveCharacter,
    transition: TransitionType,
    durationMs: number
  ): Promise<void> {
    const sec = durationMs / 1000;

    switch (transition) {
      case 'fade':
        await gsap.to(active.container, { alpha: 0, duration: sec });
        break;
      case 'slide-right':
        await gsap.to(active.container, { x: active.container.x + 200, alpha: 0, duration: sec, ease: 'power2.in' });
        break;
      case 'none':
      default:
        active.container.alpha = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  get characterStage(): Container { return this.stage; }

  getCharacterState(id: CharacterID): CharacterRuntimeState | undefined {
    return this.active.get(id)?.state;
  }

  getActiveCharacterIds(): CharacterID[] {
    return [...this.active.keys()].filter((id) => this.active.get(id)?.state.visible);
  }
}
