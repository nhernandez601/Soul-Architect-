/**
 * AssetManager — centralised asset loading, caching, and streaming.
 *
 * Handles lazy-loading, preloading, texture compression hints, and
 * memory-pool disposal.  All other managers request assets through here.
 */

import { Assets } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { BaseService } from './BaseService';
import type { EngineConfig, AssetRef, AssetType, FilePath } from '@types/core';

interface CacheEntry<T> {
  asset: T;
  refCount: number;
  lastUsed: number;
  sizeBytes: number;
}

export class AssetManager extends BaseService {
  private readonly textureCache = new Map<string, CacheEntry<Texture>>();
  private readonly jsonCache = new Map<string, CacheEntry<unknown>>();
  private readonly audioCache = new Map<string, CacheEntry<string>>();
  private readonly pendingLoads = new Map<string, Promise<unknown>>();

  /** Maximum texture cache size in bytes (default 256 MB). */
  private readonly maxCacheSizeBytes: number;
  private currentCacheSizeBytes = 0;

  constructor(private readonly config: EngineConfig) {
    super('AssetManager');
    this.maxCacheSizeBytes = 256 * 1024 * 1024;
  }

  protected async onInit(): Promise<void> {
    // Configure PixiJS asset resolver base URL
    await Assets.init({
      basePath: '/',
    });
  }

  protected async onStart(): Promise<void> {
    // Nothing — assets are loaded on-demand
  }

  protected onDestroy(): void {
    this.textureCache.forEach(({ asset }) => asset.destroy());
    this.textureCache.clear();
    this.jsonCache.clear();
    this.audioCache.clear();
    this.pendingLoads.clear();
  }

  // ---------------------------------------------------------------------------
  // Texture loading
  // ---------------------------------------------------------------------------

  async loadTexture(path: FilePath): Promise<Texture> {
    const cached = this.textureCache.get(path);
    if (cached) {
      cached.refCount++;
      cached.lastUsed = Date.now();
      return cached.asset;
    }

    // Coalesce concurrent loads for the same path
    const pending = this.pendingLoads.get(path);
    if (pending) return pending as Promise<Texture>;

    const load = Assets.load<Texture>(path).then((texture) => {
      const entry: CacheEntry<Texture> = {
        asset: texture,
        refCount: 1,
        lastUsed: Date.now(),
        sizeBytes: this.estimateTextureSize(texture),
      };
      this.textureCache.set(path, entry);
      this.currentCacheSizeBytes += entry.sizeBytes;
      this.pendingLoads.delete(path);
      this.evictIfNeeded();
      return texture;
    });

    this.pendingLoads.set(path, load);
    return load;
  }

  releaseTexture(path: FilePath): void {
    const entry = this.textureCache.get(path);
    if (!entry) return;
    entry.refCount--;
    if (entry.refCount <= 0) {
      this.currentCacheSizeBytes -= entry.sizeBytes;
      entry.asset.destroy();
      this.textureCache.delete(path);
    }
  }

  // ---------------------------------------------------------------------------
  // JSON / YAML loading
  // ---------------------------------------------------------------------------

  async loadJson<T = unknown>(path: FilePath): Promise<T> {
    const cached = this.jsonCache.get(path);
    if (cached) return cached.asset as T;

    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load JSON: ${path} (${response.status})`);
    const data = await response.json() as T;

    this.jsonCache.set(path, {
      asset: data,
      refCount: 1,
      lastUsed: Date.now(),
      sizeBytes: 0,
    });

    return data;
  }

  // ---------------------------------------------------------------------------
  // Preload bundles
  // ---------------------------------------------------------------------------

  async preloadAssets(refs: AssetRef[]): Promise<void> {
    const tasks = refs
      .filter((r) => r.preload)
      .map((ref) => this.loadByType(ref));

    await Promise.all(tasks);
    this.log(`Preloaded ${tasks.length} assets`);
  }

  private loadByType(ref: AssetRef): Promise<unknown> {
    switch (ref.type as AssetType) {
      case 'image':  return this.loadTexture(ref.path);
      case 'json':   return this.loadJson(ref.path);
      case 'audio':  return Promise.resolve(ref.path); // Howler handles audio
      default:       return Promise.resolve();
    }
  }

  // ---------------------------------------------------------------------------
  // Cache eviction (LRU)
  // ---------------------------------------------------------------------------

  private evictIfNeeded(): void {
    if (this.currentCacheSizeBytes <= this.maxCacheSizeBytes) return;

    const entries = [...this.textureCache.entries()]
      .filter(([, e]) => e.refCount <= 0)
      .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);

    for (const [path, entry] of entries) {
      this.currentCacheSizeBytes -= entry.sizeBytes;
      entry.asset.destroy();
      this.textureCache.delete(path);
      if (this.currentCacheSizeBytes <= this.maxCacheSizeBytes) break;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private estimateTextureSize(texture: Texture): number {
    const { width, height } = texture;
    return width * height * 4; // RGBA bytes
  }

  get cacheStats(): { textures: number; sizeBytes: number } {
    return {
      textures: this.textureCache.size,
      sizeBytes: this.currentCacheSizeBytes,
    };
  }
}
