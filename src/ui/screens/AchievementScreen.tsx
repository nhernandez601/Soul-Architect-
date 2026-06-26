import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { registry } from '../../engine/core/ServiceRegistry';
import type { AchievementSystem } from '../../systems/achievement/AchievementSystem';

export function AchievementScreen() {
  const achSystem = registry.get<AchievementSystem>('achievement');
  const [showLocked, setShowLocked] = useState(true);

  const all = useMemo(() => achSystem.getAll(), []);
  const unlocked = useMemo(() => achSystem.getUnlocked(), []);
  const unlockedIds = new Set(unlocked.map((a) => a.id));

  const percent = achSystem.getCompletionPercent();

  const visible = showLocked ? all : all.filter((a) => unlockedIds.has(a.id));

  return (
    <div className="flex flex-col h-full bg-void/95 p-6">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="font-display text-gold text-2xl">Achievements</h2>
          <p className="text-white/40 text-sm mt-1">{unlocked.length}/{all.length} unlocked</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLocked(!showLocked)}
            className="px-3 py-1.5 bg-abyss border border-white/20 rounded text-xs text-white/60 hover:border-gold/40 transition-colors"
          >
            {showLocked ? 'Hide locked' : 'Show locked'}
          </button>
          <div className="text-right">
            <div className="text-gold font-display text-xl">{percent.toFixed(0)}%</div>
            <div className="w-32 h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
              <motion.div
                className="h-full bg-gold"
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          {visible.map((ach) => {
            const isUnlocked = unlockedIds.has(ach.id);
            return (
              <motion.div
                key={ach.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-start gap-4 p-4 rounded border transition-colors ${
                  isUnlocked
                    ? 'bg-gold/10 border-gold/30'
                    : 'bg-abyss/50 border-white/10 opacity-60'
                }`}
              >
                <div className={`w-12 h-12 rounded flex items-center justify-center flex-shrink-0 text-2xl ${
                  isUnlocked ? 'bg-gold/20' : 'bg-white/5'
                }`}>
                  {isUnlocked ? (ach.iconPath ? <img src={ach.iconPath} alt="" className="w-8 h-8 object-contain" /> : '★') : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-sm font-medium ${isUnlocked ? 'text-white' : 'text-white/50'}`}>
                      {ach.isSecret && !isUnlocked ? '???' : ach.title}
                    </p>
                  </div>
                  <p className="text-white/40 text-xs leading-relaxed">
                    {ach.isSecret && !isUnlocked ? 'Secret achievement' : ach.description}
                  </p>
                  {ach.maxProgress && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gold/60 transition-all"
                          style={{ width: `${((ach.progress ?? 0) / ach.maxProgress) * 100}%` }}
                        />
                      </div>
                      <span className="text-white/30 text-xs">{ach.progress ?? 0}/{ach.maxProgress}</span>
                    </div>
                  )}
                  {isUnlocked && ach.unlockedAt && (
                    <p className="text-white/25 text-xs mt-1">
                      {new Date(ach.unlockedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
