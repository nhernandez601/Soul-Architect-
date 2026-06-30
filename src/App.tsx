/**
 * App — root React component.
 * Boots the engine on mount and renders the appropriate screen
 * based on the Zustand game store's activeScreen value.
 */

import React, { useEffect, useRef } from 'react';
import { engine } from './engine/core/Engine';
import { defaultEngineConfig } from './config/defaultConfig';
import { initStoreSync } from './engine/core/StoreSync';
import { useGameStore } from './engine/core/GameStore';
import { NotificationToast } from './ui/components/NotificationToast';
import { PauseMenu } from './ui/components/PauseMenu';
import { ScreenTransition, VFXOverlay } from './ui/components/ScreenTransition';
import { EndingScreen } from './ui/screens/EndingScreen';
import MainMenuScreen from './ui/screens/MainMenuScreen';
import GameScreen from './ui/screens/GameScreen';
import LoadingScreen from './ui/screens/LoadingScreen';
import { CodexScreen } from './ui/screens/CodexScreen';
import { JournalScreen } from './ui/screens/JournalScreen';
import { GalleryScreen } from './ui/screens/GalleryScreen';
import { QuestLogScreen } from './ui/screens/QuestLogScreen';
import { SaveLoadScreen } from './ui/screens/SaveLoadScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { AchievementScreen } from './ui/screens/AchievementScreen';

export default function App(): React.ReactElement {
  const activeScreen = useGameStore((s) => s.activeScreen);
  const menuOpen = useGameStore((s) => s.menuOpen);
  const activeMenu = useGameStore((s) => s.activeMenu);
  const { closeMenu } = useGameStore.getState();
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    initStoreSync();

    engine.boot(defaultEngineConfig).then(() => {
      engine.start();
    }).catch((err: unknown) => {
      console.error('[App] Engine boot failed:', err);
    });

    return () => {
      void engine.shutdown();
    };
  }, []);

  // Overlay screens — render above the game without navigating away
  const overlayScreen = menuOpen ? activeMenu : null;

  return (
    <div className="soul-architect-root" style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>
      {/* Base screens */}
      {activeScreen === 'loading'   && <LoadingScreen />}
      {activeScreen === 'main-menu' && <MainMenuScreen />}
      {activeScreen === 'game'      && <GameScreen />}

      {/* Pause menu overlay (shown over game) */}
      {activeScreen === 'game' && (
        <PauseMenu visible={menuOpen && activeMenu === 'main'} />
      )}

      {/* Full-screen overlay menus */}
      {overlayScreen && overlayScreen !== 'main' && (
        <div className="fixed inset-0 z-30 flex flex-col" style={{ background: '#000' }}>
          <div className="flex-1 overflow-hidden">
            {overlayScreen === 'codex'       && <CodexScreen />}
            {overlayScreen === 'journal'     && <JournalScreen />}
            {overlayScreen === 'gallery'     && <GalleryScreen />}
            {overlayScreen === 'quest'       && <QuestLogScreen />}
            {overlayScreen === 'save'        && <SaveLoadScreen mode="save" onClose={closeMenu} />}
            {overlayScreen === 'load'        && <SaveLoadScreen mode="load" onClose={closeMenu} />}
            {overlayScreen === 'settings'    && <SettingsScreen />}
            {overlayScreen === 'achievement' && <AchievementScreen />}
          </div>
          {overlayScreen !== 'save' && overlayScreen !== 'load' && (
            <div className="flex justify-end px-6 py-3 border-t border-gold/10">
              <button
                onClick={closeMenu}
                className="px-4 py-1.5 text-white/40 hover:text-white/80 text-sm transition-colors"
              >
                ✕ Close
              </button>
            </div>
          )}
        </div>
      )}

      {/* Phase 3 — Ending screen (full takeover) */}
      {activeScreen === 'ending' && <EndingScreen />}

      {/* Phase 3 — Screen transition overlay (z-50, above everything except ending) */}
      <ScreenTransition />

      {/* Phase 3 — CSS VFX (vignette + film grain) */}
      <VFXOverlay />

      {/* Global notification toasts — always on top */}
      <NotificationToast />
    </div>
  );
}
