import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { registry } from '../../engine/core/ServiceRegistry';
import type { CodexSystem, CodexEntry } from '../../systems/codex/CodexSystem';

const CATEGORIES = ['world', 'character', 'location', 'concept', 'artifact', 'event', 'creature', 'philosophy'] as const;

export function CodexScreen() {
  const codex = registry.get<CodexSystem>('codex');
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CodexEntry | null>(null);

  const entries = useMemo(() => {
    const all = codex.getUnlocked();
    return all.filter((e) => {
      const matchCat = category === 'all' || e.category === category;
      const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.summary.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [category, search]);

  return (
    <div className="flex h-full bg-void/95">
      {/* Sidebar */}
      <div className="w-64 border-r border-gold/20 flex flex-col">
        <div className="p-4 border-b border-gold/20">
          <h2 className="font-display text-gold text-xl mb-3">Codex</h2>
          <input
            className="w-full bg-abyss border border-gold/30 rounded px-3 py-1.5 text-sm text-white/80 placeholder-white/30 focus:outline-none focus:border-gold/60"
            placeholder="Search entries…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="p-2 border-b border-gold/10">
          {(['all', ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`w-full text-left px-3 py-1.5 rounded text-sm capitalize transition-colors ${
                category === cat
                  ? 'bg-gold/20 text-gold'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {entries.map((e) => (
            <button
              key={e.id}
              onClick={() => { setSelected(e); codex.markRead(e.id); }}
              className={`w-full text-left px-3 py-2 rounded mb-1 transition-colors group ${
                selected?.id === e.id ? 'bg-gold/20' : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                {e.isNew && (
                  <span className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
                )}
                <span className={`text-sm ${selected?.id === e.id ? 'text-gold' : 'text-white/70 group-hover:text-white/90'}`}>
                  {e.title}
                </span>
              </div>
            </button>
          ))}
          {entries.length === 0 && (
            <p className="text-white/30 text-sm px-3 py-4 text-center">No entries found</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex items-start gap-4 mb-6">
                {selected.iconPath && (
                  <img src={selected.iconPath} alt="" className="w-16 h-16 object-contain opacity-80" />
                )}
                <div>
                  <span className="text-xs uppercase tracking-widest text-gold/60 mb-1 block">{selected.category}</span>
                  <h3 className="font-display text-2xl text-white">{selected.title}</h3>
                </div>
              </div>
              <p className="text-white/60 text-sm mb-6 leading-relaxed italic border-l-2 border-gold/30 pl-4">
                {selected.summary}
              </p>
              <div className="text-white/80 text-sm leading-7 whitespace-pre-wrap font-body">
                {selected.fullContent}
              </div>
              {selected.relatedEntries.length > 0 && (
                <div className="mt-8 pt-4 border-t border-gold/20">
                  <p className="text-xs uppercase tracking-widest text-gold/50 mb-2">See Also</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.relatedEntries.map((rid) => (
                      <button
                        key={rid}
                        onClick={() => {
                          const rel = codex.getEntry(rid);
                          if (rel) { setSelected(rel); codex.markRead(rid); }
                        }}
                        className="px-3 py-1 bg-gold/10 border border-gold/20 rounded text-gold/70 text-xs hover:bg-gold/20 transition-colors"
                      >
                        {rid}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center h-64 text-white/20 text-sm"
            >
              Select an entry to read
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
