/**
 * ScreenTransition — fullscreen overlay for scene transitions.
 *
 * Renders an animated overlay driven by TransitionManager events.
 * Supports fade, flash, and iris-in/out styles.
 * The overlay sits above all game content at z-50.
 */

import React, { useEffect, useRef, useState } from 'react';
import { engineBus } from '../../engine/core/EventBus';

type TransitionPhase = 'idle' | 'fading-out' | 'held' | 'fading-in';
type TransitionStyle  = 'fade' | 'flash' | 'iris';

interface TransitionState {
  phase: TransitionPhase;
  style: TransitionStyle;
  color: string;
  durationMs: number;
}

function colorToCSS(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export function ScreenTransition() {
  const [ts, setTs] = useState<TransitionState>({
    phase: 'idle',
    style: 'fade',
    color: '#000000',
    durationMs: 600,
  });
  const opacityRef = useRef(0);

  useEffect(() => {
    const unsubStart = engineBus.on('transition:start', ({ style, durationMs, color }) => {
      const cssColor = color !== undefined ? colorToCSS(color) : '#000000';
      setTs({ phase: 'fading-out', style, color: cssColor, durationMs });
      opacityRef.current = 0;
    });

    const unsubMid = engineBus.on('transition:midpoint', () => {
      setTs((prev) => ({ ...prev, phase: 'fading-in' }));
    });

    const unsubEnd = engineBus.on('transition:complete', () => {
      setTs((prev) => ({ ...prev, phase: 'idle' }));
    });

    return () => {
      unsubStart();
      unsubMid();
      unsubEnd();
    };
  }, []);

  if (ts.phase === 'idle') return null;

  const isFadingOut = ts.phase === 'fading-out' || ts.phase === 'held';
  const isFadingIn  = ts.phase === 'fading-in';

  if (ts.style === 'iris') {
    return (
      <div
        className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
        style={{ background: ts.color }}
      >
        <div
          className="rounded-full"
          style={{
            background: 'transparent',
            boxShadow: `0 0 0 ${isFadingOut ? '0px' : '200vmax'} ${ts.color}`,
            transition: `box-shadow ${ts.durationMs}ms ease-in-out`,
            width: 4,
            height: 4,
          }}
        />
      </div>
    );
  }

  // Fade / flash
  const targetOpacity = isFadingIn ? 0 : 1;
  const transition = ts.style === 'flash'
    ? `opacity ${ts.durationMs * 0.15}ms ease-out`
    : `opacity ${ts.durationMs}ms ease-in-out`;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none"
      style={{
        background: ts.color,
        opacity: targetOpacity,
        transition,
      }}
    />
  );
}

/**
 * VFXOverlay — CSS-based film grain and vignette rendered in React.
 *
 * These CSS effects complement the PixiJS canvas VFX managed by
 * PostProcessingManager. The grain seed is updated each frame via
 * CSS custom property --grain-seed set by PostProcessingManager.
 */
export function VFXOverlay() {
  return (
    <div className="fixed inset-0 z-10 pointer-events-none overflow-hidden">
      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.65) 100%)',
        }}
      />
      {/* Film grain — CSS noise via SVG filter */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}
