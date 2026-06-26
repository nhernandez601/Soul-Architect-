import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        void:     '#050508',
        abyss:    '#0a0a12',
        dark:     '#12121e',
        deep:     '#1a1a2e',
        mid:      '#252545',
        muted:    '#3a3a6e',
        gold:     '#c9a227',
        'gold-dim':'#8b7022',
        'gold-light':'#f0d060',
        ivory:    '#e8e0d0',
        soul: {
          hope:       '#FFD700',
          faith:      '#C0ABFF',
          fear:       '#FF4444',
          love:       '#FF69B4',
          knowledge:  '#4FC3F7',
          compassion: '#81C784',
          pride:      '#FF8C00',
          regret:     '#9E9E9E',
          memory:     '#BA68C8',
          purpose:    '#FFF176',
          light:      '#FFFDE7',
          shadow:     '#263238',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'Playfair Display', 'serif'],
        body:    ['EB Garamond', 'Georgia', 'serif'],
        ui:      ['Raleway', 'Inter', 'sans-serif'],
        mono:    ['Fira Code', 'Courier New', 'monospace'],
      },
      animation: {
        'float':       'float 3s ease-in-out infinite',
        'pulse-gold':  'pulse-gold 2s ease-in-out infinite',
        'fade-in':     'fade-in 0.5s ease forwards',
        'slide-up':    'slide-up 0.4s ease forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(201,162,39,0.3)' },
          '50%':      { boxShadow: '0 0 20px rgba(201,162,39,0.6)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backdropBlur: {
        glass: '12px',
        'glass-heavy': '24px',
      },
    },
  },
  plugins: [],
};

export default config;
