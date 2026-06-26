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
import MainMenuScreen from './ui/screens/MainMenuScreen';
import GameScreen from './ui/screens/GameScreen';
import LoadingScreen from './ui/screens/LoadingScreen';

export default function App(): React.ReactElement {
  const activeScreen = useGameStore((s) => s.activeScreen);
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

  return (
    <div className="soul-architect-root" style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>
      {activeScreen === 'loading'   && <LoadingScreen />}
      {activeScreen === 'main-menu' && <MainMenuScreen />}
      {activeScreen === 'game'      && <GameScreen />}
    </div>
  );
}
