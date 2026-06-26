/**
 * GameStore — Zustand global state store for the UI layer.
 *
 * This is the React-facing interface to the engine.  Components
 * read from the store and dispatch actions to the engine via selectors.
 * The store is synced from engine event bus listeners in StoreSync.ts.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { SoulStats, SoulArchetype } from '@t/soul';
import type { CharacterID } from '@t/character';
import type { SaveSlotMeta, UserSettings } from '@t/save';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface DialogueState {
  visible: boolean;
  speaker: CharacterID | 'narrator' | null;
  speakerName: string;
  text: string;
  visibleText: string;  // typewriter-partial text
  isTyping: boolean;
  nodeId: string;
}

export interface ChoiceState {
  visible: boolean;
  prompt?: string;
  choices: Array<{
    id: string;
    text: string;
    disabled?: boolean;
    disabledReason?: string;
    highlight?: string;
  }>;
  nodeId: string;
}

export interface SceneState {
  sceneId: string;
  sceneTitle: string;
  chapter: number;
  act: number;
}

export interface GameUIState {
  // Dialogue
  dialogue: DialogueState;
  // Choices
  choice: ChoiceState;
  // Scene
  scene: SceneState;
  // Soul
  soulStats: SoulStats;
  soulArchetype: SoulArchetype;
  // UI visibility
  hudVisible: boolean;
  menuOpen: boolean;
  activeMenu: string | null;
  activeScreen: string;
  // Save/Load
  saveSlots: SaveSlotMeta[];
  // Settings
  settings: UserSettings;
  // Notifications
  notifications: Notification[];
  // Phase 2 badge counts
  newCodexCount: number;
  newGalleryCount: number;
  activeQuestCount: number;
  newAchievementCount: number;
  // Dev console
  devConsoleVisible: boolean;
}

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'warn' | 'success' | 'error';
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface GameUIActions {
  setDialogue(state: Partial<DialogueState>): void;
  setChoice(state: Partial<ChoiceState>): void;
  setScene(state: Partial<SceneState>): void;
  setSoulStats(stats: SoulStats): void;
  setSoulArchetype(archetype: SoulArchetype): void;
  setTypewriterProgress(visibleText: string, isTyping: boolean): void;
  showHUD(): void;
  hideHUD(): void;
  openMenu(menuId: string): void;
  closeMenu(): void;
  setActiveScreen(screen: string): void;
  setSaveSlots(slots: SaveSlotMeta[]): void;
  updateSettings(settings: Partial<UserSettings>): void;
  addNotification(message: string, type: Notification['type']): void;
  dismissNotification(id: string): void;
  // Phase 2
  setNewCodexCount(n: number): void;
  setNewGalleryCount(n: number): void;
  setActiveQuestCount(n: number): void;
  setNewAchievementCount(n: number): void;
  toggleDevConsole(): void;
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const defaultDialogue: DialogueState = {
  visible: false,
  speaker: null,
  speakerName: '',
  text: '',
  visibleText: '',
  isTyping: false,
  nodeId: '',
};

const defaultSoulStats: SoulStats = {
  hope: 50, faith: 50, fear: 10, love: 50, knowledge: 30,
  compassion: 50, pride: 30, regret: 10, memory: 50, purpose: 50,
  light: 50, shadow: 20,
};

const defaultSettings: UserSettings = {
  textSpeed: 'normal', autoSpeed: 1500,
  masterVolume: 0.8, musicVolume: 0.7, sfxVolume: 0.8, voiceVolume: 1.0, ambientVolume: 0.5,
  fullscreen: false, resolution: '1920x1080', locale: 'en',
  highContrast: false, largeText: false, reducedMotion: false,
  screenReaderHints: false, closedCaptions: false, dyslexicFont: false,
  skipReadText: false, skipAllText: false, autoSaveEnabled: true,
  showSoulMeter: true, showRelationshipWheel: false, keybindings: {},
};

// ---------------------------------------------------------------------------
// Store creation
// ---------------------------------------------------------------------------

export const useGameStore = create<GameUIState & GameUIActions>()(
  immer((set) => ({
    dialogue: defaultDialogue,
    choice: { visible: false, choices: [], nodeId: '' },
    scene: { sceneId: '', sceneTitle: '', chapter: 1, act: 1 },
    soulStats: defaultSoulStats,
    soulArchetype: 'seeker',
    hudVisible: true,
    menuOpen: false,
    activeMenu: null,
    activeScreen: 'main-menu',
    saveSlots: [],
    settings: defaultSettings,
    notifications: [],
    newCodexCount: 0,
    newGalleryCount: 0,
    activeQuestCount: 0,
    newAchievementCount: 0,
    devConsoleVisible: false,

    setDialogue: (update) => set((s) => { Object.assign(s.dialogue, update); }),
    setChoice: (update) => set((s) => { Object.assign(s.choice, update); }),
    setScene: (update) => set((s) => { Object.assign(s.scene, update); }),
    setSoulStats: (stats) => set((s) => { s.soulStats = stats; }),
    setSoulArchetype: (archetype) => set((s) => { s.soulArchetype = archetype; }),

    setTypewriterProgress: (visibleText, isTyping) =>
      set((s) => { s.dialogue.visibleText = visibleText; s.dialogue.isTyping = isTyping; }),

    showHUD: () => set((s) => { s.hudVisible = true; }),
    hideHUD: () => set((s) => { s.hudVisible = false; }),

    openMenu: (menuId) => set((s) => { s.menuOpen = true; s.activeMenu = menuId; }),
    closeMenu: () => set((s) => { s.menuOpen = false; s.activeMenu = null; }),
    setActiveScreen: (screen) => set((s) => { s.activeScreen = screen; }),

    setSaveSlots: (slots) => set((s) => { s.saveSlots = slots; }),

    updateSettings: (partial) => set((s) => { Object.assign(s.settings, partial); }),

    addNotification: (message, type) => set((s) => {
      s.notifications.push({
        id: `notif_${Date.now()}`,
        message, type,
        timestamp: Date.now(),
      });
    }),

    dismissNotification: (id) => set((s) => {
      s.notifications = s.notifications.filter((n) => n.id !== id);
    }),

    setNewCodexCount: (n) => set((s) => { s.newCodexCount = n; }),
    setNewGalleryCount: (n) => set((s) => { s.newGalleryCount = n; }),
    setActiveQuestCount: (n) => set((s) => { s.activeQuestCount = n; }),
    setNewAchievementCount: (n) => set((s) => { s.newAchievementCount = n; }),
    toggleDevConsole: () => set((s) => { s.devConsoleVisible = !s.devConsoleVisible; }),
  }))
);
