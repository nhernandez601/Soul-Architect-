import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../engine/core/GameStore';
import { engine } from '../../engine/core/Engine';

const MENU_ITEMS = [
  { id: 'resume',   label: 'Resume',       action: 'resume' },
  { id: 'save',     label: 'Save',         action: 'save' },
  { id: 'load',     label: 'Load',         action: 'load' },
  { id: 'settings', label: 'Settings',     action: 'settings' },
  { id: 'gallery',  label: 'Gallery',      action: 'gallery' },
  { id: 'main',     label: 'Main Menu',    action: 'main-menu' },
] as const;

interface Props {
  visible: boolean;
}

export function PauseMenu({ visible }: Props) {
  const { closeMenu, setActiveScreen, openMenu } = useGameStore();

  const handleAction = (action: string) => {
    switch (action) {
      case 'resume':
        closeMenu();
        engine.resume();
        break;
      case 'save':
        openMenu('save');
        break;
      case 'load':
        openMenu('load');
        break;
      case 'settings':
        openMenu('settings');
        break;
      case 'gallery':
        openMenu('gallery');
        break;
      case 'main-menu':
        closeMenu();
        engine.pause();
        setActiveScreen('main-menu');
        break;
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeMenu}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="glass-gold rounded-2xl p-8 w-72 flex flex-col items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-gold text-2xl mb-5 tracking-wide">Paused</h2>

            {MENU_ITEMS.map((item, i) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 + i * 0.04 }}
                onClick={() => handleAction(item.action)}
                className={`w-full py-2.5 rounded text-sm font-medium transition-all ${
                  item.id === 'main'
                    ? 'text-white/35 hover:text-white/70 mt-2'
                    : item.id === 'resume'
                    ? 'bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30'
                    : 'text-white/65 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </motion.button>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
