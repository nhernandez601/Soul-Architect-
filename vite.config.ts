import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': resolve(__dirname, 'src/engine'),
      '@systems': resolve(__dirname, 'src/systems'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@scripting': resolve(__dirname, 'src/scripting'),
      '@types': resolve(__dirname, 'src/types'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@config': resolve(__dirname, 'src/config'),
      '@localization': resolve(__dirname, 'src/localization'),
      '@plugins': resolve(__dirname, 'src/plugins'),
      '@assets': resolve(__dirname, 'assets'),
      '@story': resolve(__dirname, 'story'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'pixi': ['pixi.js'],
          'react-vendor': ['react', 'react-dom'],
          'animation': ['gsap', 'framer-motion'],
          'audio': ['howler'],
        },
      },
    },
    target: 'es2022',
  },
  optimizeDeps: {
    include: ['pixi.js', 'gsap', 'howler', 'react', 'react-dom', 'framer-motion'],
  },
});
