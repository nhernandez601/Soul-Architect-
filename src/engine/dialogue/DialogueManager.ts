/**
 * DialogueManager — controls the typewriter effect, text display,
 * voice line scheduling, and skip/auto-read modes.
 */

import { BaseService } from '../core/BaseService';
import type { EngineConfig, TextSpeed, TEXT_SPEED_MS } from '@t/core';
import type { DialogueNode, NarratorNode } from '@t/scene';

export type DialogueState = 'idle' | 'typing' | 'complete' | 'skipped';

export class DialogueManager extends BaseService {
  private state: DialogueState = 'idle';
  private currentNode: DialogueNode | NarratorNode | null = null;
  private typewriterInterval: ReturnType<typeof setInterval> | null = null;
  private resolveAdvance: (() => void) | null = null;

  private textSpeed: TextSpeed;
  private autoMode = false;
  private autoSpeedMs: number;
  private skipMode: 'none' | 'read' | 'all' = 'none';

  constructor(private readonly config: EngineConfig) {
    super('DialogueManager');
    this.textSpeed = config.input.textSpeed;
    this.autoSpeedMs = config.input.autoSpeed;
  }

  protected async onInit(): Promise<void> {
    this.subscribe('input:action', ({ action }) => {
      switch (action) {
        case 'advance':    this.handleAdvance(); break;
        case 'skip':       this.handleSkip(); break;
        case 'auto':       this.toggleAuto(); break;
        case 'fast-fwd':   this.setSkipMode('read'); break;
      }
    });
  }

  protected async onStart(): Promise<void> { /* nothing */ }

  protected onDestroy(): void {
    this.clearTypewriter();
  }

  // ---------------------------------------------------------------------------
  // Present a dialogue line
  // ---------------------------------------------------------------------------

  async presentLine(node: DialogueNode): Promise<void> {
    this.currentNode = node;
    this.state = 'typing';

    this.bus.emit('dialogue:line_start', {
      nodeId: node.id,
      speaker: node.speaker,
      text: node.text,
    });

    const shouldInstant = this.skipMode !== 'none' || this.textSpeed === 'instant';

    if (shouldInstant) {
      this.completeInstantly(node.text);
    } else {
      await this.runTypewriter(node.text, node.typewriterSpeed);
    }

    this.state = 'complete';

    if (this.autoMode) {
      await new Promise<void>((resolve) => setTimeout(resolve, this.autoSpeedMs));
      this.resolveAdvance?.();
    } else {
      await this.waitForAdvance();
    }

    this.bus.emit('dialogue:line_complete', { nodeId: node.id });
    this.state = 'idle';
    this.currentNode = null;
  }

  async presentNarration(node: NarratorNode): Promise<void> {
    await this.presentLine({
      ...node,
      type: 'dialogue',
      speaker: 'narrator',
      nextNodeId: node.nextNodeId,
    } as DialogueNode);
  }

  // ---------------------------------------------------------------------------
  // Typewriter
  // ---------------------------------------------------------------------------

  private async runTypewriter(text: string, speedOverride?: number): Promise<void> {
    const speedMsPerChar = speedOverride
      ?? this.getSpeedMs();

    if (speedMsPerChar === 0) {
      this.completeInstantly(text);
      return;
    }

    let index = 0;
    const chars = [...text]; // Unicode-safe split

    await new Promise<void>((resolve) => {
      this.typewriterInterval = setInterval(() => {
        if (this.state === 'skipped') {
          this.clearTypewriter();
          resolve();
          return;
        }

        index++;
        this.bus.emit('dialogue:typewriter_tick', { charIndex: index, total: chars.length });

        if (index >= chars.length) {
          this.clearTypewriter();
          resolve();
        }
      }, speedMsPerChar);
    });
  }

  private completeInstantly(text: string): void {
    this.clearTypewriter();
    this.bus.emit('dialogue:typewriter_tick', { charIndex: text.length, total: text.length });
  }

  private clearTypewriter(): void {
    if (this.typewriterInterval !== null) {
      clearInterval(this.typewriterInterval);
      this.typewriterInterval = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Input handlers
  // ---------------------------------------------------------------------------

  private handleAdvance(): void {
    if (this.state === 'typing') {
      // First advance: complete typing instantly
      this.state = 'skipped';
      return;
    }
    if (this.state === 'complete') {
      this.resolveAdvance?.();
      this.resolveAdvance = null;
    }
  }

  private handleSkip(): void {
    if (this.state === 'typing') this.state = 'skipped';
    else this.resolveAdvance?.();
  }

  private toggleAuto(): void {
    this.autoMode = !this.autoMode;
  }

  private setSkipMode(mode: 'none' | 'read' | 'all'): void {
    this.skipMode = mode;
  }

  private waitForAdvance(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.resolveAdvance = resolve;
    });
  }

  // ---------------------------------------------------------------------------
  // Speed helpers
  // ---------------------------------------------------------------------------

  private getSpeedMs(): number {
    const map: Record<TextSpeed, number> = {
      slow: 60,
      normal: 30,
      fast: 15,
      instant: 0,
    };
    return map[this.textSpeed] ?? 30;
  }

  setTextSpeed(speed: TextSpeed): void {
    this.textSpeed = speed;
  }

  setAutoMode(enabled: boolean): void {
    this.autoMode = enabled;
  }

  get dialogueState(): DialogueState {
    return this.state;
  }
}
