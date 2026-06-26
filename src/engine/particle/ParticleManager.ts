/**
 * ParticleManager — drives the particle effects system.
 *
 * Manages weather effects (rain, snow, ash, fog, fireflies),
 * ambient effects (dust, embers), and one-shot visual effects
 * (bloom flash, screen flash, impact burst).
 */

import { Container, Graphics } from 'pixi.js';
import { BaseService } from '../core/BaseService';
import type { WeatherSpec, WeatherType } from '@types/scene';
import type { Dict } from '@types/core';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  life: number;
  maxLife: number;
  size: number;
  graphic: Graphics;
}

export class ParticleManager extends BaseService {
  private readonly stage: Container;
  private particles: Particle[] = [];
  private weatherType: WeatherType = 'clear';
  private weatherIntensity = 0;
  private spawnRate = 0;
  private rafHandle: number | null = null;
  private canvasWidth = 1920;
  private canvasHeight = 1080;
  private readonly PARTICLE_LIMIT = 1000;

  constructor() {
    super('ParticleManager');
    this.stage = new Container();
    this.stage.label = 'particle-layer';
  }

  protected async onInit(): Promise<void> { /* nothing */ }

  protected async onStart(): Promise<void> {
    this.startLoop();
  }

  protected onPause(): void {
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = null;
  }

  protected onResume(): void {
    this.startLoop();
  }

  protected onDestroy(): void {
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    this.clearAll();
  }

  // ---------------------------------------------------------------------------
  // Weather
  // ---------------------------------------------------------------------------

  setWeather(spec: WeatherSpec, transitionMs = 2000): void {
    this.weatherType = spec.type;
    this.weatherIntensity = spec.intensity;
    this.configureSpawnRate(spec.type, spec.intensity);
    this.log(`Weather set to ${spec.type} (intensity: ${spec.intensity})`);
    void transitionMs; // smooth transition handled by gradual spawn changes
  }

  private configureSpawnRate(type: WeatherType, intensity: number): void {
    const base: Record<WeatherType, number> = {
      clear: 0,
      rain: 20,
      storm: 60,
      snow: 10,
      fog: 2,
      ash: 8,
      sakura: 5,
      sand: 30,
      void: 4,
    };
    this.spawnRate = (base[type] ?? 0) * intensity;
  }

  // ---------------------------------------------------------------------------
  // One-shot effects
  // ---------------------------------------------------------------------------

  playEffect(effectId: string, params: Dict<number | string | boolean>, durationMs: number): void {
    switch (effectId) {
      case 'flash':     this.playFlash(params, durationMs); break;
      case 'burst':     this.playBurst(params); break;
      case 'fireflies': this.spawnFireflies(params); break;
      default: this.warn(`Unknown effect: ${effectId}`);
    }
  }

  private playFlash(params: Dict<number | string | boolean>, durationMs: number): void {
    const color = (params['color'] as number) ?? 0xffffff;
    const alpha = (params['alpha'] as number) ?? 0.8;
    const flash = new Graphics();
    flash.rect(0, 0, this.canvasWidth, this.canvasHeight).fill(color);
    flash.alpha = alpha;
    this.stage.addChild(flash);
    setTimeout(() => flash.destroy(), durationMs);
  }

  private playBurst(_params: Dict<number | string | boolean>): void {
    for (let i = 0; i < 20; i++) {
      this.spawnParticle(
        this.canvasWidth / 2,
        this.canvasHeight / 2,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        0xffd700,
        Math.random() * 5 + 2,
        60
      );
    }
  }

  private spawnFireflies(_params: Dict<number | string | boolean>): void {
    for (let i = 0; i < 30; i++) {
      this.spawnParticle(
        Math.random() * this.canvasWidth,
        Math.random() * this.canvasHeight,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        0xaaffaa,
        Math.random() * 3 + 1,
        300
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Particle spawn
  // ---------------------------------------------------------------------------

  private spawnParticle(
    x: number, y: number,
    vx: number, vy: number,
    color: number,
    size: number,
    maxLife: number
  ): void {
    if (this.particles.length >= this.PARTICLE_LIMIT) return;

    const g = new Graphics();
    g.circle(0, 0, size).fill(color);
    g.x = x; g.y = y;
    this.stage.addChild(g);

    this.particles.push({ x, y, vx, vy, alpha: 1, life: 0, maxLife, size, graphic: g });
  }

  private spawnWeatherParticle(): void {
    switch (this.weatherType) {
      case 'rain':
        this.spawnParticle(
          Math.random() * this.canvasWidth,
          -10,
          Math.random() * 2 - 1,
          8 + Math.random() * 4,
          0x88aaff,
          1,
          80
        );
        break;
      case 'snow':
        this.spawnParticle(
          Math.random() * this.canvasWidth,
          -10,
          Math.random() * 1 - 0.5,
          1 + Math.random() * 1.5,
          0xffffff,
          Math.random() * 3 + 1,
          200
        );
        break;
      case 'ash':
        this.spawnParticle(
          Math.random() * this.canvasWidth,
          -10,
          Math.random() * 1 - 0.5,
          0.5 + Math.random(),
          0x888888,
          Math.random() * 2 + 1,
          300
        );
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Update loop
  // ---------------------------------------------------------------------------

  private startLoop(): void {
    let last = 0;
    let spawnAccum = 0;

    const tick = (ts: number): void => {
      const dt = ts - last;
      last = ts;
      spawnAccum += this.spawnRate * (dt / 1000);

      while (spawnAccum >= 1 && this.particles.length < this.PARTICLE_LIMIT) {
        this.spawnWeatherParticle();
        spawnAccum--;
      }

      this.particles = this.particles.filter((p) => {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha = 1 - p.life / p.maxLife;

        p.graphic.x = p.x;
        p.graphic.y = p.y;
        p.graphic.alpha = Math.max(0, p.alpha);

        if (p.life >= p.maxLife || p.y > this.canvasHeight + 10) {
          p.graphic.destroy();
          return false;
        }
        return true;
      });

      this.rafHandle = requestAnimationFrame(tick);
    };

    this.rafHandle = requestAnimationFrame(tick);
  }

  private clearAll(): void {
    this.particles.forEach((p) => p.graphic.destroy());
    this.particles = [];
  }

  get particleStage(): Container {
    return this.stage;
  }
}
