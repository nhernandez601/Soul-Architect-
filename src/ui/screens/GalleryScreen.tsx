import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { registry } from '../../engine/core/ServiceRegistry';
import type { GallerySystem, CGItem, MusicItem } from '../../systems/gallery/GallerySystem';

type Tab = 'cg' | 'music' | 'scene';

export function GalleryScreen() {
  const gallery = registry.get<GallerySystem>('gallery');
  const [tab, setTab] = useState<Tab>('cg');
  const [lightbox, setLightbox] = useState<CGItem | null>(null);
  const [playing, setPlaying] = useState<MusicItem | null>(null);

  const cgs = gallery.getUnlockedCGs();
  const music = gallery.getUnlockedMusic();
  const scenes = gallery.getUnlockedScenes();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'cg', label: `CG Art (${cgs.length})` },
    { id: 'music', label: `Music (${music.length})` },
    { id: 'scene', label: `Scenes (${scenes.length})` },
  ];

  return (
    <div className="flex flex-col h-full bg-void/95">
      <div className="flex items-center gap-1 px-6 pt-6 pb-4 border-b border-gold/20">
        <h2 className="font-display text-gold text-xl mr-6">Gallery</h2>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded text-sm transition-colors ${
              tab === t.id ? 'bg-gold/20 text-gold' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'cg' && (
          <div className="grid grid-cols-3 gap-4">
            {cgs.map((cg) => (
              <motion.button
                key={cg.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => { setLightbox(cg); gallery.markSeen(cg.id); }}
                className="relative aspect-video bg-abyss rounded overflow-hidden border border-gold/20 hover:border-gold/50 transition-colors group"
              >
                <img src={cg.path} alt={cg.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                {gallery.isNew(cg.id) && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-gold text-void text-xs font-bold rounded">NEW</span>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-sm font-medium">{cg.title}</p>
                </div>
              </motion.button>
            ))}
            {gallery.getAllCGs().filter((c) => !gallery.isUnlockedCG(c.id)).map((cg) => (
              <div key={cg.id} className="aspect-video bg-abyss rounded border border-white/10 flex items-center justify-center">
                <span className="text-white/20 text-2xl">?</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'music' && (
          <div className="max-w-2xl space-y-2">
            {music.map((track) => (
              <button
                key={track.id}
                onClick={() => setPlaying(playing?.id === track.id ? null : track)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded border transition-colors text-left ${
                  playing?.id === track.id
                    ? 'bg-gold/15 border-gold/40'
                    : 'bg-abyss/50 border-white/10 hover:border-white/25'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  playing?.id === track.id ? 'bg-gold/30' : 'bg-white/10'
                }`}>
                  {playing?.id === track.id ? (
                    <span className="text-gold text-sm">❚❚</span>
                  ) : (
                    <span className="text-white/60 text-sm">▶</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/90 text-sm font-medium truncate">{track.title}</p>
                  <p className="text-white/40 text-xs">{track.composer} · {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, '0')}</p>
                </div>
                <span className="text-white/30 text-xs capitalize">{track.category}</span>
              </button>
            ))}
          </div>
        )}

        {tab === 'scene' && (
          <div className="max-w-2xl space-y-2">
            {scenes.map((scene) => (
              <div key={scene.id} className="flex items-center gap-4 px-4 py-3 bg-abyss/50 border border-white/10 rounded">
                <div className="flex-1">
                  <p className="text-white/90 text-sm font-medium">{scene.title}</p>
                  <p className="text-white/40 text-xs">Chapter {scene.chapter}</p>
                  <p className="text-white/55 text-xs mt-1">{scene.description}</p>
                </div>
                <button className="px-3 py-1.5 bg-gold/20 border border-gold/30 rounded text-gold text-xs hover:bg-gold/30 transition-colors">
                  Replay
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8"
            onClick={() => setLightbox(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="max-w-4xl max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={lightbox.path} alt={lightbox.title} className="max-w-full max-h-[80vh] object-contain rounded" />
              <p className="text-white/70 text-center mt-3 text-sm">{lightbox.title}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
