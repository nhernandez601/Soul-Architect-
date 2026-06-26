/**
 * DevConsole — in-game developer overlay for debugging and testing.
 *
 * Commands are registered by subsystems; the console is toggled with
 * the backtick key. Only active in non-production builds.
 */

import { BaseService } from './BaseService';
import { registry } from './ServiceRegistry';

type CommandHandler = (args: string[]) => string | void;

interface ConsoleCommand {
  name: string;
  description: string;
  handler: CommandHandler;
}

interface LogEntry {
  level: 'log' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

const MAX_LOG_ENTRIES = 500;
const MAX_HISTORY = 50;

export class DevConsole extends BaseService {
  private readonly commands = new Map<string, ConsoleCommand>();
  private readonly logBuffer: LogEntry[] = [];
  private readonly cmdHistory: string[] = [];
  private historyIndex = -1;
  private visible = false;

  protected async onInit(): Promise<void> {
    this.registerBuiltins();
    this.interceptConsole();

    this.subscribe('engine:ready', () => {
      this.addLog('log', 'DevConsole ready. Type "help" for commands.');
    });
  }

  protected async onStart(): Promise<void> {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKey.bind(this));
    }
  }

  protected onDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKey.bind(this));
    }
  }

  // ---------------------------------------------------------------------------
  // Command registration
  // ---------------------------------------------------------------------------

  register(name: string, description: string, handler: CommandHandler): void {
    this.commands.set(name.toLowerCase(), { name, description, handler });
  }

  unregister(name: string): void {
    this.commands.delete(name.toLowerCase());
  }

  // ---------------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------------

  exec(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';

    this.addHistory(trimmed);
    this.addLog('log', `> ${trimmed}`);

    const [cmdName, ...args] = trimmed.split(/\s+/);
    const cmd = this.commands.get((cmdName ?? '').toLowerCase());

    if (!cmd) {
      const result = `Unknown command: "${cmdName}". Type "help".`;
      this.addLog('warn', result);
      return result;
    }

    try {
      const result = cmd.handler(args) ?? '';
      if (result) this.addLog('log', result);
      return result;
    } catch (e) {
      const msg = `Error in "${cmdName}": ${String(e)}`;
      this.addLog('error', msg);
      return msg;
    }
  }

  // ---------------------------------------------------------------------------
  // History navigation
  // ---------------------------------------------------------------------------

  historyUp(): string {
    if (this.historyIndex < this.cmdHistory.length - 1) this.historyIndex++;
    return this.cmdHistory[this.cmdHistory.length - 1 - this.historyIndex] ?? '';
  }

  historyDown(): string {
    if (this.historyIndex > -1) this.historyIndex--;
    return this.historyIndex === -1 ? '' : (this.cmdHistory[this.cmdHistory.length - 1 - this.historyIndex] ?? '');
  }

  // ---------------------------------------------------------------------------
  // Visibility
  // ---------------------------------------------------------------------------

  show(): void {
    this.visible = true;
    this.bus.emit('ui:notification', { message: 'DevConsole opened', type: 'info' });
  }

  hide(): void {
    this.visible = false;
  }

  toggle(): void {
    this.visible ? this.hide() : this.show();
  }

  isVisible(): boolean { return this.visible; }

  // ---------------------------------------------------------------------------
  // Log access
  // ---------------------------------------------------------------------------

  getLogs(count = 100): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  clearLogs(): void {
    this.logBuffer.length = 0;
  }

  // ---------------------------------------------------------------------------
  // Built-in commands
  // ---------------------------------------------------------------------------

  private registerBuiltins(): void {
    this.register('help', 'List all commands', (args) => {
      const filter = args[0]?.toLowerCase();
      const cmds = [...this.commands.values()].filter(
        (c) => !filter || c.name.includes(filter)
      );
      return cmds.map((c) => `  ${c.name.padEnd(20)} ${c.description}`).join('\n');
    });

    this.register('clear', 'Clear console log', () => {
      this.clearLogs();
    });

    this.register('soul', 'Get/set soul attribute. Usage: soul [attr] [value]', (args) => {
      const soul = registry.get<import('../../systems/soul/SoulSystem').SoulSystem>('soul');
      if (!args[0]) return JSON.stringify(soul.getState().stats, null, 2);
      const attr = args[0] as import('@t/soul').SoulAttribute;
      const val = Number(args[1] ?? 0);
      const stats = soul.getState().stats as Record<string, number>;
      const current = stats[attr] ?? 0;
      const delta = { [attr]: val - current } as import('@t/soul').SoulDelta;
      soul.applyDelta(delta, 'devConsole');
      return `${attr} set to ${val}`;
    });

    this.register('scene', 'Jump to scene by ID. Usage: scene <sceneId>', (args) => {
      if (!args[0]) return 'Usage: scene <sceneId>';
      const scene = registry.get<import('../scene/SceneManager').SceneManager>('scene');
      void scene.loadScene(args[0]);
      return `Loading scene: ${args[0]}`;
    });

    this.register('save', 'Quick save to slot. Usage: save [slot]', (args) => {
      const save = registry.get<import('../save/SaveManager').SaveManager>('save');
      const slot = Number(args[0] ?? 1);
      void save.save(slot, 'manual');
      return `Saved to slot ${slot}`;
    });

    this.register('load', 'Load from slot. Usage: load <slot>', (args) => {
      const save = registry.get<import('../save/SaveManager').SaveManager>('save');
      const slot = Number(args[0] ?? 1);
      void save.load(slot);
      return `Loading slot ${slot}`;
    });

    this.register('flag', 'Get/set a flag. Usage: flag <name> [true|false]', (args) => {
      if (!args[0]) return 'Usage: flag <name> [true|false]';
      const soul = registry.get<import('../../systems/soul/SoulSystem').SoulSystem>('soul');
      if (args[1] === undefined) {
        return `${args[0]} = ${String(soul.getFlag(args[0]) ?? 'undefined')}`;
      }
      const value = args[1] !== 'false';
      this.bus.emit('flag:set', { key: args[0], value });
      return `${args[0]} = ${String(value)}`;
    });

    this.register('unlock_cg', 'Unlock a CG by ID', (args) => {
      if (!args[0]) return 'Usage: unlock_cg <id>';
      this.bus.emit('gallery:cg_unlocked', { cgId: args[0] });
      return `Unlocked CG: ${args[0]}`;
    });

    this.register('achieve', 'Unlock an achievement by ID', (args) => {
      if (!args[0]) return 'Usage: achieve <id>';
      this.bus.emit('achievement:unlocked', { achievementId: args[0] });
      return `Unlocked achievement: ${args[0]}`;
    });

    this.register('notify', 'Push a test notification', (args) => {
      const msg = args.join(' ') || 'Test notification';
      this.bus.emit('ui:notification', { message: msg, type: 'info' });
      return `Pushed: ${msg}`;
    });

    this.register('fps', 'Show FPS (reads from PixiJS ticker)', () => {
      return 'FPS tracking: use PixiJS stats overlay in renderer';
    });

    this.register('version', 'Show engine version', () => {
      return `Soul Architect Engine — Phase 2`;
    });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private onKey(e: KeyboardEvent): void {
    if (e.key === '`' || e.key === '~') {
      e.preventDefault();
      this.toggle();
    }
  }

  private addLog(level: LogEntry['level'], message: string): void {
    this.logBuffer.push({ level, message, timestamp: Date.now() });
    if (this.logBuffer.length > MAX_LOG_ENTRIES) this.logBuffer.shift();
  }

  private addHistory(cmd: string): void {
    if (this.cmdHistory[this.cmdHistory.length - 1] === cmd) return;
    this.cmdHistory.push(cmd);
    if (this.cmdHistory.length > MAX_HISTORY) this.cmdHistory.shift();
    this.historyIndex = -1;
  }

  private interceptConsole(): void {
    if (typeof window === 'undefined') return;
    const orig = { log: console.log, warn: console.warn, error: console.error };
    console.log = (...a) => { orig.log(...a); this.addLog('log', a.join(' ')); };
    console.warn = (...a) => { orig.warn(...a); this.addLog('warn', a.join(' ')); };
    console.error = (...a) => { orig.error(...a); this.addLog('error', a.join(' ')); };
  }
}
