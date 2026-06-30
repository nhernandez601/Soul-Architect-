/**
 * Engine — the root orchestrator of Soul Architect.
 *
 * Bootstraps every subsystem in the correct order, wires the event bus,
 * manages the top-level lifecycle (init → start → pause / resume → shutdown),
 * and exposes the global engine singleton.
 *
 * Usage:
 *   await engine.boot(config);
 *   engine.start();
 */

import { engineBus } from './EventBus';
import { registry } from './ServiceRegistry';
import type { EngineConfig, EngineState } from '@t/core';

export class Engine {
  private state: EngineState = 'uninitialized';
  private config!: EngineConfig;
  private rafHandle: number | null = null;
  private lastFrameTime = 0;

  // ---------------------------------------------------------------------------
  // Boot sequence
  // ---------------------------------------------------------------------------

  async boot(config: EngineConfig): Promise<void> {
    if (this.state !== 'uninitialized') {
      console.warn('[Engine] boot() called on an already-booted engine');
      return;
    }

    this.config = config;
    this.setState('initializing');
    console.log(`[Engine] Booting Soul Architect v${config.version}`);

    try {
      await this.registerServices();
      await registry.initAll();
      await registry.startAll();
      await this.loadGameData();
      this.bindWindowEvents();
      this.setState('ready');
      engineBus.emit('engine:ready');
      console.log('[Engine] Boot complete — Soul Architect is ready');
    } catch (error) {
      this.setState('error');
      engineBus.emit('engine:error', {
        message: String(error),
        fatal: true,
      });
      throw error;
    }
  }

  /** Start the main loop after boot. */
  start(): void {
    if (this.state !== 'ready') {
      console.warn('[Engine] start() called before engine is ready');
      return;
    }
    this.setState('running');
    this.rafHandle = requestAnimationFrame(this.tick.bind(this));
  }

  // ---------------------------------------------------------------------------
  // Service registration (deferred import to allow code-splitting)
  // ---------------------------------------------------------------------------

  private async registerServices(): Promise<void> {
    // Dynamically import managers so they can be code-split by Vite.
    // Registration order defines init order — critical subsystems first.
    const { AssetManager } = await import('../core/AssetManager');
    const { SceneManager } = await import('../scene/SceneManager');
    const { CharacterManager } = await import('../character/CharacterManager');
    const { BackgroundManager } = await import('../background/BackgroundManager');
    const { AudioManager } = await import('../audio/AudioManager');
    const { ParticleManager } = await import('../particle/ParticleManager');
    const { AnimationManager } = await import('../animation/AnimationManager');
    const { DialogueManager } = await import('../dialogue/DialogueManager');
    const { ChoiceManager } = await import('../choice/ChoiceManager');
    const { CameraManager } = await import('../camera/CameraManager');
    const { InputManager } = await import('../input/InputManager');
    const { SaveManager } = await import('../save/SaveManager');
    const { SoulSystem } = await import('../../systems/soul/SoulSystem');
    const { RelationshipSystem } = await import('../../systems/relationship/RelationshipSystem');
    // Phase 2 systems
    const { CodexSystem } = await import('../../systems/codex/CodexSystem');
    const { JournalSystem } = await import('../../systems/journal/JournalSystem');
    const { MemoryLogSystem } = await import('../../systems/memory/MemoryLogSystem');
    const { QuestSystem } = await import('../../systems/quest/QuestSystem');
    const { AchievementSystem } = await import('../../systems/achievement/AchievementSystem');
    const { InventorySystem } = await import('../../systems/inventory/InventorySystem');
    const { GallerySystem } = await import('../../systems/gallery/GallerySystem');
    const { TimelineSystem } = await import('../../systems/timeline/TimelineSystem');
    const { NotificationSystem } = await import('../../systems/notification/NotificationSystem');
    const { ModSystem } = await import('../../systems/mod/ModSystem');
    const { LocalizationSystem } = await import('../../localization/LocalizationSystem');
    const { DevConsole } = await import('../core/DevConsole');
    // Phase 3 systems
    const { EndingSystem } = await import('../../systems/ending/EndingSystem');
    const { PostProcessingManager } = await import('../postprocessing/PostProcessingManager');
    const { TransitionManager } = await import('../transition/TransitionManager');

    registry.register('asset', new AssetManager(this.config));
    registry.register('scene', new SceneManager(this.config));
    registry.register('character', new CharacterManager(this.config));
    registry.register('background', new BackgroundManager());
    registry.register('audio', new AudioManager(this.config.audio));
    registry.register('particle', new ParticleManager());
    registry.register('animation', new AnimationManager());
    registry.register('dialogue', new DialogueManager(this.config));
    registry.register('choice', new ChoiceManager());
    registry.register('camera', new CameraManager());
    registry.register('input', new InputManager(this.config.input));
    registry.register('save', new SaveManager(this.config.save));
    registry.register('soul', new SoulSystem());
    registry.register('relationship', new RelationshipSystem());
    // Phase 2
    registry.register('codex', new CodexSystem());
    registry.register('journal', new JournalSystem());
    registry.register('memory', new MemoryLogSystem());
    registry.register('quest', new QuestSystem());
    registry.register('achievement', new AchievementSystem());
    registry.register('inventory', new InventorySystem());
    registry.register('gallery', new GallerySystem());
    registry.register('timeline', new TimelineSystem());
    registry.register('notification', new NotificationSystem());
    registry.register('mod', new ModSystem());
    registry.register('localization', new LocalizationSystem());
    // Phase 3
    registry.register('ending', new EndingSystem());
    registry.register('postprocessing', new PostProcessingManager());
    registry.register('transition', new TransitionManager());
    if (import.meta.env.DEV) {
      registry.register('devConsole', new DevConsole());
    }
  }

  // ---------------------------------------------------------------------------
  // Game data loading (endings, quests, codex, etc.)
  // ---------------------------------------------------------------------------

  private async loadGameData(): Promise<void> {
    const { ENDING_DEFINITIONS } = await import('../../data/endingDefinitions');
    const ending = registry.get<import('../../systems/ending/EndingSystem').EndingSystem>('ending');
    ending.registerEndings(ENDING_DEFINITIONS);

    const { CODEX_DEFINITIONS } = await import('../../data/codexDefinitions');
    const codex = registry.get<import('../../systems/codex/CodexSystem').CodexSystem>('codex');
    codex.registerEntries(CODEX_DEFINITIONS);
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------

  private tick(timestamp: number): void {
    if (this.state !== 'running') return;

    const deltaMs = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    // Subsystems that need per-frame updates subscribe to this via bus or
    // override their own rAF.  The engine tick exists for timing coordination.
    engineBus.emit('engine:state_change', { from: 'running', to: 'running' });

    this.rafHandle = requestAnimationFrame(this.tick.bind(this));
    void deltaMs; // used by subsystems via their own subscriptions
  }

  // ---------------------------------------------------------------------------
  // Pause / Resume
  // ---------------------------------------------------------------------------

  pause(): void {
    if (this.state !== 'running') return;
    this.setState('paused');
    registry.pauseAll();
    engineBus.emit('engine:pause');
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.setState('running');
    registry.resumeAll();
    engineBus.emit('engine:resume');
    this.rafHandle = requestAnimationFrame(this.tick.bind(this));
  }

  // ---------------------------------------------------------------------------
  // Shutdown
  // ---------------------------------------------------------------------------

  async shutdown(): Promise<void> {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    registry.destroyAll();
    engineBus.removeAllListeners();
    this.setState('shutdown');
    console.log('[Engine] Shutdown complete');
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private setState(next: EngineState): void {
    const prev = this.state;
    this.state = next;
    if (prev !== next) {
      engineBus.emit('engine:state_change', { from: prev, to: next });
    }
  }

  private bindWindowEvents(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('blur', () => {
      if (this.config.audio.muteOnFocusLoss) {
        // AudioManager handles its own muting via the bus
        engineBus.emit('engine:pause');
      }
    });
    window.addEventListener('focus', () => {
      engineBus.emit('engine:resume');
    });
    window.addEventListener('beforeunload', () => {
      void this.shutdown();
    });
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  get currentState(): EngineState {
    return this.state;
  }

  getConfig(): Readonly<EngineConfig> {
    return this.config;
  }

  /** Convenience accessor to any registered service. */
  getService<T>(key: string): T {
    return registry.get<import('./BaseService').BaseService>(key) as unknown as T;
  }
}

/** Singleton engine instance. */
export const engine = new Engine();
