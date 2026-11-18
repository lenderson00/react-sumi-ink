import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { inkWasmUrlPlugin } from './viteWasmUrl';

export default defineConfig({
  plugins: [react(), inkWasmUrlPlugin()],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'sumi-ink-sim'],
    },
    sourcemap: true,
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
  assetsInclude: ['**/*.wasm'],
});