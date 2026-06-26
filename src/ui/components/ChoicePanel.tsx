/**
 * ChoicePanel — animated choice buttons displayed above the dialogue box.
 * Each button fires a choice selection through the ChoiceManager.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../engine/core/GameStore';
import { registry } from '../../engine/core/ServiceRegistry';

export default function ChoicePanel(): React.ReactElement {
  const { visible, choices, nodeId, prompt } = useGameStore((s) => s.choice);

  const handleSelect = (choiceId: string, index: number): void => {
    const choiceManager = registry.get<import('../../engine/choice/ChoiceManager').ChoiceManager>('choice');
    choiceManager.confirmSelection(nodeId, index, choiceId);
  };

  return (
    <AnimatePresence>
      {visible && choices.length > 0 && (
        <div className="flex flex-col gap-3">
          {/* Optional prompt */}
          {prompt && (
            <motion.p
              className="text-center text-sm tracking-wider mb-2"
              style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-ui)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {prompt}
            </motion.p>
          )}

          {choices.map((choice, idx) => (
            <motion.button
              key={choice.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ delay: idx * 0.08, duration: 0.3 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => !choice.disabled && handleSelect(choice.id, idx)}
              disabled={choice.disabled}
              aria-label={choice.text}
              aria-disabled={choice.disabled}
              className="glass-gold text-left px-6 py-4 transition-all duration-200 relative overflow-hidden"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
                lineHeight: '1.5',
                color: choice.disabled ? 'var(--color-text-dim)' : 'var(--color-text)',
                cursor: choice.disabled ? 'not-allowed' : 'pointer',
                opacity: choice.disabled ? 0.5 : 1,
                border: 'none',
                background: choice.highlight === 'gold'
                  ? 'rgba(201, 162, 39, 0.12)'
                  : choice.highlight === 'red'
                    ? 'rgba(255, 68, 68, 0.08)'
                    : 'var(--glass-bg)',
                outline: 'none',
              }}
            >
              {/* Left accent line */}
              <motion.div
                className="absolute left-0 top-0 bottom-0 w-0.5"
                initial={{ scaleY: 0 }}
                whileHover={{ scaleY: 1 }}
                style={{ background: 'var(--color-accent-gold)', originY: 0.5 }}
                transition={{ duration: 0.15 }}
              />

              {/* Choice number */}
              <span
                className="absolute top-4 left-3 text-xs"
                style={{ color: 'var(--color-accent-dim)', fontFamily: 'var(--font-ui)' }}
              >
                {idx + 1}
              </span>

              <span style={{ paddingLeft: '1rem' }}>{choice.text}</span>

              {/* Disabled reason tooltip */}
              {choice.disabled && choice.disabledReason && (
                <span
                  className="block mt-1 text-xs"
                  style={{ color: 'var(--color-text-dim)' }}
                >
                  {choice.disabledReason}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
