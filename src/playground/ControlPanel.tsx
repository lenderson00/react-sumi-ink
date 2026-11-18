import { useEffect, useState } from 'react';
import { inkPresets, type InkConfig, type InkPresetName } from 'react-sumi-ink';

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
  error: string | null;
  code: string;
  onReset: () => void;
  onDry: () => void;
  onSnapshot: () => void;
};

const FLUID: { key: keyof InkConfig; label: string; min: number; max: number; step: number }[] = [
  { key: 'viscosity', label: 'Viscosity', min: 0, max: 0.002, step: 0.00005 },
  { key: 'diffusion', label: 'Diffusion', min: 0, max: 0.002, step: 0.00005 },
  { key: 'drying', label: 'Drying', min: 0, max: 0.6, step: 0.01 },
  { key: 'vorticity', label: 'Vorticity', min: 0, max: 8, step: 0.1 },
  { key: 'brushSize', label: 'Brush (px)', min: 4, max: 64, step: 1 },
  { key: 'amount', label: 'Amount', min: 0.1, max: 1.5, step: 0.05 },
];

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="slider-row">
      <span className="slider-label">
        {label} <output>{value.toFixed(3)}</output>
      </span>
      <div className="slider-track" style={{ ['--fill' as string]: `${pct}%` }}>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
      </div>
    </label>
  );
}

export function ControlPanel(props: Props) {
  const [tab, setTab] = useState<'fluid' | 'render' | 'code'>('fluid');
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const fn = () => setMobile(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  return (
    <aside className={`cp ${props.open ? '' : 'is-collapsed'} ${mobile ? 'is-sheet' : ''}`}>
      <div className="panel-head">
        <div className="tabs">
          {(['fluid', 'render', 'code'] as const).map((t) => (
            <button key={t} type="button" className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        <button type="button" className="panel-toggle" onClick={() => props.onOpen(!props.open)}>
          {props.open ? 'Hide' : 'Controls'}
        </button>
      </div>
      {props.open && (
        <>
          <div className="panel-presets">
            {(Object.keys(inkPresets) as InkPresetName[]).map((name) => (
              <button
                key={name}
                type="button"
                className={props.preset === name ? 'on' : ''}
                onClick={() => props.onPreset(name)}
              >
                {name}
              </button>
            ))}
          </div>
          {tab === 'fluid' && (
            <div className="panel-section">
              {FLUID.map((row) => (
                <Slider
                  key={row.key}
                  label={row.label}
                  value={props.config[row.key] as number}
                  min={row.min}
                  max={row.max}
                  step={row.step}
                  onChange={(v) => props.onConfig({ [row.key]: v })}
                />
              ))}
              <label className="segmented">
                <span>Paper</span>
                <select
                  value={props.config.paper}
                  onChange={(e) => props.onConfig({ paper: e.target.value as InkConfig['paper'] })}
                >
                  <option value="washi">washi</option>
                  <option value="rice">rice</option>
                  <option value="cloud">cloud</option>
                </select>
              </label>
            </div>
          )}
          {tab === 'render' && (
            <div className="panel-section">
              <p className="stat">FPS: {props.fps.toFixed(0)}</p>
              {props.error && <p className="error">{props.error}</p>}
              <label className="check">
                <input
                  type="checkbox"
                  checked={props.interactive}
                  onChange={(e) => props.onInteractive(e.target.checked)}
                />
                Interactive
              </label>
              <div className="btn-row">
                <button type="button" onClick={props.onReset}>
                  Clear
                </button>
                <button type="button" onClick={props.onDry}>
                  Dry all
                </button>
                <button type="button" onClick={props.onSnapshot}>
                  PNG
                </button>
              </div>
            </div>
          )}
          {tab === 'code' && (
            <pre className="code-block">
              <button type="button" className="copy" onClick={() => navigator.clipboard.writeText(props.code)}>
                Copy
              </button>
              {props.code}
            </pre>
          )}
        </>
      )}
    </aside>
  );
}