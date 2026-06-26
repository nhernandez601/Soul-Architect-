/**
 * MainMenuScreen — animated dark fantasy main menu.
 *
 * Features: parallax background, floating particles, glassmorphism panel,
 * gold-accented title, and animated menu items.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { engineBus } from '../../engine/core/EventBus';
import { registry } from '../../engine/core/ServiceRegistry';
import { useGameStore } from '../../engine/core/GameStore';

const MENU_ITEMS = [
  { id: 'new-game',  label: 'Begin Journey' },
  { id: 'continue',  label: 'Continue'      },
  { id: 'load',      label: 'Load'          },
  { id: 'gallery',   label: 'Gallery'       },
  { id: 'settings',  label: 'Settings'      },
  { id: 'quit',      label: 'Depart'        },
] as const;

type MenuItemId = (typeof MENU_ITEMS)[number]['id'];

export default function MainMenuScreen(): React.ReactElement {
  const [hoveredItem, setHoveredItem] = useState<MenuItemId | null>(null);
  const setActiveScreen = useGameStore((s) => s.setActiveScreen);
  const saveSlots = useGameStore((s) => s.saveSlots);
  const hasSave = saveSlots.length > 0;

  const handleSelect = (id: MenuItemId): void => {
    switch (id) {
      case 'new-game':
        setActiveScreen('game');
        engineBus.emit('scene:load_start', { sceneId: 'prologue_01' });
        break;
      case 'continue':
        if (hasSave) setActiveScreen('game');
        break;
      case 'load':
        engineBus.emit('ui:menu_open', { menuId: 'load' });
        break;
      case 'gallery':
        engineBus.emit('ui:menu_open', { menuId: 'gallery' });
        break;
      case 'settings':
        engineBus.emit('ui:menu_open', { menuId: 'settings' });
        break;
      case 'quit':
        if (typeof window !== 'undefined') window.close();
        break;
    }
  };

  return (
    <div
      className="relative w-full h-full flex items-center justify-start overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #050508 0%, #0a0a18 50%, #120820 100%)' }}
    >
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 70% 50%, rgba(80, 20, 120, 0.15) 0%, transparent 70%)',
        }}
      />

      {/* Floating particles */}
      <Particles />

      {/* Vertical golden line */}
      <motion.div
        className="absolute left-[38%] top-0 bottom-0 w-px"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(201,162,39,0.4), transparent)' }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      />

      {/* Menu Panel */}
      <motion.div
        className="relative ml-16 z-10"
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        {/* Title */}
        <div className="mb-12">
          <motion.p
            className="text-xs tracking-[0.6em] mb-2"
            style={{ color: 'var(--color-accent-dim)', fontFamily: 'var(--font-ui)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            A VISUAL NOVEL
          </motion.p>

          <motion.h1
            className="font-display text-7xl tracking-wider leading-none"
            style={{ color: 'var(--color-accent-gold)', fontFamily: 'var(--font-display)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            SOUL
            <br />
            ARCHITECT
          </motion.h1>

          <motion.div
            className="mt-4 h-px w-48"
            style={{ background: 'linear-gradient(90deg, var(--color-accent-gold), transparent)' }}
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          />
        </div>

        {/* Menu Items */}
        <nav className="flex flex-col gap-2">
          <AnimatePresence>
            {MENU_ITEMS.map((item, idx) => {
              const isDisabled = item.id === 'continue' && !hasSave;

              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + idx * 0.08, duration: 0.4 }}
                  onHoverStart={() => setHoveredItem(item.id)}
                  onHoverEnd={() => setHoveredItem(null)}
                  onClick={() => !isDisabled && handleSelect(item.id)}
                  disabled={isDisabled}
                  aria-label={item.label}
                  className="group relative text-left py-3 px-0 w-56 transition-all duration-300"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '1rem',
                    letterSpacing: '0.15em',
                    color: isDisabled
                      ? 'var(--color-text-dim)'
                      : hoveredItem === item.id
                        ? 'var(--color-accent-gold)'
                        : 'var(--color-text)',
                    opacity: isDisabled ? 0.4 : 1,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                  }}
                >
                  {/* Hover indicator */}
                  <motion.span
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-px"
                    style={{ background: 'var(--color-accent-gold)' }}
                    animate={{ width: hoveredItem === item.id ? 32 : 0 }}
                    transition={{ duration: 0.2 }}
                  />

                  <span style={{ marginLeft: hoveredItem === item.id ? '40px' : '0px', transition: 'margin 0.2s' }}>
                    {item.label.toUpperCase()}
                  </span>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </nav>

        {/* Version */}
        <motion.p
          className="mt-12 text-xs"
          style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-ui)', letterSpacing: '0.2em' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          V 0.1.0
        </motion.p>
      </motion.div>

      {/* Decorative right-side art placeholder */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, #050508, transparent 30%)',
          zIndex: 1,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating particles decoration
// ---------------------------------------------------------------------------

function Particles(): React.ReactElement {
  const items = Array.from({ length: 18 }, (_, i) => i);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {items.map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            background: i % 3 === 0 ? 'var(--color-accent-gold)' : 'rgba(180, 150, 255, 0.5)',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30 - Math.random() * 40, 0],
            opacity: [0.1, 0.5, 0.1],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 3 + Math.random() * 4,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: Math.random() * 3,
          }}
        />
      ))}
    </div>
  );
}
