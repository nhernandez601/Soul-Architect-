/**
 * EndingScreen — full-screen ending reveal and credits.
 *
 * Shown when the player reaches a narrative ending. Displays the ending's
 * title, subtitle, flavour art, and a brief reflection text, then transitions
 * to a statistics summary before offering New Game+ or main menu options.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { registry } from '../../engine/core/ServiceRegistry';
import { useGameStore } from '../../engine/core/GameStore';
import type { EndingSystem, EndingRecord } from '../../systems/ending/EndingSystem';

type EndingPhase = 'art' | 'title' | 'stats' | 'options';

const PHASE_DELAYS: Record<EndingPhase, number> = {
  art:     0,
  title:   2200,
  stats:   6000,
  options: 9000,
};

export function EndingScreen() {
  const { setActiveScreen } = useGameStore();
  const endingSystem = registry.get<EndingSystem>('ending');

  const endingId = endingSystem.getCurrentEndingId();
  const record: EndingRecord | undefined = endingId
    ? endingSystem.getRecord(endingId)
    : undefined;

  const [phase, setPhase] = useState<EndingPhase>('art');
  const [skipped, setSkipped] = useState(false);

  const seen  = endingSystem.getSeenEndings().length;
  const total = endingSystem.getTotalEndingCount();
  const pct   = endingSystem.getCompletionPercent();
  const isNG  = endingSystem.isNGPlus();
  const playthrough = endingSystem.getPlaythroughNumber();

  useEffect(() => {
    if (skipped) return;

    const timers = Object.entries(PHASE_DELAYS)
      .filter(([, delay]) => delay > 0)
      .map(([p, delay]) =>
        setTimeout(() => setPhase(p as EndingPhase), delay)
      );

    return () => timers.forEach(clearTimeout);
  }, [skipped]);

  const skip = () => {
    setSkipped(true);
    setPhase('options');
  };

  const startNewGame = () => {
    // TODO: wire to NewGamePlusFlow component / route
    setActiveScreen('main-menu');
  };

  const goMainMenu = () => {
    setActiveScreen('main-menu');
  };

  const categoryColors: Record<string, string> = {
    true:    'text-gold',
    good:    'text-emerald-400',
    neutral: 'text-white/60',
    bad:     'text-red-400',
    secret:  'text-purple-400',
    joke:    'text-yellow-300',
  };

  const titleColor = record ? (categoryColors[record.category] ?? 'text-white') : 'text-white';

  return (
    <div
      className="fixed inset-0 z-40 bg-void flex flex-col items-center justify-center overflow-hidden"
      onClick={phase !== 'options' ? skip : undefined}
    >
      {/* Background art */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 3, ease: 'easeIn' }}
      >
        {record?.artPath ? (
          <img
            src={record.artPath}
            alt={record.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-void via-abyss to-void" />
        )}
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-void/60" />
      </motion.div>

      {/* Stars / particles overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-px h-px bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{ opacity: [0.1, 0.8, 0.1] }}
            transition={{
              duration: 2 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 4,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-xl w-full text-center px-8">
        <AnimatePresence mode="wait">
          {(phase === 'title' || phase === 'stats' || phase === 'options') && (
            <motion.div
              key="title-block"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="mb-10"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-white/30 mb-4">
                {isNG ? `Playthrough ${playthrough}` : 'Ending'}
              </p>
              <h1 className={`font-display text-5xl mb-3 ${titleColor}`}>
                {record?.title ?? 'The End'}
              </h1>
              {record?.subtitle && (
                <p className="text-white/50 text-lg font-body italic">
                  {record.subtitle}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
              className="mb-10 space-y-3"
            >
              <div className="h-px w-24 bg-gold/30 mx-auto mb-6" />
              <StatRow label="Endings Found" value={`${seen} / ${total}`} />
              <StatRow label="Completion" value={`${pct}%`} />
              <StatRow label="Remaining Paths" value={String(endingSystem.getUnseenNonSecret().length)} />
              <div className="mt-4 w-48 h-1 bg-white/10 rounded-full mx-auto overflow-hidden">
                <motion.div
                  className="h-full bg-gold"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1.5, delay: 0.5, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'options' && (
            <motion.div
              key="options"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center gap-4"
            >
              <button
                onClick={startNewGame}
                className="px-10 py-3 bg-gold/20 border border-gold/50 text-gold font-display tracking-wider hover:bg-gold/30 transition-colors rounded"
              >
                {isNG ? `New Game+ (Playthrough ${playthrough + 1})` : 'New Game+'}
              </button>
              <button
                onClick={goMainMenu}
                className="px-10 py-3 border border-white/20 text-white/50 hover:text-white/80 hover:border-white/40 transition-colors rounded text-sm"
              >
                Return to Main Menu
              </button>
              {!skipped && (
                <p className="text-white/20 text-xs mt-4">
                  Click anywhere to skip cinematic
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Skip hint (before options) */}
      {phase !== 'options' && (
        <p className="absolute bottom-8 text-white/20 text-xs tracking-widest">
          CLICK TO SKIP
        </p>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm px-4">
      <span className="text-white/35">{label}</span>
      <span className="text-white/70 font-medium">{value}</span>
    </div>
  );
}
