/**
 * GameScreen — the main in-game canvas view.
 * Mounts the PixiJS renderer and overlays the React UI layer.
 */

import React, { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../engine/core/GameStore';
import DialogueBox from '../components/DialogueBox';
import ChoicePanel from '../components/ChoicePanel';
import SoulMeter from '../components/SoulMeter';
import HUD from '../components/HUD';

export default function GameScreen(): React.ReactElement {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const hudVisible = useGameStore((s) => s.hudVisible);

  useEffect(() => {
    if (!canvasRef.current || appRef.current) return;

    const app = new Application();

    app.init({
      width: 1920,
      height: 1080,
      backgroundColor: 0x000000,
      antialias: true,
      resolution: window.devicePixelRatio ?? 1,
      autoDensity: true,
    }).then(() => {
      if (!canvasRef.current) return;
      canvasRef.current.appendChild(app.canvas);

      // Scale canvas to fit window
      const resize = (): void => {
        const ratio = 1920 / 1080;
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const scale = winW / winH > ratio ? winH / 1080 : winW / 1920;
        app.canvas.style.width = `${1920 * scale}px`;
        app.canvas.style.height = `${1080 * scale}px`;
      };

      resize();
      window.addEventListener('resize', resize);
      appRef.current = app;
    });

    return () => {
      appRef.current?.destroy(true);
      appRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden"
         style={{ background: '#000' }}>

      {/* PixiJS canvas container */}
      <div ref={canvasRef} className="absolute inset-0 flex items-center justify-center" />

      {/* React UI overlay */}
      <AnimatePresence>
        {hudVisible && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* HUD (chapter info, quick buttons) */}
            <HUD />

            {/* Soul meter (top right) */}
            <div className="absolute top-4 right-4 pointer-events-auto">
              <SoulMeter />
            </div>

            {/* Dialogue box (bottom) */}
            <div className="absolute bottom-0 left-0 right-0 pointer-events-auto">
              <DialogueBox />
            </div>

            {/* Choice panel (above dialogue) */}
            <div className="absolute bottom-56 left-1/2 -translate-x-1/2 w-full max-w-2xl px-8 pointer-events-auto">
              <ChoicePanel />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
