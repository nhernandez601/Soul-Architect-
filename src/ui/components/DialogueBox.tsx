/**
 * DialogueBox — the primary dialogue display panel.
 * Shows speaker name, typewriter text, and advance indicator.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../engine/core/GameStore';
import { engineBus } from '../../engine/core/EventBus';

export default function DialogueBox(): React.ReactElement {
  const { visible, speakerName, visibleText, isTyping, nodeId } = useGameStore((s) => s.dialogue);

  const handleAdvance = (): void => {
    engineBus.emit('input:action', { action: 'advance' });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={nodeId}
          className="glass dialogue-box"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.3 }}
          onClick={handleAdvance}
          role="log"
          aria-live="polite"
          aria-label="Dialogue"
          style={{
            borderTop: '1px solid var(--color-accent-dim)',
          }}
        >
          {/* Speaker name */}
          {speakerName && (
            <motion.div
              className="font-display text-sm tracking-widest mb-2"
              style={{
                color: 'var(--color-accent-gold)',
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.2em',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {speakerName.toUpperCase()}
            </motion.div>
          )}

          {/* Dialogue text */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1.1rem',
              lineHeight: '1.8',
              color: 'var(--color-text)',
              minHeight: '3.6rem',
            }}
          >
            {visibleText}
            {/* Blinking cursor while typing */}
            {isTyping && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                style={{ color: 'var(--color-accent-gold)' }}
              >
                ▌
              </motion.span>
            )}
          </p>

          {/* Advance indicator */}
          {!isTyping && (
            <motion.div
              className="absolute bottom-6 right-8"
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{ color: 'var(--color-accent-gold)', fontSize: '0.7rem' }}
            >
              ▼
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
