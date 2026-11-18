import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { inkWasmUrlPlugin } from './packages/react-sumi-ink/viteWasmUrl';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), inkWasmUrlPlugin()],
  resolve: {
    alias: {
      'react-sumi-ink': resolve(import.meta.dirname, 'packages/react-sumi-ink/src/index.ts'),
      'sumi-ink-sim': resolve(import.meta.dirname, 'packages/react-sumi-ink/wasm/pkg/sumi_ink_sim.js'),
    },
  },
  server: { port: 5198 },
  worker: { format: 'es' },
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
  include: ['react', 'react-dom', 'react/jsx-runtime'],
  },
});