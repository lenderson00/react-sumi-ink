import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  InkStage,
  defaultInkConfig,
  inkPresets,
  type InkConfig,
  type InkMode,
  type InkPresetName,
  type InkQuality,
  type InkStageHandle,
} from 'react-sumi-ink';
import { useViewportStage } from '../lib/useViewportStage';
import { ControlPanel } from './ControlPanel';
import { Scene } from './Scene';

const STORE_KEY = 'ink-playground-v1';

interface Settings {
  config: InkConfig;
  preset: InkPresetName | 'custom';
  open: boolean;
  mode: InkMode;
  quality: InkQuality;
  interactive: boolean;
}

const DEFAULT: Settings = {
  config: defaultInkConfig,
  preset: 'sumi',
  open: true,
  mode: 'paint',
  quality: 'auto',
  interactive: true,
};

function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null') as Partial<Settings> | null;
    if (!raw) return DEFAULT;
    const config = { ...defaultInkConfig, ...raw.config };
    return {
      config,
      preset: raw.preset && (raw.preset === 'custom' || raw.preset in inkPresets) ? raw.preset : 'sumi',
      open: raw.open ?? true,
      mode: raw.mode ?? 'paint',
      quality: raw.quality ?? 'auto',
      interactive: raw.interactive ?? true,
    };
  } catch {
    return DEFAULT;
  }
}

function buildCode(config: InkConfig, mode: InkMode, quality: InkQuality, interactive: boolean) {
  const lines: string[] = [];
  (Object.keys(defaultInkConfig) as (keyof InkConfig)[]).forEach((k) => {
    const a = config[k];
    const b = defaultInkConfig[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      if (typeof a === 'object' && a) lines.push(`  ${k}={${JSON.stringify(a)}}`);
      else if (typeof a === 'string') lines.push(`  ${k}="${a}"`);
      else lines.push(`  ${k}={${a}}`);
    }
  });
  if (mode !== 'trail') lines.push(`  mode="${mode}"`);
  if (quality !== 'auto') lines.push(`  quality="${quality}"`);
  if (!interactive) lines.push('  interactive={false}');
  const props = lines.length ? `\n${lines.join('\n')}\n` : '';
  return `import { InkStage } from 'react-sumi-ink';

<InkStage preset="sumi"${props}>
  <YourContent data-ink="obstacle" />
</InkStage>`;
}

export function Playground() {
  const [saved] = useState(loadSettings);
  const [config, setConfig] = useState(saved.config);
  const [preset, setPreset] = useState(saved.preset);
  const [open, setOpen] = useState(saved.open);
  const [mode, setMode] = useState<InkMode>(saved.mode);
  const [quality, setQuality] = useState<InkQuality>(saved.quality);
  const [interactive, setInteractive] = useState(saved.interactive);
  const [fps, setFps] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [worker, setWorker] = useState(false);
  const handleRef = useRef<InkStageHandle>(null);
  const { scale } = useViewportStage();

  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem(STORE_KEY, JSON.stringify({ config, preset, open, mode, quality, interactive }));
    }, 250);
    return () => clearTimeout(id);
  }, [config, preset, open, mode, quality, interactive]);

  const onConfig = useCallback((patch: Partial<InkConfig>) => {
    setConfig((c) => {
      const next = { ...c, ...patch };
      const match = (Object.keys(inkPresets) as InkPresetName[]).find((name) =>
        (Object.keys(inkPresets.sumi) as (keyof InkConfig)[]).every((k) => JSON.stringify(inkPresets[name][k]) === JSON.stringify(next[k])),
      );
      setPreset(match ?? 'custom');
      return next;
    });
  }, []);

  const onPreset = useCallback((name: InkPresetName) => {
    setPreset(name);
    setConfig({ ...inkPresets[name] });
  }, []);

  const code = useMemo(() => buildCode(config, mode, quality, interactive), [config, mode, quality, interactive]);

  return (
    <div className="app playground">
      <InkStage
        ref={handleRef}
        className="stage"
        style={{ height: '100%' }}
        config={config}
        mode={mode}
        quality={quality}
        interactive={interactive}
        onFrame={setFps}
        onReady={(i) => setWorker(i.worker)}
        onError={(e) => setErr(e.message)}
      >
        <Scene layoutScale={scale} />
      </InkStage>
      <ControlPanel
        open={open}
        onOpen={setOpen}
        config={config}
        onConfig={onConfig}
        preset={preset}
        onPreset={onPreset}
        interactive={interactive}
        onInteractive={setInteractive}
        fps={fps}
        worker={worker}
        error={err}
        code={code}
        onReset={() => handleRef.current?.clear()}
        onDry={() => handleRef.current?.dry()}
        onSnapshot={() => {
          const url = handleRef.current?.snapshot();
          if (url) {
            const a = document.createElement('a');
            a.href = url;
            a.download = 'sumi-ink.png';
            a.click();
          }
        }}
      />
      <div className="dock" aria-label="Modo de tinta">
        {(['trail', 'paint', 'ambient', 'static'] as InkMode[]).map((m) => (
          <button key={m} type="button" className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}