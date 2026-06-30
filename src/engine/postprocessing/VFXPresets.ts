/**
 * VFXPresets — named effect configurations for PostProcessingManager.
 *
 * Each preset defines the full EffectState. Soul archetypes and scene tags
 * map to these presets automatically; individual effects can still be
 * overridden at runtime.
 */

import type { EffectState } from './PostProcessingManager';

export type VFXPreset =
  | 'default'
  | 'horror'
  | 'dream'
  | 'corruption'
  | 'divine'
  | 'memory'
  | 'void'
  | 'noir'
  | 'warm';

export const DEFAULT_VFX: EffectState = {
  bloom:               { enabled: false, strength: 2,   blur: 4   },
  vignette:            { enabled: true,  strength: 0.4, softness: 0.5 },
  filmGrain:           { enabled: true,  intensity: 0.025 },
  chromaticAberration: { enabled: false, amount: 0 },
  colorGrade:          { enabled: false, brightness: 1, contrast: 1, saturation: 1, hue: 0 },
  glitch:              { enabled: false, strength: 0 },
};

export const VFX_PRESETS: Record<VFXPreset, EffectState> = {
  default: DEFAULT_VFX,

  horror: {
    bloom:               { enabled: true,  strength: 1.5, blur: 6   },
    vignette:            { enabled: true,  strength: 0.85, softness: 0.25 },
    filmGrain:           { enabled: true,  intensity: 0.08 },
    chromaticAberration: { enabled: true,  amount: 3 },
    colorGrade:          { enabled: true,  brightness: 0.82, contrast: 1.25, saturation: 0.7, hue: 355 },
    glitch:              { enabled: false, strength: 0 },
  },

  dream: {
    bloom:               { enabled: true,  strength: 5,   blur: 9   },
    vignette:            { enabled: true,  strength: 0.25, softness: 0.75 },
    filmGrain:           { enabled: true,  intensity: 0.012 },
    chromaticAberration: { enabled: true,  amount: 1.2 },
    colorGrade:          { enabled: true,  brightness: 1.1, contrast: 0.88, saturation: 1.15, hue: 200 },
    glitch:              { enabled: false, strength: 0 },
  },

  corruption: {
    bloom:               { enabled: true,  strength: 2.5, blur: 5   },
    vignette:            { enabled: true,  strength: 0.75, softness: 0.2 },
    filmGrain:           { enabled: true,  intensity: 0.12 },
    chromaticAberration: { enabled: true,  amount: 7 },
    colorGrade:          { enabled: true,  brightness: 0.78, contrast: 1.35, saturation: 0.6, hue: 280 },
    glitch:              { enabled: true,  strength: 0.4 },
  },

  divine: {
    bloom:               { enabled: true,  strength: 7,   blur: 12  },
    vignette:            { enabled: true,  strength: 0.15, softness: 0.85 },
    filmGrain:           { enabled: false, intensity: 0 },
    chromaticAberration: { enabled: false, amount: 0 },
    colorGrade:          { enabled: true,  brightness: 1.35, contrast: 0.92, saturation: 0.95, hue: 45 },
    glitch:              { enabled: false, strength: 0 },
  },

  memory: {
    bloom:               { enabled: true,  strength: 3,   blur: 7   },
    vignette:            { enabled: true,  strength: 0.65, softness: 0.5 },
    filmGrain:           { enabled: true,  intensity: 0.065 },
    chromaticAberration: { enabled: false, amount: 0 },
    colorGrade:          { enabled: true,  brightness: 0.9, contrast: 1.08, saturation: 0.55, hue: 30 },
    glitch:              { enabled: false, strength: 0 },
  },

  void: {
    bloom:               { enabled: true,  strength: 1,   blur: 3   },
    vignette:            { enabled: true,  strength: 0.95, softness: 0.15 },
    filmGrain:           { enabled: true,  intensity: 0.04 },
    chromaticAberration: { enabled: true,  amount: 2 },
    colorGrade:          { enabled: true,  brightness: 0.65, contrast: 1.4, saturation: 0.3, hue: 240 },
    glitch:              { enabled: false, strength: 0 },
  },

  noir: {
    bloom:               { enabled: false, strength: 0,   blur: 0   },
    vignette:            { enabled: true,  strength: 0.7, softness: 0.35 },
    filmGrain:           { enabled: true,  intensity: 0.05 },
    chromaticAberration: { enabled: false, amount: 0 },
    colorGrade:          { enabled: true,  brightness: 0.88, contrast: 1.3, saturation: 0, hue: 0 },
    glitch:              { enabled: false, strength: 0 },
  },

  warm: {
    bloom:               { enabled: true,  strength: 2.5, blur: 5   },
    vignette:            { enabled: true,  strength: 0.3, softness: 0.6 },
    filmGrain:           { enabled: true,  intensity: 0.02 },
    chromaticAberration: { enabled: false, amount: 0 },
    colorGrade:          { enabled: true,  brightness: 1.05, contrast: 0.95, saturation: 1.2, hue: 20 },
    glitch:              { enabled: false, strength: 0 },
  },
};
