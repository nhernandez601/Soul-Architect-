/**
 * HUD — in-game heads-up display.
 * Shows chapter title and quick-action buttons (menu, save, log).
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../engine/core/GameStore';
import { engineBus } from '../../engine/core/EventBus';

export default function HUD(): React.ReactElement {
  const { chapterTitle } = useGameStore((s) => ({
    chapterTitle: s.scene.sceneTitle,
  }));

  const openMenu = (): void => engineBus.emit('ui:menu_open', { menuId: 'pause' });
  const quickSave = (): void => engineBus.emit('quicksave:triggered');
  const openLog = (): void => engineBus.emit('ui:menu_open', { menuId: 'log' });

  return (
    <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-4 pointer-events-none">
      {/* Chapter title */}
      <motion.div
        className="glass px-4 py-2 pointer-events-none"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ borderBottom: '1px solid var(--color-accent-dim)' }}
      >
        <p
          className="text-xs tracking-widest"
          style={{ fontFamily: 'var(--font-ui)', color: 'var(--color-text-dim)' }}
        >
          {chapterTitle || 'PROLOGUE'}
        </p>
      </motion.div>

      {/* Quick action buttons */}
      <div className="flex gap-2 pointer-events-auto">
        {[
          { label: 'SAVE', action: quickSave },
          { label: 'LOG',  action: openLog   },
          { label: 'MENU', action: openMenu  },
        ].map(({ label, action }) => (
          <motion.button
            key={label}
            onClick={action}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="glass px-3 py-1.5 text-xs tracking-widest"
            style={{
              fontFamily: 'var(--font-ui)',
              color: 'var(--color-text-dim)',
              cursor: 'pointer',
              border: 'none',
              background: 'none',
              outline: 'none',
            }}
            aria-label={label}
          >
            {label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
