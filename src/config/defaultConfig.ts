/**
 * Default engine configuration.
 * Consumed by the Engine on boot; individual settings are overridden
 * by user settings loaded from the save system.
 */

import type { EngineConfig } from '@types/core';

export const defaultEngineConfig: EngineConfig = {
  version: '0.1.0',
  debug: typeof process !== 'undefined' && process.env['NODE_ENV'] === 'development',
  locale: 'en',

  renderer: {
    width: 1920,
    height: 1080,
    resolution: typeof window !== 'undefined' ? window.devicePixelRatio ?? 1 : 1,
    antialias: true,
    backgroundColor: 0x000000,
    powerPreference: 'high-performance',
  },

  audio: {
    masterVolume: 0.8,
    musicVolume: 0.7,
    sfxVolume: 0.8,
    voiceVolume: 1.0,
    ambientVolume: 0.5,
    muteOnFocusLoss: true,
    audioFormat: 'auto',
  },

  save: {
    maxSlots: 20,
    autoSaveIntervalMs: 300_000, // 5 minutes
    cloudEnabled: false,
    encryptionEnabled: false,
    compressionEnabled: true,
    autoSaveEnabled: true,
  } as EngineConfig['save'] & { autoSaveEnabled: boolean },

  input: {
    enableKeyboard: true,
    enableMouse: true,
    enableTouch: true,
    enableGamepad: true,
    textSpeed: 'normal',
    autoSpeed: 1500,
  },

  accessibility: {
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    screenReaderHints: false,
    closedCaptions: false,
    dyslexicFont: false,
  },

  performance: {
    targetFps: 60,
    enableVsync: true,
    textureQuality: 'high',
    particleLimit: 500,
    shadowQuality: 'medium',
    enableBloom: true,
    enableFilmGrain: true,
  },
};
