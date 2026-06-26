/**
 * GallerySystem — manages CG art, music tracks, and scene replay unlocks.
 *
 * Items unlock via story progression and are tracked persistently.
 * The gallery persists across playthroughs (new-game-plus aware).
 */

import { BaseService } from '../../engine/core/BaseService';
import type { GallerySaveData } from '@t/save';
import type { ID, FilePath } from '@t/core';

export type GalleryCategory = 'cg' | 'music' | 'scene';

export interface CGItem {
  id: ID;
  title: string;
  path: FilePath;
  characters: string[];
  chapter: number;
  isSecret: boolean;
  unlockSceneId?: ID;
}

export interface MusicItem {
  id: ID;
  title: string;
  composer: string;
  duration: number; // seconds
  path: FilePath;
  category: 'main' | 'character' | 'ambient' | 'ending';
  unlockCondition?: string;
}

export interface ReplayScene {
  id: ID;
  title: string;
  chapter: number;
  description: string;
  isSecret: boolean;
}

export class GallerySystem extends BaseService {
  private readonly cgItems = new Map<ID, CGItem>();
  private readonly musicItems = new Map<ID, MusicItem>();
  private readonly scenes = new Map<ID, ReplayScene>();

  private unlockedCGs = new Set<ID>();
  private unlockedMusic = new Set<ID>();
  private unlockedScenes = new Set<ID>();
  private newItems = new Set<ID>();

  protected async onInit(): Promise<void> {
    this.subscribe('gallery:cg_unlocked', ({ cgId }) => {
      this.unlockCG(cgId);
    });
    this.subscribe('gallery:music_unlocked', ({ trackId }) => {
      this.unlockMusic(trackId);
    });
    this.subscribe('gallery:scene_unlocked', ({ sceneId }) => {
      this.unlockScene(sceneId);
    });
    this.subscribe('scene:end', ({ sceneId }) => {
      // Auto-unlock scenes in gallery when visited
      if (this.scenes.has(sceneId)) this.unlockScene(sceneId);
    });
    this.subscribe('audio:music_start', ({ trackId }) => {
      // Auto-unlock tracks when first heard
      if (this.musicItems.has(trackId)) this.unlockMusic(trackId);
    });
  }

  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void {
    this.cgItems.clear();
    this.musicItems.clear();
    this.scenes.clear();
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  registerCG(item: CGItem): void { this.cgItems.set(item.id, item); }
  registerMusic(item: MusicItem): void { this.musicItems.set(item.id, item); }
  registerScene(scene: ReplayScene): void { this.scenes.set(scene.id, scene); }

  registerAll(
    cgs: CGItem[] = [],
    music: MusicItem[] = [],
    scenes: ReplayScene[] = []
  ): void {
    cgs.forEach((c) => this.registerCG(c));
    music.forEach((m) => this.registerMusic(m));
    scenes.forEach((s) => this.registerScene(s));
  }

  // ---------------------------------------------------------------------------
  // Unlock
  // ---------------------------------------------------------------------------

  unlockCG(id: ID): void {
    if (this.unlockedCGs.has(id)) return;
    this.unlockedCGs.add(id);
    this.newItems.add(id);
    this.log(`CG unlocked: ${id}`);
    this.bus.emit('ui:notification', { message: 'New artwork unlocked!', type: 'success' });
  }

  unlockMusic(id: ID): void {
    if (this.unlockedMusic.has(id)) return;
    this.unlockedMusic.add(id);
    this.newItems.add(id);
    this.log(`Music unlocked: ${id}`);
  }

  unlockScene(id: ID): void {
    if (this.unlockedScenes.has(id)) return;
    this.unlockedScenes.add(id);
    this.newItems.add(id);
    this.log(`Scene replay unlocked: ${id}`);
  }

  markSeen(id: ID): void { this.newItems.delete(id); }
  markAllSeen(): void { this.newItems.clear(); }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  getUnlockedCGs(sortByChapter = true): CGItem[] {
    const items = [...this.unlockedCGs].map((id) => this.cgItems.get(id)!).filter(Boolean);
    return sortByChapter ? items.sort((a, b) => a.chapter - b.chapter) : items;
  }

  getUnlockedMusic(): MusicItem[] {
    return [...this.unlockedMusic].map((id) => this.musicItems.get(id)!).filter(Boolean);
  }

  getUnlockedScenes(): ReplayScene[] {
    return [...this.unlockedScenes].map((id) => this.scenes.get(id)!).filter(Boolean);
  }

  getAllCGs(): CGItem[] { return [...this.cgItems.values()]; }
  getAllMusic(): MusicItem[] { return [...this.musicItems.values()]; }
  getAllScenes(): ReplayScene[] { return [...this.scenes.values()]; }

  isUnlockedCG(id: ID): boolean { return this.unlockedCGs.has(id); }
  isUnlockedMusic(id: ID): boolean { return this.unlockedMusic.has(id); }
  isUnlockedScene(id: ID): boolean { return this.unlockedScenes.has(id); }
  isNew(id: ID): boolean { return this.newItems.has(id); }
  getNewCount(): number { return this.newItems.size; }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  serialize(): GallerySaveData {
    return {
      unlockedCGs: new Set(this.unlockedCGs),
      unlockedMusic: new Set(this.unlockedMusic),
      unlockedScenes: new Set(this.unlockedScenes),
      newItems: new Set(this.newItems),
    };
  }

  deserialize(data: GallerySaveData): void {
    this.unlockedCGs = new Set(data.unlockedCGs);
    this.unlockedMusic = new Set(data.unlockedMusic);
    this.unlockedScenes = new Set(data.unlockedScenes);
    this.newItems = new Set(data.newItems);
  }
}
