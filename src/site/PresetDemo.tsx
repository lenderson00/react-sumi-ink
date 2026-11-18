import { useState } from 'react';
import { InkStage, inkPresets, type InkPresetName } from 'react-sumi-ink';

const NAMES = Object.keys(inkPresets) as InkPresetName[];

export function PresetDemo() {
  const [preset, setPreset] = useState<InkPresetName>('sumi');
  return (
    <section className="presets-band">
      <div className="presets-copy">
        <h2>Presets</h2>
        <div className="preset-chips">
          {NAMES.map((name) => (
            <button key={name} type="button" className={preset === name ? 'on' : ''} onClick={() => setPreset(name)}>
              {name}
            </button>
          ))}
        </div>
        <p>Experimente wash, calligraphy, smoke, koi e minimal no playground.</p>
      </div>
      <InkStage key={preset} className="preset-stage" preset={preset} mode="ambient" style={{ height: 260 }}>
        <div className="preset-label" data-ink="obstacle">
          {preset}
        </div>
      </InkStage>
    </section>
  );
}