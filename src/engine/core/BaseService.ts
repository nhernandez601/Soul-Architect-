/**
 * BaseService — abstract base class for all engine subsystems.
 *
 * Provides a common lifecycle (init / start / pause / resume / destroy),
 * standardised logging, and a reference to the shared EventBus.
 * All managers (SceneManager, AudioManager, etc.) extend this class.
 */

import { engineBus, type EventBus } from './EventBus';
import type { Disposable } from '@types/core';

export type ServiceStatus = 'idle' | 'initializing' | 'ready' | 'paused' | 'destroyed' | 'error';

export abstract class BaseService implements Disposable {
  protected readonly bus: EventBus = engineBus;
  protected status: ServiceStatus = 'idle';
  protected readonly serviceName: string;
  private readonly unsubscribers: Array<() => void> = [];

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle hooks (subclasses override these, not the public methods)
  // ---------------------------------------------------------------------------

  protected abstract onInit(): Promise<void>;
  protected abstract onStart(): Promise<void>;
  protected onPause(): void { /* optional */ }
  protected onResume(): void { /* optional */ }
  protected abstract onDestroy(): void;

  // ---------------------------------------------------------------------------
  // Public lifecycle API
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    if (this.status !== 'idle') {
      this.warn('init() called but service is not idle — skipping');
      return;
    }
    this.status = 'initializing';
    this.log('Initializing...');
    try {
      await this.onInit();
      this.log('Initialized');
    } catch (e) {
      this.status = 'error';
      this.error(`Init failed: ${String(e)}`);
      throw e;
    }
  }

  async start(): Promise<void> {
    if (this.status !== 'initializing' && this.status !== 'idle') {
      this.warn('start() called out of sequence');
      return;
    }
    try {
      await this.onStart();
      this.status = 'ready';
      this.log('Ready');
    } catch (e) {
      this.status = 'error';
      this.error(`Start failed: ${String(e)}`);
      throw e;
    }
  }

  pause(): void {
    if (this.status !== 'ready') return;
    this.status = 'paused';
    this.onPause();
    this.log('Paused');
  }

  resume(): void {
    if (this.status !== 'paused') return;
    this.status = 'ready';
    this.onResume();
    this.log('Resumed');
  }

  dispose(): void {
    if (this.status === 'destroyed') return;
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers.length = 0;
    this.onDestroy();
    this.status = 'destroyed';
    this.log('Destroyed');
  }

  // ---------------------------------------------------------------------------
  // Utility helpers for subclasses
  // ---------------------------------------------------------------------------

  /** Register an event bus listener that is auto-removed on dispose(). */
  protected subscribe<K extends Parameters<EventBus['on']>[0]>(
    event: K,
    handler: Parameters<EventBus['on']<K>>[1]
  ): void {
    const unsub = this.bus.on(event, handler);
    this.unsubscribers.push(unsub);
  }

  protected isReady(): boolean {
    return this.status === 'ready';
  }

  protected assertReady(context: string): void {
    if (this.status !== 'ready') {
      throw new Error(`[${this.serviceName}] Called ${context} before service is ready (status: ${this.status})`);
    }
  }

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  protected log(message: string, ...args: unknown[]): void {
    console.log(`[${this.serviceName}] ${message}`, ...args);
  }

  protected warn(message: string, ...args: unknown[]): void {
    console.warn(`[${this.serviceName}] ${message}`, ...args);
  }

  protected error(message: string, ...args: unknown[]): void {
    console.error(`[${this.serviceName}] ${message}`, ...args);
  }

  get currentStatus(): ServiceStatus {
    return this.status;
  }
}
