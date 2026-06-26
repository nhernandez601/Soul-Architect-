import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { registry } from '../../engine/core/ServiceRegistry';
import type { QuestSystem } from '../../systems/quest/QuestSystem';
import type { Quest, QuestObjective } from '@t/save';

type Filter = 'active' | 'completed' | 'failed';

function ObjectiveRow({ obj }: { obj: QuestObjective }) {
  return (
    <div className={`flex items-start gap-3 py-1.5 ${obj.completed ? 'opacity-50' : ''}`}>
      <div className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center ${
        obj.completed ? 'border-gold/50 bg-gold/20' : 'border-white/30'
      }`}>
        {obj.completed && <span className="text-gold text-xs">✓</span>}
      </div>
      <div>
        <p className={`text-sm ${obj.completed ? 'line-through text-white/40' : 'text-white/80'}`}>
          {obj.description}
        </p>
      </div>
    </div>
  );
}

export function QuestLogScreen() {
  const questSystem = registry.get<QuestSystem>('quest');
  const [filter, setFilter] = useState<Filter>('active');
  const [selected, setSelected] = useState<Quest | null>(null);

  const quests = useMemo(() => {
    if (filter === 'active') return questSystem.getActive();
    if (filter === 'completed') return questSystem.getCompleted();
    return questSystem.getFailed();
  }, [filter]);

  const filters: Filter[] = ['active', 'completed', 'failed'];

  return (
    <div className="flex h-full bg-void/95">
      <div className="w-72 border-r border-gold/20 flex flex-col">
        <div className="p-4 border-b border-gold/20">
          <h2 className="font-display text-gold text-xl mb-3">Quest Log</h2>
          <div className="flex gap-1">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-1 rounded text-xs capitalize transition-colors ${
                  filter === f ? 'bg-gold/20 text-gold' : 'text-white/40 hover:text-white/60'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {quests.map((q) => (
            <button
              key={q.id}
              onClick={() => setSelected(q)}
              className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors ${
                selected?.id === q.id ? 'bg-gold/10' : 'hover:bg-white/5'
              }`}
            >
              <p className={`text-sm font-medium ${selected?.id === q.id ? 'text-gold' : 'text-white/80'}`}>
                {q.title}
              </p>
              <p className="text-white/35 text-xs mt-0.5 line-clamp-2">{q.description}</p>
              {filter === 'active' && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold/50"
                      style={{
                        width: `${(q.objectives.filter((o) => o.completed).length / Math.max(q.objectives.length, 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-white/30 text-xs">
                    {q.objectives.filter((o) => o.completed).length}/{q.objectives.length}
                  </span>
                </div>
              )}
            </button>
          ))}
          {quests.length === 0 && (
            <p className="text-white/25 text-sm p-6 text-center">No {filter} quests</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <h3 className="font-display text-2xl text-white mb-2">{selected.title}</h3>
              <p className="text-white/60 text-sm leading-relaxed mb-6">{selected.description}</p>
              <h4 className="text-xs uppercase tracking-widest text-gold/50 mb-3">Objectives</h4>
              <div className="space-y-1 mb-6">
                {selected.objectives.map((obj) => (
                  <ObjectiveRow key={obj.id} obj={obj} />
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-center h-64 text-white/20 text-sm">
              Select a quest to view details
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
