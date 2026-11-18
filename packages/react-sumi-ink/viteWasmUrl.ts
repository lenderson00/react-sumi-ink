import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

const VIRTUAL = 'virtual:sumi-ink-wasm-url';
const RESOLVED = '\0' + VIRTUAL;

export function inkWasmUrlPlugin(): Plugin {
  const wasmFile = resolve(import.meta.dirname, 'wasm/pkg/sumi_ink_sim_bg.wasm');
  return {
    name: 'sumi-ink-wasm-url',
    resolveId(id) {
      if (id === VIRTUAL) return RESOLVED;
    },
    load(id) {
      if (id !== RESOLVED) return;
      const source = readFileSync(wasmFile);
      const ref = this.emitFile({ type: 'asset', name: 'sumi_ink_sim_bg.wasm', source });
      return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
    },
  };
}