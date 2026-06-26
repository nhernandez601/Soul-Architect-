/**
 * AudioManager — adaptive audio playback via Howler.js.
 *
 * Supports: music tracks, SFX, ambient layers, crossfades, 3D positional audio,
 * reverb, dynamic volume per channel, and mute-on-focus-loss.
 */

import { Howl, Howler } from 'howler';
import { BaseService } from '../core/BaseService';
import type { AudioConfig, ID } from '@t/core';
import type { MusicSpec } from '@t/scene';

interface TrackEntry {
  id: ID;
  howl: Howl;
  spec: MusicSpec;
  fading: boolean;
}

interface SFXEntry {
  id: ID;
  howl: Howl;
}

interface AmbienceEntry {
  id: ID;
  howl: Howl;
  volume: number;
}

export class AudioManager extends BaseService {
  private currentTrack: TrackEntry | null = null;
  private pendingTrack: TrackEntry | null = null;
  private readonly sfxPool = new Map<ID, SFXEntry>();
  private readonly ambienceLayers = new Map<ID, AmbienceEntry>();
  private config: AudioConfig;

  private masterVolume: number;
  private musicVolume: number;
  private sfxVolume: number;
  private voiceVolume: number;
  private ambientVolume: number;
  private muted = false;

  constructor(config: AudioConfig) {
    super('AudioManager');
    this.config = config;
    this.masterVolume = config.masterVolume;
    this.musicVolume = config.musicVolume;
    this.sfxVolume = config.sfxVolume;
    this.voiceVolume = config.voiceVolume;
    this.ambientVolume = config.ambientVolume;
  }

  protected async onInit(): Promise<void> {
    Howler.volume(this.masterVolume);

    this.subscribe('engine:pause', () => {
      if (this.config.muteOnFocusLoss) this.mute();
    });
    this.subscribe('engine:resume', () => {
      if (this.config.muteOnFocusLoss) this.unmute();
    });
  }

  protected async onStart(): Promise<void> { /* nothing */ }

  protected onDestroy(): void {
    this.stopMusic();
    this.stopAllAmbience();
    this.sfxPool.forEach(({ howl }) => howl.unload());
    this.sfxPool.clear();
    Howler.unload();
  }

  // ---------------------------------------------------------------------------
  // Music
  // ---------------------------------------------------------------------------

  async playMusic(trackId: ID, spec: MusicSpec): Promise<void> {
    // If same track, just adjust volume
    if (this.currentTrack?.id === trackId) {
      this.currentTrack.howl.volume(spec.volume * this.musicVolume * this.masterVolume);
      return;
    }

    const newHowl = new Howl({
      src: [this.resolvePath(trackId, 'music')],
      volume: 0,
      loop: spec.loop ?? true,
      autoplay: false,
      html5: true,
    });

    const newEntry: TrackEntry = { id: trackId, howl: newHowl, spec, fading: false };

    if (this.currentTrack) {
      await this.crossfadeTo(newEntry, spec.fadeInMs ?? 2000);
    } else {
      newHowl.play();
      newHowl.fade(0, spec.volume * this.musicVolume * this.masterVolume, spec.fadeInMs ?? 1000);
      this.currentTrack = newEntry;
    }

    this.bus.emit('audio:music_start', { trackId });
  }

  stopMusic(fadeOutMs = 1000): void {
    if (!this.currentTrack) return;
    const { id, howl } = this.currentTrack;
    howl.fade(howl.volume() as number, 0, fadeOutMs);
    setTimeout(() => howl.stop(), fadeOutMs);
    this.bus.emit('audio:music_stop', { trackId: id });
    this.currentTrack = null;
  }

  private async crossfadeTo(next: TrackEntry, durationMs: number): Promise<void> {
    const prev = this.currentTrack!;
    this.bus.emit('audio:music_crossfade', { from: prev.id, to: next.id });

    const targetVol = next.spec.volume * this.musicVolume * this.masterVolume;

    next.howl.play();
    next.howl.fade(0, targetVol, durationMs);
    prev.howl.fade(prev.howl.volume() as number, 0, durationMs);
    setTimeout(() => { prev.howl.stop(); prev.howl.unload(); }, durationMs);

    this.currentTrack = next;
  }

  // ---------------------------------------------------------------------------
  // SFX
  // ---------------------------------------------------------------------------

  playSFX(soundId: ID, volume = 1.0): void {
    let entry = this.sfxPool.get(soundId);
    if (!entry) {
      const howl = new Howl({
        src: [this.resolvePath(soundId, 'sfx')],
        volume: 0,
        preload: true,
      });
      entry = { id: soundId, howl };
      this.sfxPool.set(soundId, entry);
    }

    entry.howl.volume(volume * this.sfxVolume * this.masterVolume);
    entry.howl.play();
    this.bus.emit('audio:sfx_play', { soundId });
  }

  // ---------------------------------------------------------------------------
  // Ambience layers
  // ---------------------------------------------------------------------------

  addAmbienceLayer(soundId: ID, volume = 0.5, loop = true): void {
    if (this.ambienceLayers.has(soundId)) return;

    const howl = new Howl({
      src: [this.resolvePath(soundId, 'ambient')],
      volume: volume * this.ambientVolume * this.masterVolume,
      loop,
      autoplay: true,
    });

    this.ambienceLayers.set(soundId, { id: soundId, howl, volume });
  }

  removeAmbienceLayer(soundId: ID, fadeMs = 1500): void {
    const entry = this.ambienceLayers.get(soundId);
    if (!entry) return;
    entry.howl.fade(entry.howl.volume() as number, 0, fadeMs);
    setTimeout(() => { entry.howl.stop(); entry.howl.unload(); }, fadeMs);
    this.ambienceLayers.delete(soundId);
  }

  stopAllAmbience(): void {
    this.ambienceLayers.forEach(({ howl }) => { howl.stop(); howl.unload(); });
    this.ambienceLayers.clear();
  }

  // ---------------------------------------------------------------------------
  // Volume control
  // ---------------------------------------------------------------------------

  setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    Howler.volume(this.masterVolume);
    this.bus.emit('audio:volume_change', { channel: 'master', volume: this.masterVolume });
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.currentTrack) {
      this.currentTrack.howl.volume(this.currentTrack.spec.volume * this.musicVolume * this.masterVolume);
    }
    this.bus.emit('audio:volume_change', { channel: 'music', volume: this.musicVolume });
  }

  setSFXVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    this.bus.emit('audio:volume_change', { channel: 'sfx', volume: this.sfxVolume });
  }

  setAmbientVolume(v: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, v));
    this.ambienceLayers.forEach((entry) => {
      entry.howl.volume(entry.volume * this.ambientVolume * this.masterVolume);
    });
    this.bus.emit('audio:volume_change', { channel: 'ambient', volume: this.ambientVolume });
  }

  mute(): void {
    if (this.muted) return;
    this.muted = true;
    Howler.mute(true);
  }

  unmute(): void {
    if (!this.muted) return;
    this.muted = false;
    Howler.mute(false);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private resolvePath(id: ID, category: 'music' | 'sfx' | 'ambient'): string {
    const ext = this.config.audioFormat === 'auto' ? 'ogg' : this.config.audioFormat;
    return `/assets/music/${category}/${id}.${ext}`;
  }

  getVolumes(): Record<string, number> {
    return {
      master: this.masterVolume,
      music: this.musicVolume,
      sfx: this.sfxVolume,
      voice: this.voiceVolume,
      ambient: this.ambientVolume,
    };
  }
}
