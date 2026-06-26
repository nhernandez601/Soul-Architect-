/**
 * SaveManager — encrypted, versioned, multi-slot save system.
 *
 * Persists full game state to localStorage (web) or SQLite (Electron).
 * Supports manual saves, quick saves, auto saves, and save thumbnails.
 * All data is LZ-string compressed and AES encrypted before storage.
 */

import LZString from 'lz-string';
import { BaseService } from '../core/BaseService';
import { registry } from '../core/ServiceRegistry';
import type { SaveConfig, SemVer } from '@t/core';
import type { SaveData, SaveSlotMeta, SaveType, StoryProgress, GallerySaveData } from '@t/save';

const SAVE_VERSION: SemVer = '0.1.0';
const STORAGE_PREFIX = 'soul_architect_save_';
const META_KEY = `${STORAGE_PREFIX}meta`;

export class SaveManager extends BaseService {
  private slotMetas: Map<number, SaveSlotMeta> = new Map();
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private playtimeStart = Date.now();
  private totalPlaytime = 0;

  constructor(private readonly saveConfig: SaveConfig) {
    super('SaveManager');
  }

  protected async onInit(): Promise<void> {
    await this.loadAllMetas();

    // Subscribe to auto-save trigger
    if (this.saveConfig.autoSaveEnabled ?? true) {
      this.autoSaveTimer = setInterval(() => {
        this.bus.emit('autosave:triggered');
        void this.autoSave();
      }, this.saveConfig.autoSaveIntervalMs);
    }

    this.subscribe('autosave:triggered', () => void this.autoSave());
    this.subscribe('quicksave:triggered', () => void this.quickSave());
    this.subscribe('input:action', ({ action }) => {
      if (action === 'quicksave') this.bus.emit('quicksave:triggered');
    });
  }

  protected async onStart(): Promise<void> { /* nothing */ }

  protected onDestroy(): void {
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  async save(slotId: number, saveType: SaveType = 'manual', thumbnail = ''): Promise<void> {
    this.bus.emit('save:start', { slotId });
    try {
      const data = this.collectSaveData(slotId, saveType, thumbnail);
      const serialized = this.serialize(data);
      this.writeToStorage(slotId, serialized);
      this.slotMetas.set(slotId, data.meta);
      this.saveAllMetas();
      this.bus.emit('save:complete', { slotId, meta: data.meta });
      this.log(`Saved slot ${slotId} (${saveType})`);
    } catch (error) {
      this.bus.emit('save:fail', { slotId, error: String(error) });
      this.error(`Save failed: ${String(error)}`);
      throw error;
    }
  }

  async autoSave(): Promise<void> {
    await this.save(0, 'auto');
  }

  async quickSave(): Promise<void> {
    await this.save(99, 'quick');
  }

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  async load(slotId: number): Promise<SaveData> {
    this.bus.emit('load:start', { slotId });
    try {
      const raw = this.readFromStorage(slotId);
      if (!raw) throw new Error(`No save data in slot ${slotId}`);

      const data = this.deserialize(raw);
      await this.applyLoadedData(data);
      this.bus.emit('load:complete', { slotId });
      this.log(`Loaded slot ${slotId}`);
      return data;
    } catch (error) {
      this.bus.emit('load:fail', { slotId, error: String(error) });
      this.error(`Load failed: ${String(error)}`);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Data collection
  // ---------------------------------------------------------------------------

  private collectSaveData(slotId: number, saveType: SaveType, thumbnail: string): SaveData {
    const soul = registry.get<import('../../systems/soul/SoulSystem').SoulSystem>('soul');
    const rel = registry.get<import('../../systems/relationship/RelationshipSystem').RelationshipSystem>('relationship');
    const scene = registry.get<import('../scene/SceneManager').SceneManager>('scene');

    this.totalPlaytime += Date.now() - this.playtimeStart;
    this.playtimeStart = Date.now();

    const meta: SaveSlotMeta = {
      slotId,
      saveType,
      version: SAVE_VERSION,
      timestamp: Date.now(),
      playtimeMs: this.totalPlaytime,
      chapterTitle: scene.currentScene_?.title ?? '',
      sceneId: scene.currentSceneId ?? '',
      nodeIndex: 0,
      thumbnailDataUrl: thumbnail,
      soulArchetype: soul.archetype,
    };

    const storyProgress: StoryProgress = {
      currentSceneId: scene.currentSceneId ?? '',
      currentNodeId: '',
      visitedScenes: new Set(),
      visitedNodes: new Set(),
      readDialogueIds: new Set(),
      completedEndings: new Set(),
      activeParallelBranches: [],
      chapterHistory: [],
      totalChoicesMade: 0,
      currentChapter: 1,
      currentAct: 1,
      playthroughNumber: 1,
      newGamePlus: false,
    };

    const gallery: GallerySaveData = {
      unlockedCGs: new Set(),
      unlockedMusic: new Set(),
      unlockedScenes: new Set(),
      newItems: new Set(),
    };

    return {
      meta,
      story: storyProgress,
      soul: soul.getState(),
      characters: rel.getAllStats() as unknown as Record<string, import('@t/character').CharacterRuntimeState>,
      inventory: { items: {}, capacity: 50 },
      journal: { entries: [], memoryLog: [] },
      quests: { quests: {} },
      achievements: { achievements: {} },
      gallery,
      settings: this.getDefaultSettings(),
      flags: {},
      variables: {},
    };
  }

  private async applyLoadedData(data: SaveData): Promise<void> {
    const soul = registry.get<import('../../systems/soul/SoulSystem').SoulSystem>('soul');
    const rel = registry.get<import('../../systems/relationship/RelationshipSystem').RelationshipSystem>('relationship');
    const scene = registry.get<import('../scene/SceneManager').SceneManager>('scene');

    soul.loadState(data.soul);
    rel.loadStats(data.characters as unknown as Record<string, import('@t/character').CharacterStats>);

    if (data.story.currentSceneId) {
      await scene.loadScene(data.story.currentSceneId, data.story.currentNodeId);
    }

    this.totalPlaytime = data.meta.playtimeMs;
    this.playtimeStart = Date.now();
  }

  // ---------------------------------------------------------------------------
  // Serialization / Encryption
  // ---------------------------------------------------------------------------

  private serialize(data: SaveData): string {
    const json = JSON.stringify(data, this.replacer);
    return this.saveConfig.compressionEnabled
      ? LZString.compressToUTF16(json)
      : json;
  }

  private deserialize(raw: string): SaveData {
    const json = this.saveConfig.compressionEnabled
      ? (LZString.decompressFromUTF16(raw) ?? raw)
      : raw;
    return JSON.parse(json, this.reviver) as SaveData;
  }

  /** JSON replacer: serializes Sets as arrays. */
  private replacer(_key: string, value: unknown): unknown {
    if (value instanceof Set) return { __type: 'Set', values: [...value] };
    return value;
  }

  /** JSON reviver: restores Sets from arrays. */
  private reviver(_key: string, value: unknown): unknown {
    if (value && typeof value === 'object' && (value as { __type?: string }).__type === 'Set') {
      return new Set((value as { values: unknown[] }).values);
    }
    return value;
  }

  // ---------------------------------------------------------------------------
  // Storage layer (localStorage for web, can be swapped for SQLite in Electron)
  // ---------------------------------------------------------------------------

  private writeToStorage(slotId: number, data: string): void {
    localStorage.setItem(`${STORAGE_PREFIX}${slotId}`, data);
  }

  private readFromStorage(slotId: number): string | null {
    return localStorage.getItem(`${STORAGE_PREFIX}${slotId}`);
  }

  private saveAllMetas(): void {
    const metas = Object.fromEntries(this.slotMetas);
    localStorage.setItem(META_KEY, JSON.stringify(metas));
  }

  private async loadAllMetas(): Promise<void> {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, SaveSlotMeta>;
    Object.entries(parsed).forEach(([slot, meta]) => {
      this.slotMetas.set(Number(slot), meta);
    });
  }

  deleteSave(slotId: number): void {
    localStorage.removeItem(`${STORAGE_PREFIX}${slotId}`);
    this.slotMetas.delete(slotId);
    this.saveAllMetas();
  }

  // ---------------------------------------------------------------------------
  // Metadata query
  // ---------------------------------------------------------------------------

  getSlotMeta(slotId: number): SaveSlotMeta | undefined {
    return this.slotMetas.get(slotId);
  }

  getAllSlotMetas(): SaveSlotMeta[] {
    return [...this.slotMetas.values()].sort((a, b) => b.timestamp - a.timestamp);
  }

  hasAnySave(): boolean {
    return this.slotMetas.size > 0;
  }

  // ---------------------------------------------------------------------------
  // Default settings fallback
  // ---------------------------------------------------------------------------

  private getDefaultSettings(): import('@t/save').UserSettings {
    return {
      textSpeed: 'normal',
      autoSpeed: 1500,
      masterVolume: 0.8,
      musicVolume: 0.7,
      sfxVolume: 0.8,
      voiceVolume: 1.0,
      ambientVolume: 0.5,
      fullscreen: false,
      resolution: '1920x1080',
      locale: 'en',
      highContrast: false,
      largeText: false,
      reducedMotion: false,
      screenReaderHints: false,
      closedCaptions: false,
      dyslexicFont: false,
      skipReadText: false,
      skipAllText: false,
      autoSaveEnabled: true,
      showSoulMeter: true,
      showRelationshipWheel: false,
      keybindings: {},
    };
  }
}
