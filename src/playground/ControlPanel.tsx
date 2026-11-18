import { useEffect, useState } from 'react';
import { defaultInkConfig, inkPresets, type InkConfig, type InkPresetName } from 'react-sumi-ink';
import { isMobileViewport } from '../lib/viewport';

function useFps(active: boolean) {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let start = last;
    let frames = 0;
    const tick = (now: number) => {
      frames++;
      if (now - start >= 500) {
        setFps(Math.round((frames * 1000) / (now - start)));
        start = now;
        frames = 0;
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return fps;
}

type SliderDef = {
  key: keyof InkConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  digits?: number;
  hint: string;
};

const FLUID: SliderDef[] = [
  { key: 'viscosity', label: 'Viscosity', min: 0, max: 0.002, step: 0.00005, digits: 5, hint: 'Energia cinética no fluido' },
  { key: 'diffusion', label: 'Diffusion', min: 0, max: 0.002, step: 0.00005, digits: 5, hint: 'Sangramento sumi-e' },
  { key: 'drying', label: 'Drying', min: 0, max: 0.6, step: 0.01, hint: 'Secagem e coffee ring' },
  { key: 'vorticity', label: 'Vorticity', min: 0, max: 8, step: 0.1, hint: 'Redemoinhos na tinta' },
];

const BRUSH: SliderDef[] = [
  { key: 'brushSize', label: 'Brush', min: 4, max: 80, step: 1, digits: 0, hint: 'Raio do pincel em px' },
  { key: 'amount', label: 'Amount', min: 0.1, max: 1.8, step: 0.05, hint: 'Quantidade de pigmento por splat' },
];

const PRESET_LABELS: Record<InkPresetName, string> = {
  sumi: 'Sumi',
  wash: 'Wash',
  calligraphy: 'Calligraphy',
  smoke: 'Smoke',
  koi: 'Koi',
  minimal: 'Minimal',
};

function Slider({
  label,
  name,
  value,
  defaultValue,
  min,
  max,
  step,
  digits = 2,
  hint,
  onChange,
}: {
  label: string;
  name?: string;
  value: number;
  defaultValue?: number;
  min: number;
  max: number;
  step: number;
  digits?: number;
  hint?: string;
  onChange: (v: number) => void;
}) {
  const toPct = (v: number) => Math.max(0, Math.min(1, (v - min) / (max - min))) * 100;
  const pct = toPct(value);
  const isDefault = defaultValue === undefined || Math.abs(value - defaultValue) < step / 2;
  return (
    <label
      className={`cp-row cp-slider${isDefault ? '' : ' is-changed'}`}
      title={[name, hint].filter(Boolean).join(' ')}
      onDoubleClick={defaultValue !== undefined ? () => onChange(defaultValue) : undefined}
    >
      <span className="cp-fill" style={{ width: `${pct}%` }} />
      {defaultValue !== undefined && <span className="cp-tick" style={{ left: `${toPct(defaultValue)}%` }} />}
      <span className="cp-label">{label}</span>
      <span className="cp-value">{value.toFixed(digits)}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}

type Props = {
  open: boolean;
  onOpen: (v: boolean) => void;
  config: InkConfig;
  onConfig: (p: Partial<InkConfig>) => void;
  preset: InkPresetName | 'custom';
  onPreset: (p: InkPresetName) => void;
  interactive: boolean;
  onInteractive: (v: boolean) => void;
  fps: number;
  worker: boolean;
  error: string | null;
  code: string;
  onReset: () => void;
  onDry: () => void;
  onSnapshot: () => void;
};

export function ControlPanel(p: Props) {
  const [collapsed, setCollapsed] = useState(() => isMobileViewport());
  const [isMobile, setIsMobile] = useState(() => isMobileViewport());
  const [tab, setTab] = useState<'fluid' | 'brush' | 'render' | 'code'>('fluid');
  const [copied, setCopied] = useState(false);
  const fpsLocal = useFps(tab === 'render' && !collapsed);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* noop */
    }
  };

  return (
    <aside
      className={`cp${collapsed ? ' is-collapsed' : ''}${isMobile ? ' is-sheet' : ''}`}
      aria-label="Ink controls"
      aria-expanded={!collapsed}
    >
      <div className="cp-head">
        <span className="cp-title">Ink</span>
        <button
          type="button"
          className="cp-icon"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand controls' : 'Collapse controls'}
        >
          {collapsed ? '▴' : '▾'}
        </button>
      </div>
      {isMobile && collapsed && (
        <button type="button" className="cp-sheet-hint" onClick={() => setCollapsed(false)}>
          Tap to tune the ink
        </button>
      )}

      {!collapsed && (
        <>
          <div className="cp-toolbar">
            <select
              className="cp-select"
              value={p.preset}
              onChange={(e) => p.onPreset(e.target.value as InkPresetName)}
              aria-label="Preset"
            >
              {p.preset === 'custom' && <option value="custom">Custom</option>}
              {Object.entries(PRESET_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button className="cp-icon" onClick={p.onReset} title="Clear ink" aria-label="Clear ink">
              ↺
            </button>
            <button className="cp-icon" onClick={p.onSnapshot} title="Snapshot PNG" aria-label="Snapshot PNG">
              ⧉
            </button>
          </div>

          <div className="cp-tabs" role="tablist">
            {(
              [
                ['fluid', 'Fluid'],
                ['brush', 'Brush'],
                ['render', 'Render'],
                ['code', 'Code'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>

          {tab === 'fluid' &&
            FLUID.map((d) => (
              <Slider
                key={d.key}
                label={d.label}
                name={d.key}
                value={p.config[d.key] as number}
                defaultValue={defaultInkConfig[d.key] as number}
                min={d.min}
                max={d.max}
                step={d.step}
                digits={d.digits}
                hint={d.hint}
                onChange={(v) => p.onConfig({ [d.key]: v })}
              />
            ))}

          {tab === 'brush' && (
            <>
              {BRUSH.map((d) => (
                <Slider
                  key={d.key}
                  label={d.label}
                  name={d.key}
                  value={p.config[d.key] as number}
                  defaultValue={defaultInkConfig[d.key] as number}
                  min={d.min}
                  max={d.max}
                  step={d.step}
                  digits={d.digits}
                  hint={d.hint}
                  onChange={(v) => p.onConfig({ [d.key]: v })}
                />
              ))}
              <label className="cp-row cp-seg">
                <span className="cp-label">Paper</span>
                <select
                  className="cp-select"
                  value={p.config.paper}
                  onChange={(e) => p.onConfig({ paper: e.target.value as InkConfig['paper'] })}
                >
                  <option value="washi">washi</option>
                  <option value="rice">rice</option>
                  <option value="cloud">cloud</option>
                </select>
              </label>
            </>
          )}

          {tab === 'render' && (
            <>
              <div className="cp-stats">
                <span>
                  FPS <b>{p.fps || fpsLocal}</b>
                </span>
                <span>
                  Worker <b>{p.worker ? 'on' : 'main'}</b>
                </span>
              </div>
              {p.error && (
                <div className="cp-stats">
                  <span>
                    Error <b>{p.error}</b>
                  </span>
                </div>
              )}
              <label className="cp-row cp-seg">
                <span className="cp-label">Interactive</span>
                <input type="checkbox" checked={p.interactive} onChange={(e) => p.onInteractive(e.target.checked)} />
              </label>
              <button type="button" className="cp-row" onClick={p.onDry}>
                <span className="cp-label">Dry all</span>
              </button>
            </>
          )}

          {tab === 'code' && (
            <div className="cp-code">
              <pre>{p.code}</pre>
              <button type="button" className="cp-copy" onClick={copy}>
                {copied ? 'Copied' : 'Copy JSX'}
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}