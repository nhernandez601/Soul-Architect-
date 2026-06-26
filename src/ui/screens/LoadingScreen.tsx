/**
 * LoadingScreen — displayed during asset preloading and engine boot.
 */

import React from 'react';
import { motion } from 'framer-motion';

export default function LoadingScreen(): React.ReactElement {
  return (
    <div className="fixed inset-0 bg-void flex flex-col items-center justify-center"
         style={{ background: 'var(--color-void)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="text-center"
      >
        <h1
          className="font-display text-5xl tracking-widest mb-4"
          style={{ color: 'var(--color-accent-gold)', fontFamily: 'var(--font-display)' }}
        >
          SOUL ARCHITECT
        </h1>
        <p style={{ color: 'var(--color-text-dim)', letterSpacing: '0.3em', fontSize: '0.85rem' }}>
          LOADING
        </p>

        {/* Animated loader bar */}
        <div className="mt-8 w-64 h-px mx-auto" style={{ background: 'var(--color-muted)' }}>
          <motion.div
            className="h-full"
            style={{ background: 'var(--color-accent-gold)', originX: 0 }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 2, ease: 'easeInOut' }}
          />
        </div>

        {/* Decorative particles */}
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              background: 'var(--color-accent-gold)',
              left: `${15 + i * 14}%`,
              top: `${40 + (i % 2 === 0 ? 5 : -5)}%`,
              opacity: 0.4,
            }}
            animate={{ y: [0, -12, 0], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </motion.div>
    </div>
  );
}
