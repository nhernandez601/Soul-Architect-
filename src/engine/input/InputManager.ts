/**
 * InputManager — unified keyboard, mouse, touch, and gamepad input.
 *
 * Maps raw input events to semantic engine actions and emits them
 * via the event bus. Supports rebindable keybindings.
 */

import { BaseService } from '../core/BaseService';
import type { InputConfig } from '@types/core';

type ActionMap = Record<string, string>;

const DEFAULT_KEYBINDINGS: ActionMap = {
  'Enter':     'advance',
  'Space':     'advance',
  'Escape':    'menu',
  'ArrowUp':   'nav-up',
  'ArrowDown': 'nav-down',
  'ArrowLeft': 'nav-left',
  'ArrowRight':'nav-right',
  'KeyS':      'quicksave',
  'KeyL':      'quickload',
  'KeyA':      'auto',
  'KeyF':      'fast-fwd',
  'KeyH':      'hide-ui',
  'Tab':       'skip',
  'F11':       'fullscreen',
  'F12':       'screenshot',
};

export class InputManager extends BaseService {
  private keybindings: ActionMap;
  private enabled = true;
  private touchStartX = 0;
  private touchStartY = 0;
  private gamepad: Gamepad | null = null;
  private gamepadInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly config: InputConfig) {
    super('InputManager');
    this.keybindings = { ...DEFAULT_KEYBINDINGS };
  }

  protected async onInit(): Promise<void> {
    if (this.config.enableKeyboard) this.bindKeyboard();
    if (this.config.enableMouse)    this.bindMouse();
    if (this.config.enableTouch)    this.bindTouch();
    if (this.config.enableGamepad)  this.bindGamepad();
  }

  protected async onStart(): Promise<void> { /* nothing */ }

  protected onPause(): void { this.enabled = false; }
  protected onResume(): void { this.enabled = true; }

  protected onDestroy(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('touchstart', this.handleTouchStart);
    window.removeEventListener('touchend', this.handleTouchEnd);
    if (this.gamepadInterval) clearInterval(this.gamepadInterval);
  }

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  private bindKeyboard(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    const modifiers: string[] = [];
    if (e.ctrlKey) modifiers.push('ctrl');
    if (e.shiftKey) modifiers.push('shift');
    if (e.altKey) modifiers.push('alt');

    this.bus.emit('input:key_down', { key: e.code, modifiers });

    const action = this.keybindings[e.code];
    if (action) {
      e.preventDefault();
      this.bus.emit('input:action', { action });
    }
  };

  private readonly handleKeyUp = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    this.bus.emit('input:key_up', { key: e.code });
  };

  // ---------------------------------------------------------------------------
  // Mouse
  // ---------------------------------------------------------------------------

  private bindMouse(): void {
    window.addEventListener('click', () => {
      if (!this.enabled) return;
      this.bus.emit('input:action', { action: 'advance' });
    });
    window.addEventListener('contextmenu', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.bus.emit('input:action', { action: 'menu' });
    });
  }

  // ---------------------------------------------------------------------------
  // Touch
  // ---------------------------------------------------------------------------

  private bindTouch(): void {
    window.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    window.addEventListener('touchend', this.handleTouchEnd);
  }

  private readonly handleTouchStart = (e: TouchEvent): void => {
    this.touchStartX = e.touches[0]?.clientX ?? 0;
    this.touchStartY = e.touches[0]?.clientY ?? 0;
  };

  private readonly handleTouchEnd = (e: TouchEvent): void => {
    if (!this.enabled) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - this.touchStartX;
    const dy = (e.changedTouches[0]?.clientY ?? 0) - this.touchStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 10) {
      // Tap
      this.bus.emit('input:action', { action: 'advance' });
    } else if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal swipe
      this.bus.emit('input:action', { action: dx > 0 ? 'nav-right' : 'nav-left' });
    } else {
      // Vertical swipe
      this.bus.emit('input:action', { action: dy > 0 ? 'nav-down' : 'nav-up' });
    }
  };

  // ---------------------------------------------------------------------------
  // Gamepad
  // ---------------------------------------------------------------------------

  private bindGamepad(): void {
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepad = e.gamepad;
      this.log(`Gamepad connected: ${e.gamepad.id}`);
      this.startGamepadPolling();
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.gamepad = null;
      if (this.gamepadInterval) clearInterval(this.gamepadInterval);
    });
  }

  private startGamepadPolling(): void {
    this.gamepadInterval = setInterval(() => {
      const pads = navigator.getGamepads();
      const pad = pads[this.gamepad?.index ?? 0];
      if (!pad || !this.enabled) return;

      if (pad.buttons[0]?.pressed) this.bus.emit('input:action', { action: 'advance' });
      if (pad.buttons[1]?.pressed) this.bus.emit('input:action', { action: 'back' });
      if (pad.buttons[9]?.pressed) this.bus.emit('input:action', { action: 'menu' });
    }, 100);
  }

  // ---------------------------------------------------------------------------
  // Rebinding
  // ---------------------------------------------------------------------------

  rebind(keyCode: string, action: string): void {
    this.keybindings[keyCode] = action;
  }

  resetBindings(): void {
    this.keybindings = { ...DEFAULT_KEYBINDINGS };
  }

  getBindings(): ActionMap {
    return { ...this.keybindings };
  }
}
