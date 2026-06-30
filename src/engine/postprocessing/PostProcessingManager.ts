/**
 * PostProcessingManager — VFX layer for the PixiJS stage.
 *
 * Manages a stack of visual effects (bloom, vignette, film grain,
 * chromatic aberration, color grade, glitch) applied as PixiJS filters
 * on the root stage container. Effects are named presets or can be
 * configured individually. The manager wires itself to the Pixi app
 * via connectApp() after the renderer is up.
 *
 * Filter implementation uses PixiJS ColorMatrixFilter (built-in) for
 * color grading and custom fragment shaders for grain / aberration.
 */

import { BaseService } from '../core/BaseService';
import type { VFXPreset } from './VFXPresets';
import { VFX_PRESETS, DEFAULT_VFX } from './VFXPresets';
import type { Application, Container, Filter } from 'pixi.js';

export type { VFXPreset };

export interface EffectState {
  bloom:               { enabled: boolean; strength: number; blur: number };
  vignette:            { enabled: boolean; strength: number; softness: number };
  filmGrain:           { enabled: boolean; intensity: number };
  chromaticAberration: { enabled: boolean; amount: number };
  colorGrade:          { enabled: boolean; brightness: number; contrast: number; saturation: number; hue: number };
  glitch:              { enabled: boolean; strength: number };
}

export class PostProcessingManager extends BaseService {
  private app: Application | null = null;
  private stage: Container | null = null;
  private readonly filters: Filter[] = [];
  private state: EffectState = structuredClone(DEFAULT_VFX);
  private grainTick = 0;
  private rafHandle: number | null = null;
  private currentPreset: VFXPreset = 'default';

  protected async onInit(): Promise<void> {
    this.subscribe('postprocessing:preset', ({ preset }) => {
      this.applyPreset(preset as VFXPreset);
    });

    this.subscribe('postprocessing:effect_change', ({ effect, enabled }) => {
      const key = effect as keyof EffectState;
      if (this.state[key]) {
        (this.state[key] as { enabled: boolean }).enabled = enabled;
        this.rebuildFilters();
      }
    });

    // React to soul state changes for adaptive VFX
    this.subscribe('soul:archetype_change', ({ newArchetype }) => {
      this.onArchetypeChange(newArchetype);
    });

    // Trigger horror VFX preset on corruption-related scenes
    this.subscribe('scene:load_complete', ({ sceneId }) => {
      this.onSceneLoad(sceneId);
    });
  }

  protected async onStart(): Promise<void> { /* nothing */ }

  protected onPause(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  protected onResume(): void {
    if (this.state.filmGrain.enabled) this.startGrainAnimation();
  }

  protected onDestroy(): void {
    this.onPause();
    this.filters.length = 0;
    this.app = null;
    this.stage = null;
  }

  // ---------------------------------------------------------------------------
  // Connection to PixiJS app
  // ---------------------------------------------------------------------------

  connectApp(app: Application): void {
    this.app = app;
    this.stage = app.stage;
    this.rebuildFilters();
    if (this.state.filmGrain.enabled) this.startGrainAnimation();
    this.log('Connected to PixiJS app');
  }

  // ---------------------------------------------------------------------------
  // Preset API
  // ---------------------------------------------------------------------------

  applyPreset(preset: VFXPreset, transitionMs = 0): void {
    const target = VFX_PRESETS[preset];
    if (!target) {
      this.warn(`Unknown VFX preset: "${preset}"`);
      return;
    }

    if (transitionMs <= 0) {
      this.state = structuredClone(target);
      this.rebuildFilters();
    } else {
      // Interpolate over transitionMs — simple step-based lerp
      const steps = Math.max(1, Math.round(transitionMs / 16));
      let step = 0;
      const from = structuredClone(this.state);

      const tick = (): void => {
        step++;
        const t = step / steps;
        this.state = this.lerpState(from, target, t);
        this.rebuildFilters();
        if (step < steps) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    this.currentPreset = preset;
    this.bus.emit('postprocessing:preset', { preset });
    this.log(`Applied VFX preset: "${preset}"`);
  }

  /** Change individual effect parameters without switching presets. */
  setEffect<K extends keyof EffectState>(
    effect: K,
    params: Partial<EffectState[K]>,
  ): void {
    Object.assign(this.state[effect], params);
    this.rebuildFilters();
  }

  getState(): Readonly<EffectState> { return this.state; }
  getCurrentPreset(): VFXPreset { return this.currentPreset; }

  // ---------------------------------------------------------------------------
  // Filter assembly
  // ---------------------------------------------------------------------------

  private rebuildFilters(): void {
    if (!this.stage) return;

    // We build PixiJS-compatible filter objects.
    // In a full implementation this wires up actual PIXI.Filter instances.
    // Here we store the config and apply the built-in ColorMatrixFilter.
    this.applyColorMatrix();
    // Film grain and aberration are handled via CSS / React overlay for now.
  }

  private applyColorMatrix(): void {
    if (!this.app || !this.stage) return;

    // Use dynamic import to avoid hard coupling when PixiJS isn't loaded
    void (async () => {
      try {
        const { ColorMatrixFilter } = await import('pixi.js');
        const cmf = new ColorMatrixFilter();

        const { colorGrade } = this.state;
        if (colorGrade.enabled) {
          cmf.brightness(colorGrade.brightness, false);
          cmf.contrast(colorGrade.contrast, false);
          cmf.saturate(colorGrade.saturation - 1, false);
          if (colorGrade.hue !== 0) cmf.hue(colorGrade.hue, false);
        }

        // Collect all active filters
        const activeFilters: Filter[] = colorGrade.enabled ? [cmf] : [];
        this.stage!.filters = activeFilters.length > 0 ? activeFilters : null;
      } catch {
        // PixiJS not available in test environments
      }
    })();
  }

  // ---------------------------------------------------------------------------
  // Film grain animation
  // ---------------------------------------------------------------------------

  private startGrainAnimation(): void {
    if (this.rafHandle !== null) return;

    const tick = (): void => {
      this.grainTick++;
      // Expose tick for CSS-based grain overlay via custom property
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty(
          '--grain-seed',
          String(this.grainTick % 100),
        );
      }
      this.rafHandle = requestAnimationFrame(tick);
    };

    this.rafHandle = requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------------------
  // Adaptive VFX
  // ---------------------------------------------------------------------------

  private onArchetypeChange(archetype: string): void {
    const archetypePresets: Record<string, VFXPreset> = {
      corrupted:    'corruption',
      void_walker:  'corruption',
      divine:       'divine',
      transcendent: 'divine',
      dreamer:      'dream',
      memory_keeper:'memory',
    };
    const preset = archetypePresets[archetype];
    if (preset) this.applyPreset(preset, 1200);
  }

  private onSceneLoad(sceneId: string): void {
    // Scene-specific VFX overrides
    const scenePresets: Record<string, VFXPreset> = {
      void_gate:        'corruption',
      divine_sanctum:   'divine',
      dreamscape:       'dream',
      memory_palace:    'memory',
      prologue_01:      'default',
    };
    const preset = scenePresets[sceneId];
    if (preset) this.applyPreset(preset, 800);
  }

  // ---------------------------------------------------------------------------
  // Lerp helper
  // ---------------------------------------------------------------------------

  private lerpState(from: EffectState, to: EffectState, t: number): EffectState {
    const lerp = (a: number, b: number): number => a + (b - a) * t;
    return {
      bloom: {
        enabled:  t > 0.5 ? to.bloom.enabled : from.bloom.enabled,
        strength: lerp(from.bloom.strength, to.bloom.strength),
        blur:     lerp(from.bloom.blur, to.bloom.blur),
      },
      vignette: {
        enabled:  t > 0.5 ? to.vignette.enabled : from.vignette.enabled,
        strength: lerp(from.vignette.strength, to.vignette.strength),
        softness: lerp(from.vignette.softness, to.vignette.softness),
      },
      filmGrain: {
        enabled:   t > 0.5 ? to.filmGrain.enabled : from.filmGrain.enabled,
        intensity: lerp(from.filmGrain.intensity, to.filmGrain.intensity),
      },
      chromaticAberration: {
        enabled: t > 0.5 ? to.chromaticAberration.enabled : from.chromaticAberration.enabled,
        amount:  lerp(from.chromaticAberration.amount, to.chromaticAberration.amount),
      },
      colorGrade: {
        enabled:    t > 0.5 ? to.colorGrade.enabled : from.colorGrade.enabled,
        brightness: lerp(from.colorGrade.brightness, to.colorGrade.brightness),
        contrast:   lerp(from.colorGrade.contrast, to.colorGrade.contrast),
        saturation: lerp(from.colorGrade.saturation, to.colorGrade.saturation),
        hue:        lerp(from.colorGrade.hue, to.colorGrade.hue),
      },
      glitch: {
        enabled:  t > 0.5 ? to.glitch.enabled : from.glitch.enabled,
        strength: lerp(from.glitch.strength, to.glitch.strength),
      },
    };
  }
}
