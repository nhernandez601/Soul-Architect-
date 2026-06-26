/**
 * ModSystem — external mod loading and sandboxed integration.
 *
 * Mods are self-contained packages (JSON manifest + SASL scenes + assets).
 * They can add scenes, characters, music, and backgrounds without touching
 * core engine files. Mods are loaded from /mods/ or a user directory.
 *
 * Security: mods can only add content — they cannot override core systems
 * or execute arbitrary code (no JS mods, SASL only).
 */

import { BaseService } from '../../engine/core/BaseService';
import type { ID, SemVer } from '@t/core';

export interface ModManifest {
  id: ID;
  name: string;
  version: SemVer;
  author: string;
  description: string;
  engineVersion: string;      // minimum engine version required
  scenes: string[];           // relative paths to .sasl files
  characters: string[];       // relative paths to character JSON files
  music: string[];            // relative paths to audio files
  backgrounds: string[];      // relative paths to image files
  localization?: string[];    // relative paths to localization JSON files
  entryScene?: ID;            // first scene to load from this mod
  dependencies: ID[];         // other mod IDs required
  tags: string[];
}

export interface LoadedMod {
  manifest: ModManifest;
  basePath: string;
  status: 'loaded' | 'error' | 'disabled';
  error?: string;
  loadedAt: number;
}

export class ModSystem extends BaseService {
  private readonly mods = new Map<ID, LoadedMod>();

  protected async onInit(): Promise<void> { /* nothing */ }
  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void { this.mods.clear(); }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  async loadMod(manifestPath: string): Promise<LoadedMod> {
    try {
      const response = await fetch(manifestPath);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json() as ModManifest;

      const basePath = manifestPath.replace(/\/manifest\.json$/, '');

      if (this.mods.has(manifest.id)) {
        this.warn(`Mod "${manifest.id}" already loaded`);
        return this.mods.get(manifest.id)!;
      }

      // Check dependencies
      for (const dep of manifest.dependencies) {
        if (!this.mods.has(dep)) {
          throw new Error(`Missing dependency: "${dep}"`);
        }
      }

      const loaded: LoadedMod = {
        manifest,
        basePath,
        status: 'loaded',
        loadedAt: Date.now(),
      };

      this.mods.set(manifest.id, loaded);
      await this.integrateModContent(loaded);
      this.log(`Mod loaded: "${manifest.name}" v${manifest.version}`);
      this.bus.emit('ui:notification', { message: `Mod loaded: ${manifest.name}`, type: 'info' });

      return loaded;
    } catch (error) {
      const failed: LoadedMod = {
        manifest: { id: manifestPath, name: manifestPath } as ModManifest,
        basePath: '',
        status: 'error',
        error: String(error),
        loadedAt: Date.now(),
      };
      this.error(`Failed to load mod "${manifestPath}": ${String(error)}`);
      return failed;
    }
  }

  async loadModsFromDirectory(dir: string): Promise<void> {
    try {
      const response = await fetch(`${dir}/index.json`);
      if (!response.ok) return;
      const index = await response.json() as { mods: string[] };
      for (const modPath of index.mods) {
        await this.loadMod(`${dir}/${modPath}/manifest.json`);
      }
    } catch {
      this.warn('No mod index found or failed to load mods directory');
    }
  }

  // ---------------------------------------------------------------------------
  // Integration
  // ---------------------------------------------------------------------------

  private async integrateModContent(mod: LoadedMod): Promise<void> {
    const { registry } = await import('../../engine/core/ServiceRegistry');
    const sceneManager = registry.get<import('../../engine/scene/SceneManager').SceneManager>('scene');
    const parser = new (await import('../../scripting/parser/ScriptParser')).ScriptParser();

    // Load scenes
    for (const scenePath of mod.manifest.scenes) {
      try {
        const response = await fetch(`${mod.basePath}/${scenePath}`);
        const source = await response.text();
        const scenes = parser.parse(source);
        sceneManager.registerScenes(scenes);
        this.log(`  Registered ${scenes.length} scene(s) from ${scenePath}`);
      } catch (e) {
        this.warn(`  Failed to load scene "${scenePath}": ${String(e)}`);
      }
    }

    // Characters, music, backgrounds — registered via AssetManager path extensions
    // (no dynamic code execution; assets are referenced by path at runtime)
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  getLoadedMods(): LoadedMod[] { return [...this.mods.values()]; }
  isLoaded(id: ID): boolean { return this.mods.has(id); }
  getMod(id: ID): LoadedMod | undefined { return this.mods.get(id); }
  getLoadedCount(): number { return [...this.mods.values()].filter((m) => m.status === 'loaded').length; }
}
