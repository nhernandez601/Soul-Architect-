import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { registry } from '../../engine/core/ServiceRegistry';
import type { SaveManager } from '../../engine/save/SaveManager';
import type { SaveSlotMeta } from '@t/save';

const SLOT_COUNT = 10;

interface Props {
  mode: 'save' | 'load';
  onClose: () => void;
}

function formatPlaytime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function SaveLoadScreen({ mode, onClose }: Props) {
  const saveManager = registry.get<SaveManager>('save');
  const [slots, setSlots] = useState<(SaveSlotMeta | null)[]>(Array(SLOT_COUNT).fill(null));
  const [busy, setBusy] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);

  const refresh = () => {
    const metas = saveManager.getAllSlotMetas();
    const arr: (SaveSlotMeta | null)[] = Array(SLOT_COUNT).fill(null);
    for (const meta of metas) {
      const idx = meta.slotId - 1; // slots are 1-indexed, array is 0-indexed
      if (idx >= 0 && idx < SLOT_COUNT) arr[idx] = meta;
    }
    setSlots(arr);
  };

  useEffect(() => { refresh(); }, []);

  const handleSave = async (index: number) => {
    const slotId = index + 1;
    if (slots[index] && confirm !== index) {
      setConfirm(index);
      return;
    }
    setBusy(index);
    setConfirm(null);
    await saveManager.save(slotId, 'manual');
    refresh();
    setBusy(null);
  };

  const handleLoad = async (index: number) => {
    if (!slots[index]) return;
    const slotId = index + 1;
    setBusy(index);
    await saveManager.load(slotId);
    setBusy(null);
    onClose();
  };

  const handleDelete = (index: number) => {
    saveManager.deleteSave(index + 1);
    refresh();
    setConfirm(null);
  };

  return (
    <div className="flex flex-col h-full bg-void/95">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gold/20">
        <h2 className="font-display text-gold text-xl">
          {mode === 'save' ? 'Save Game' : 'Load Game'}
        </h2>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/80 transition-colors text-sm"
        >
          ✕ Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-2">
          {slots.map((slot, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`flex items-center gap-4 p-4 rounded border transition-colors ${
                slot ? 'bg-abyss/60 border-white/15 hover:border-white/30' : 'bg-abyss/30 border-white/5'
              }`}
            >
              <div className="w-8 h-8 rounded bg-gold/10 flex items-center justify-center text-gold/60 text-sm font-display flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                {slot ? (
                  <>
                    <p className="text-white/90 text-sm font-medium truncate">{slot.chapterTitle || slot.sceneId}</p>
                    <p className="text-white/40 text-xs">
                      {formatPlaytime(slot.playtimeMs)} played · {new Date(slot.timestamp).toLocaleString()}
                    </p>
                    {slot.soulArchetype && (
                      <p className="text-gold/50 text-xs capitalize">{slot.soulArchetype}</p>
                    )}
                  </>
                ) : (
                  <p className="text-white/25 text-sm">Empty slot</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <AnimatePresence>
                  {confirm === i && mode === 'save' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1"
                    >
                      <span className="text-white/50 text-xs mr-1">Overwrite?</span>
                      <button
                        onClick={() => void handleSave(i)}
                        className="px-2 py-1 bg-gold/30 border border-gold/50 rounded text-gold text-xs"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirm(null)}
                        className="px-2 py-1 bg-white/10 rounded text-white/50 text-xs"
                      >
                        No
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                {mode === 'save' && (
                  <button
                    onClick={() => void handleSave(i)}
                    disabled={busy === i}
                    className="px-3 py-1.5 bg-gold/20 border border-gold/30 rounded text-gold text-xs hover:bg-gold/30 transition-colors disabled:opacity-50"
                  >
                    {busy === i ? '…' : 'Save'}
                  </button>
                )}
                {mode === 'load' && slot && (
                  <button
                    onClick={() => void handleLoad(i)}
                    disabled={busy === i}
                    className="px-3 py-1.5 bg-gold/20 border border-gold/30 rounded text-gold text-xs hover:bg-gold/30 transition-colors disabled:opacity-50"
                  >
                    {busy === i ? '…' : 'Load'}
                  </button>
                )}
                {slot && (
                  <button
                    onClick={() => handleDelete(i)}
                    className="px-2 py-1.5 text-white/25 hover:text-red-400 text-xs transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
