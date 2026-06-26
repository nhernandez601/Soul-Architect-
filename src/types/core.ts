/**
 * Core primitive and structural types for the Soul Architect engine.
 * All engine subsystems reference these foundational definitions.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type ID = string;
export type Timestamp = number;
export type Version = string;
export type FilePath = string;
export type Locale = string;

/** Generic key-value bag used throughout the engine for flexible metadata. */
export type Dict<T = unknown> = Record<string, T>;

/** Semantic version string validated against `major.minor.patch` pattern. */
export type SemVer = `${number}.${number}.${number}`;

// ---------------------------------------------------------------------------
// Math / Geometry
// ---------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Color {
  r: number; // 0-255
  g: number;
  b: number;
  a: number; // 0-1
}

export type HexColor = `#${string}`;

// ---------------------------------------------------------------------------
// Engine Lifecycle
// ---------------------------------------------------------------------------

export type EngineState =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'running'
  | 'paused'
  | 'loading'
  | 'error'
  | 'shutdown';

export interface EngineConfig {
  version: SemVer;
  debug: boolean;
  locale: Locale;
  renderer: RendererConfig;
  audio: AudioConfig;
  save: SaveConfig;
  input: InputConfig;
  accessibility: AccessibilityConfig;
  performance: PerformanceConfig;
}

export interface RendererConfig {
  width: number;
  height: number;
  resolution: number;
  antialias: boolean;
  backgroundColor: number;
  powerPreference: 'high-performance' | 'low-power' | 'default';
}

export interface AudioConfig {
  masterVolume: number;     // 0-1
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  ambientVolume: number;
  muteOnFocusLoss: boolean;
  audioFormat: 'ogg' | 'mp3' | 'wav' | 'auto';
}

export interface SaveConfig {
  maxSlots: number;
  autoSaveIntervalMs: number;
  cloudEnabled: boolean;
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
}

export interface InputConfig {
  enableKeyboard: boolean;
  enableMouse: boolean;
  enableTouch: boolean;
  enableGamepad: boolean;
  textSpeed: TextSpeed;
  autoSpeed: number; // ms per character
}

export interface AccessibilityConfig {
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  screenReaderHints: boolean;
  closedCaptions: boolean;
  dyslexicFont: boolean;
}

export interface PerformanceConfig {
  targetFps: 30 | 60 | 120;
  enableVsync: boolean;
  textureQuality: 'low' | 'medium' | 'high' | 'ultra';
  particleLimit: number;
  shadowQuality: 'off' | 'low' | 'medium' | 'high';
  enableBloom: boolean;
  enableFilmGrain: boolean;
}

// ---------------------------------------------------------------------------
// Text speed
// ---------------------------------------------------------------------------

export type TextSpeed = 'slow' | 'normal' | 'fast' | 'instant';

export const TEXT_SPEED_MS: Record<TextSpeed, number> = {
  slow: 60,
  normal: 30,
  fast: 15,
  instant: 0,
};

// ---------------------------------------------------------------------------
// Generic result / error patterns
// ---------------------------------------------------------------------------

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type EventHandler<T = void> = (payload: T) => void | Promise<void>;

export interface TypedEventMap {
  [event: string]: unknown;
}

// ---------------------------------------------------------------------------
// Asset references (resolved at runtime)
// ---------------------------------------------------------------------------

export interface AssetRef {
  id: ID;
  path: FilePath;
  type: AssetType;
  preload: boolean;
}

export type AssetType =
  | 'image'
  | 'audio'
  | 'video'
  | 'json'
  | 'yaml'
  | 'font'
  | 'shader'
  | 'script';

// ---------------------------------------------------------------------------
// Disposable pattern
// ---------------------------------------------------------------------------

export interface Disposable {
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Serializable pattern (for save/load)
// ---------------------------------------------------------------------------

export interface Serializable<T> {
  serialize(): T;
  deserialize(data: T): void;
}
