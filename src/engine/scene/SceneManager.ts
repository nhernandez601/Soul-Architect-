/**
 * SceneManager — loads, transitions, and executes scene node graphs.
 *
 * A scene is a directed graph of SceneNodes.  The manager walks the graph,
 * dispatching each node to the appropriate subsystem and waiting for
 * completion before advancing.
 */

import { BaseService } from '../core/BaseService';
import { registry } from '../core/ServiceRegistry';
import type { EngineConfig, ID } from '@types/core';
import type {
  SceneDefinition,
  SceneNode,
  DialogueNode,
  ChoiceNode,
  CharacterShowNode,
  CharacterHideNode,
  CharacterMoveNode,
  CharacterEmoteNode,
  BackgroundChangeNode,
  MusicChangeNode,
  SoundPlayNode,
  SoulChangeNode,
  RelationshipChangeNode,
  FlagSetNode,
  FlagCheckNode,
  GotoNode,
  WaitNode,
  CameraNode,
  EffectNode,
  WeatherChangeNode,
  NarratorNode,
  CGShowNode,
} from '@types/scene';
import type { SoulCondition } from '@types/soul';

export class SceneManager extends BaseService {
  private scenes = new Map<ID, SceneDefinition>();
  private currentScene: SceneDefinition | null = null;
  private currentNodeId: ID | null = null;
  private isExecuting = false;
  private isPaused = false;
  private awaitingInput = false;

  constructor(private readonly config: EngineConfig) {
    super('SceneManager');
  }

  protected async onInit(): Promise<void> {
    this.subscribe('input:action', ({ action }) => {
      if (action === 'advance' && this.awaitingInput) {
        this.awaitingInput = false;
        void this.advance();
      }
    });
  }

  protected async onStart(): Promise<void> { /* ready */ }

  protected onPause(): void { this.isPaused = true; }
  protected onResume(): void {
    this.isPaused = false;
    if (!this.awaitingInput && this.currentNodeId) void this.advance();
  }

  protected onDestroy(): void {
    this.scenes.clear();
    this.currentScene = null;
  }

  // ---------------------------------------------------------------------------
  // Scene registry
  // ---------------------------------------------------------------------------

  registerScene(scene: SceneDefinition): void {
    this.scenes.set(scene.id, scene);
  }

  registerScenes(scenes: SceneDefinition[]): void {
    scenes.forEach((s) => this.registerScene(s));
  }

  // ---------------------------------------------------------------------------
  // Scene loading & transition
  // ---------------------------------------------------------------------------

  async loadScene(sceneId: ID, startNodeId?: ID): Promise<void> {
    this.assertReady('loadScene');
    const scene = this.scenes.get(sceneId);
    if (!scene) throw new Error(`Scene "${sceneId}" not found`);

    this.bus.emit('scene:load_start', { sceneId });

    if (this.currentScene) {
      this.bus.emit('scene:transition_start', { from: this.currentScene.id, to: sceneId });
    }

    this.currentScene = scene;
    this.currentNodeId = startNodeId ?? (scene.nodes[0]?.id ?? null);
    this.isExecuting = false;
    this.awaitingInput = false;

    this.bus.emit('scene:load_complete', { sceneId });
    await this.advance();
  }

  // ---------------------------------------------------------------------------
  // Node execution
  // ---------------------------------------------------------------------------

  private async advance(): Promise<void> {
    if (this.isExecuting || this.isPaused || !this.currentNodeId || !this.currentScene) return;

    this.isExecuting = true;

    while (this.currentNodeId && !this.isPaused && !this.awaitingInput) {
      const node = this.currentScene.nodes.find((n) => n.id === this.currentNodeId);
      if (!node) {
        this.log(`Node "${this.currentNodeId}" not found in scene — ending scene`);
        this.endScene();
        break;
      }

      // Check node conditions
      if (node.conditions && !this.evaluateConditions(node.conditions)) {
        if (node.skipOnConditionFail) {
          this.currentNodeId = this.getNextNodeId(node) ?? null;
          continue;
        }
        // Block execution — condition not met
        break;
      }

      this.bus.emit('scene:node_enter', { nodeId: node.id, sceneId: this.currentScene.id });
      const nextId = await this.executeNode(node);
      this.bus.emit('scene:node_exit', { nodeId: node.id, sceneId: this.currentScene.id });

      this.currentNodeId = nextId ?? null;
    }

    this.isExecuting = false;
  }

  /** Returns the next node ID after execution, or null to end the scene. */
  private async executeNode(node: SceneNode): Promise<ID | undefined | null> {
    switch (node.type) {
      case 'dialogue':           return this.execDialogue(node as DialogueNode);
      case 'choice':             return this.execChoice(node as ChoiceNode);
      case 'show_character':     return this.execShowCharacter(node as CharacterShowNode);
      case 'hide_character':     return this.execHideCharacter(node as CharacterHideNode);
      case 'move_character':     return this.execMoveCharacter(node as CharacterMoveNode);
      case 'emote_character':    return this.execEmoteCharacter(node as CharacterEmoteNode);
      case 'change_background':  return this.execChangeBackground(node as BackgroundChangeNode);
      case 'change_music':       return this.execChangeMusic(node as MusicChangeNode);
      case 'play_sound':         return this.execPlaySound(node as SoundPlayNode);
      case 'soul_change':        return this.execSoulChange(node as SoulChangeNode);
      case 'relationship_change':return this.execRelationshipChange(node as RelationshipChangeNode);
      case 'flag_set':           return this.execFlagSet(node as FlagSetNode);
      case 'flag_check':         return this.execFlagCheck(node as FlagCheckNode);
      case 'goto':               return this.execGoto(node as GotoNode);
      case 'wait':               return this.execWait(node as WaitNode);
      case 'camera':             return this.execCamera(node as CameraNode);
      case 'effect':             return this.execEffect(node as EffectNode);
      case 'weather_change':     return this.execWeatherChange(node as WeatherChangeNode);
      case 'narrator':           return this.execNarrator(node as NarratorNode);
      case 'show_cg':            return this.execShowCG(node as CGShowNode);
      default:
        this.warn(`Unknown node type: ${(node as SceneNode).type}`);
        return this.getNextNodeId(node);
    }
  }

  // ---------------------------------------------------------------------------
  // Node executors
  // ---------------------------------------------------------------------------

  private async execDialogue(node: DialogueNode): Promise<ID | undefined> {
    const dialogue = registry.get<import('../dialogue/DialogueManager').DialogueManager>('dialogue');
    this.awaitingInput = true;
    await dialogue.presentLine(node);
    return node.nextNodeId;
  }

  private async execChoice(node: ChoiceNode): Promise<ID | undefined> {
    const choice = registry.get<import('../choice/ChoiceManager').ChoiceManager>('choice');
    const selected = await choice.present(node);
    return selected.gotoNodeId;
  }

  private async execShowCharacter(node: CharacterShowNode): Promise<ID | undefined> {
    const characters = registry.get<import('../character/CharacterManager').CharacterManager>('character');
    await characters.show(node.characterId, node.emotion, node.position, node.transitionIn, node.durationMs, node.tags);
    return node.nextNodeId;
  }

  private async execHideCharacter(node: CharacterHideNode): Promise<ID | undefined> {
    const characters = registry.get<import('../character/CharacterManager').CharacterManager>('character');
    await characters.hide(node.characterId, node.transitionOut, node.durationMs);
    return node.nextNodeId;
  }

  private async execMoveCharacter(node: CharacterMoveNode): Promise<ID | undefined> {
    const characters = registry.get<import('../character/CharacterManager').CharacterManager>('character');
    await characters.moveTo(node.characterId, node.targetPosition, node.durationMs, node.easing);
    return node.nextNodeId;
  }

  private async execEmoteCharacter(node: CharacterEmoteNode): Promise<ID | undefined> {
    const characters = registry.get<import('../character/CharacterManager').CharacterManager>('character');
    characters.setEmotion(node.characterId, node.emotion, node.tags);
    return node.nextNodeId;
  }

  private async execChangeBackground(node: BackgroundChangeNode): Promise<ID | undefined> {
    const bg = registry.get<import('../background/BackgroundManager').BackgroundManager>('background');
    await bg.transition(node.backgroundSpec);
    return node.nextNodeId;
  }

  private async execChangeMusic(node: MusicChangeNode): Promise<ID | undefined> {
    const audio = registry.get<import('../audio/AudioManager').AudioManager>('audio');
    if (node.musicSpec) {
      await audio.playMusic(node.musicSpec.trackId, node.musicSpec);
    } else {
      audio.stopMusic();
    }
    return node.nextNodeId;
  }

  private async execPlaySound(node: SoundPlayNode): Promise<ID | undefined> {
    const audio = registry.get<import('../audio/AudioManager').AudioManager>('audio');
    audio.playSFX(node.soundId, node.volume);
    return node.nextNodeId;
  }

  private async execSoulChange(node: SoulChangeNode): Promise<ID | undefined> {
    const soul = registry.get<import('../../systems/soul/SoulSystem').SoulSystem>('soul');
    soul.applyDelta(node.delta, `node:${node.id}`);
    return node.nextNodeId;
  }

  private async execRelationshipChange(node: RelationshipChangeNode): Promise<ID | undefined> {
    const rel = registry.get<import('../../systems/relationship/RelationshipSystem').RelationshipSystem>('relationship');
    rel.applyDelta(node.characterId, node.stat, node.delta);
    return node.nextNodeId;
  }

  private async execFlagSet(node: FlagSetNode): Promise<ID | undefined> {
    Object.entries(node.flags).forEach(([key, value]) => {
      this.bus.emit('flag:set', { key, value });
    });
    return node.nextNodeId;
  }

  private execFlagCheck(node: FlagCheckNode): ID {
    const pass = this.evaluateConditions(node.conditions);
    return pass ? node.trueNodeId : node.falseNodeId;
  }

  private async execGoto(node: GotoNode): Promise<ID | undefined> {
    if (node.targetSceneId) {
      await this.loadScene(node.targetSceneId, node.targetNodeId);
      return undefined; // loadScene takes over
    }
    return node.targetNodeId;
  }

  private async execWait(node: WaitNode): Promise<ID | undefined> {
    if (node.awaitInput) {
      this.awaitingInput = true;
    } else {
      await new Promise<void>((resolve) => setTimeout(resolve, node.durationMs));
    }
    return node.nextNodeId;
  }

  private async execCamera(node: CameraNode): Promise<ID | undefined> {
    const camera = registry.get<import('../camera/CameraManager').CameraManager>('camera');
    await camera.applyEffect(node.effect, node.durationMs);
    return node.nextNodeId;
  }

  private async execEffect(node: EffectNode): Promise<ID | undefined> {
    const particles = registry.get<import('../particle/ParticleManager').ParticleManager>('particle');
    particles.playEffect(node.effectId, node.params, node.durationMs);
    return node.nextNodeId;
  }

  private async execWeatherChange(node: WeatherChangeNode): Promise<ID | undefined> {
    const particles = registry.get<import('../particle/ParticleManager').ParticleManager>('particle');
    particles.setWeather(node.weatherSpec, node.transitionMs);
    return node.nextNodeId;
  }

  private async execNarrator(node: NarratorNode): Promise<ID | undefined> {
    const dialogue = registry.get<import('../dialogue/DialogueManager').DialogueManager>('dialogue');
    this.awaitingInput = true;
    await dialogue.presentNarration(node);
    return node.nextNodeId;
  }

  private async execShowCG(node: CGShowNode): Promise<ID | undefined> {
    this.bus.emit('gallery:cg_unlocked', { cgId: node.cgId });
    this.awaitingInput = true;
    // CG display is handled by the UI layer via the event bus
    return node.nextNodeId;
  }

  // ---------------------------------------------------------------------------
  // Condition evaluation (delegates to SoulSystem)
  // ---------------------------------------------------------------------------

  private evaluateConditions(conditions: SoulCondition[]): boolean {
    if (conditions.length === 0) return true;
    const soul = registry.get<import('../../systems/soul/SoulSystem').SoulSystem>('soul');
    return conditions.every((c) => soul.evaluateCondition(c));
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  private getNextNodeId(node: SceneNode): ID | undefined {
    return ('nextNodeId' in node) ? (node as { nextNodeId?: ID }).nextNodeId : undefined;
  }

  private endScene(): void {
    if (this.currentScene) {
      this.bus.emit('scene:end', { sceneId: this.currentScene.id });
    }
    this.currentScene = null;
    this.currentNodeId = null;
  }

  get currentSceneId(): ID | null {
    return this.currentScene?.id ?? null;
  }

  get currentScene_(): SceneDefinition | null {
    return this.currentScene;
  }
}
