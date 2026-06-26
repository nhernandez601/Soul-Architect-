/**
 * StoreSync — bridges the engine event bus to the Zustand UI store.
 *
 * Runs once on engine boot and subscribes to all events that need to
 * be reflected in the UI.  Keeps the React UI decoupled from the engine.
 */

import { engineBus } from './EventBus';
import { useGameStore } from './GameStore';
import { registry } from './ServiceRegistry';
import { CHARACTER_IDS } from '@t/character';

export function initStoreSync(): void {
  const store = useGameStore.getState();

  // ---------------------------------------------------------------------------
  // Dialogue
  // ---------------------------------------------------------------------------

  engineBus.on('dialogue:line_start', ({ nodeId, speaker, text }) => {
    const speakerName = resolveDisplayName(speaker);
    store.setDialogue({
      visible: true,
      speaker,
      speakerName,
      text,
      visibleText: '',
      isTyping: true,
      nodeId,
    });
  });

  engineBus.on('dialogue:line_complete', () => {
    store.setDialogue({ isTyping: false });
  });

  engineBus.on('dialogue:typewriter_tick', ({ charIndex, total }) => {
    // This fires on every character — store updates the visible text length
    const currentText = useGameStore.getState().dialogue.text;
    const visibleText = [...currentText].slice(0, charIndex).join('');
    const isTyping = charIndex < total;
    store.setTypewriterProgress(visibleText, isTyping);
  });

  // ---------------------------------------------------------------------------
  // Choice
  // ---------------------------------------------------------------------------

  engineBus.on('choice:presented', ({ nodeId, count }) => {
    // The actual choices come from the SceneManager; this signals UI to show panel.
    // Full choice data is synced separately by ChoiceManager.
    void count;
    store.setChoice({ visible: true, nodeId });
  });

  engineBus.on('choice:selected', () => {
    store.setChoice({ visible: false, choices: [] });
  });

  // ---------------------------------------------------------------------------
  // Soul
  // ---------------------------------------------------------------------------

  engineBus.on('soul:state_snapshot', ({ state }) => {
    store.setSoulStats(state.stats);
    store.setSoulArchetype(state.archetype);
  });

  engineBus.on('soul:archetype_change', ({ newArchetype }) => {
    store.setSoulArchetype(newArchetype as import('@t/soul').SoulArchetype);
  });

  // ---------------------------------------------------------------------------
  // Scene
  // ---------------------------------------------------------------------------

  engineBus.on('scene:load_complete', ({ sceneId }) => {
    store.setScene({ sceneId });
  });

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  engineBus.on('ui:notification', ({ message, type }) => {
    store.addNotification(message, type);
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      const notifications = useGameStore.getState().notifications;
      const last = notifications[notifications.length - 1];
      if (last) store.dismissNotification(last.id);
    }, 4000);
  });

  engineBus.on('ui:menu_open', ({ menuId }) => {
    store.openMenu(menuId);
  });

  engineBus.on('ui:menu_close', () => {
    store.closeMenu();
  });

  // ---------------------------------------------------------------------------
  // Engine lifecycle
  // ---------------------------------------------------------------------------

  engineBus.on('engine:error', ({ message }) => {
    store.addNotification(`Engine error: ${message}`, 'error');
  });

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  engineBus.on('input:action', ({ action }) => {
    if (action === 'hide-ui') {
      const { hudVisible, showHUD, hideHUD } = useGameStore.getState();
      hudVisible ? hideHUD() : showHUD();
    }
    if (action === 'menu') {
      const { menuOpen, openMenu, closeMenu } = useGameStore.getState();
      menuOpen ? closeMenu() : openMenu('main');
    }
  });

  // ---------------------------------------------------------------------------
  // Phase 2 badge counts
  // ---------------------------------------------------------------------------

  engineBus.on('codex:unlocked', () => {
    try {
      const codex = registry.get<import('../../systems/codex/CodexSystem').CodexSystem>('codex');
      store.setNewCodexCount(codex.getNewCount());
    } catch { /* service not yet registered */ }
  });

  engineBus.on('gallery:cg_unlocked', () => {
    try {
      const gallery = registry.get<import('../../systems/gallery/GallerySystem').GallerySystem>('gallery');
      store.setNewGalleryCount(gallery.getNewCount());
    } catch { /* service not yet registered */ }
  });

  engineBus.on('quest:activated', () => {
    try {
      const quest = registry.get<import('../../systems/quest/QuestSystem').QuestSystem>('quest');
      store.setActiveQuestCount(quest.getActive().length);
    } catch { /* service not yet registered */ }
  });

  engineBus.on('achievement:unlocked', () => {
    const current = useGameStore.getState().newAchievementCount;
    store.setNewAchievementCount(current + 1);
    setTimeout(() => {
      store.setNewAchievementCount(Math.max(0, useGameStore.getState().newAchievementCount - 1));
    }, 10000);
  });
}

function resolveDisplayName(speaker: string | null): string {
  if (!speaker) return '';
  if (speaker === 'narrator') return '';

  const names: Record<string, string> = {
    seeker: 'The Seeker',
    voice: 'The Voice',
    light: 'Light',
    shadow: 'Shadow',
    watcher: 'The Watcher',
    aurelia: 'Aurelia',
    nyx: 'Nyx',
    seraphine: 'Seraphine',
    mira: 'Mira',
    echo: 'Echo',
    elian: 'Elian',
  };

  return names[speaker] ?? speaker;
}
