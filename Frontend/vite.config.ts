import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// SECURITY: Inject a Content-Security-Policy into the PRODUCTION build only.
// `apply: 'build'` skips the dev server, so Vite's HMR (inline scripts, eval, ws://)
// keeps working in development. The built index.html references only external, same-origin
// (tagfusion.local) JS/CSS — so 'script-src self' needs no inline allowance. 'unsafe-inline'
// is required for style only (HeroUI / Tailwind / Framer Motion inject inline styles).
// SICHERHEIT: CSP nur in den Produktions-Build injizieren — Dev/HMR bleibt unberührt.
const cspPlugin: Plugin = {
  name: 'tagfusion-csp',
  apply: 'build',
  transformIndexHtml() {
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://thumbs.tagfusion.local",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'none'",
    ].join('; ')
    return [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
        injectTo: 'head-prepend',
      },
    ]
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cspPlugin],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/types/**']
    }
  },
  optimizeDeps: {
    include: ['lucide-react', '@heroui/react'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Oxc ist der Default-Minifier in Vite — 30-90x schneller als Terser
    target: 'esnext',
    rollupOptions: {
      output: {
        // Object-form manualChunks lets Rollup own the rest of the chunk graph and
        // guarantees React is loaded exactly once. (A previous function-form split
        // caused @base-ui-components/react to pick up an undefined React instance.)
        manualChunks: {
          vendor: ['react', 'react-dom'],
          motion: ['framer-motion'],
          heroui: ['@heroui/react'],
          'base-ui': ['@base-ui-components/react'],
          virtuoso: ['react-virtuoso'],
          icons: ['lucide-react'],
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          state: ['zustand'],
        },
      },
    },
  },
})

