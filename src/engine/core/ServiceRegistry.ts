/**
 * ServiceRegistry — dependency injection container for engine services.
 *
 * Every major subsystem is registered here once and retrieved by its
 * service key. This avoids tight coupling between managers and allows
 * the engine to boot services in a controlled order.
 */

import type { BaseService } from './BaseService';

type ServiceConstructor<T extends BaseService> = new (...args: unknown[]) => T;

export class ServiceRegistry {
  private readonly services = new Map<string, BaseService>();
  private readonly initOrder: string[] = [];

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  register<T extends BaseService>(key: string, instance: T): T {
    if (this.services.has(key)) {
      throw new Error(`[ServiceRegistry] Service "${key}" is already registered`);
    }
    this.services.set(key, instance);
    this.initOrder.push(key);
    return instance;
  }

  // ---------------------------------------------------------------------------
  // Retrieval
  // ---------------------------------------------------------------------------

  get<T extends BaseService>(key: string): T {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`[ServiceRegistry] Service "${key}" not found — is it registered?`);
    }
    return service as T;
  }

  has(key: string): boolean {
    return this.services.has(key);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle orchestration
  // ---------------------------------------------------------------------------

  /** Initialize all registered services in registration order. */
  async initAll(): Promise<void> {
    console.log('[ServiceRegistry] Initializing all services...');
    for (const key of this.initOrder) {
      const svc = this.services.get(key)!;
      console.log(`[ServiceRegistry]  → ${key}`);
      await svc.init();
    }
  }

  /** Start all services after init. */
  async startAll(): Promise<void> {
    console.log('[ServiceRegistry] Starting all services...');
    for (const key of this.initOrder) {
      const svc = this.services.get(key)!;
      await svc.start();
    }
  }

  /** Pause all services (e.g. window blur). */
  pauseAll(): void {
    for (const key of [...this.initOrder].reverse()) {
      this.services.get(key)?.pause();
    }
  }

  /** Resume all services. */
  resumeAll(): void {
    for (const key of this.initOrder) {
      this.services.get(key)?.resume();
    }
  }

  /** Destroy all services in reverse order. */
  destroyAll(): void {
    console.log('[ServiceRegistry] Destroying all services...');
    for (const key of [...this.initOrder].reverse()) {
      this.services.get(key)?.dispose();
    }
    this.services.clear();
    this.initOrder.length = 0;
  }

  get serviceKeys(): string[] {
    return [...this.initOrder];
  }
}

/** Singleton registry — one per engine instance. */
export const registry = new ServiceRegistry();
