import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { registry } from '../../engine/core/ServiceRegistry';
import type { JournalSystem, JournalEntry } from '../../systems/journal/JournalSystem';

export function JournalScreen() {
  const journal = registry.get<JournalSystem>('journal');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const entries = useMemo(() => {
    const all = journal.getAll();
    const filtered = filter === 'unread' ? all.filter((e) => e.isNew) : all;
    return filtered.filter((e) =>
      !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.content.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, filter]);

  const handleSelect = (e: JournalEntry) => {
    setSelected(e);
    journal.markRead(e.id);
  };

  return (
    <div className="flex h-full bg-void/95">
      <div className="w-72 border-r border-gold/20 flex flex-col">
        <div className="p-4 border-b border-gold/20">
          <h2 className="font-display text-gold text-xl mb-3">Journal</h2>
          <input
            className="w-full bg-abyss border border-gold/30 rounded px-3 py-1.5 text-sm text-white/80 placeholder-white/30 focus:outline-none focus:border-gold/60 mb-2"
            placeholder="Search journal…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-2">
            {(['all', 'unread'] as const).map((f) => (
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
          {entries.map((e) => (
            <button
              key={e.id}
              onClick={() => handleSelect(e)}
              className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors ${
                selected?.id === e.id ? 'bg-gold/10' : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                {e.isNew && <span className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />}
                <span className={`text-sm font-medium ${selected?.id === e.id ? 'text-gold' : 'text-white/80'}`}>
                  {e.title}
                </span>
              </div>
              <p className="text-white/35 text-xs line-clamp-2">{e.content}</p>
              <p className="text-white/25 text-xs mt-1">
                {new Date(e.timestamp).toLocaleDateString()}
              </p>
            </button>
          ))}
          {entries.length === 0 && (
            <p className="text-white/25 text-sm p-6 text-center">No entries</p>
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
              transition={{ duration: 0.2 }}
            >
              <div className="mb-2">
                <span className="text-xs uppercase tracking-widest text-gold/50">
                  {new Date(selected.timestamp).toLocaleString()}
                </span>
              </div>
              <h3 className="font-display text-2xl text-white mb-4">{selected.title}</h3>
              {selected.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {selected.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 bg-gold/10 border border-gold/20 rounded text-gold/60 text-xs">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="text-white/80 text-sm leading-7 font-body whitespace-pre-wrap">
                {selected.content}
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-center h-64 text-white/20 text-sm">
              Select an entry to read
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
