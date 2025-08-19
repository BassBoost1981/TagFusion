import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    target: 'es2015', // Lower target for better compatibility
    minify: false, // Disable minification for debugging
    sourcemap: true, // Enable source maps
    rollupOptions: {
      input: resolve(__dirname, 'src/renderer/index.html'),
      output: {
        format: 'iife', // Use IIFE format for better Electron compatibility
        entryFileNames: 'assets/bundle.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        inlineDynamicImports: true // Bundle everything into one file
      }
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
      '@/components': resolve(__dirname, 'src/renderer/src/components'),
      '@/ui': resolve(__dirname, 'src/renderer/src/components/ui'),
      '@/lib': resolve(__dirname, 'src/renderer/src/lib'),
      '@/services': resolve(__dirname, 'src/renderer/src/services'),
      '@/repositories': resolve(__dirname, 'src/repositories'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/utils': resolve(__dirname, 'src/utils'),
    },
  },
  server: {
    port: 3000,
  },
});