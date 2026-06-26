/**
 * SoulMeter — compact display of all 12 soul attributes.
 * Glassmorphism panel, animated bars, color-coded per attribute.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../engine/core/GameStore';
import { SOUL_METER_DISPLAY } from '@types/soul';

export default function SoulMeter(): React.ReactElement {
  const soulStats = useGameStore((s) => s.soulStats);
  const archetype = useGameStore((s) => s.soulArchetype);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="select-none" style={{ userSelect: 'none' }}>
      {/* Toggle button */}
      <motion.button
        onClick={() => setExpanded((v) => !v)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="glass-gold px-3 py-1.5 text-xs tracking-widest mb-1"
        style={{
          fontFamily: 'var(--font-ui)',
          color: 'var(--color-accent-gold)',
          display: 'block',
          border: 'none',
          cursor: 'pointer',
          background: 'none',
          outline: 'none',
        }}
        aria-label="Toggle soul meter"
        aria-expanded={expanded}
      >
        {archetype.toUpperCase()} SOUL
      </motion.button>

      {/* Expanded soul bars */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="glass p-3 rounded-sm"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.2 }}
            style={{ width: 220, maxHeight: 420, overflowY: 'auto' }}
          >
            {SOUL_METER_DISPLAY.map((display) => {
              const value = soulStats[display.attribute] ?? 0;
              const displayValue = display.invertDisplay ? 100 - value : value;

              return (
                <div key={display.attribute} className="mb-2" title={display.description}>
                  {/* Label row */}
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span
                      className="text-xs tracking-wider"
                      style={{ fontFamily: 'var(--font-ui)', color: 'var(--color-text-dim)' }}
                    >
                      {display.label.toUpperCase()}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: display.color, fontFamily: 'var(--font-ui)' }}
                    >
                      {Math.round(value)}
                    </span>
                  </div>

                  {/* Bar */}
                  <div
                    className="w-full rounded-full overflow-hidden"
                    style={{ height: 3, background: 'var(--color-muted)' }}
                  >
                    <motion.div
                      className="h-full rounded-full soul-meter-bar"
                      style={{ background: display.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${displayValue}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
