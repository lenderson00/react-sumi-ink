import {
  createContext,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { collectInkRects, observeInkDom, rasterizeObstacleMask } from './dom/obstacleMask';
import { defaultInkConfig, inkPresets, type InkConfig, type InkPresetName } from './presets';
import { qualityToGrid, supportsInkRuntime, type InkMode, type InkPoint, type InkQuality, type InkRgb, type InkRuntimeError, type InkSplashOptions } from './shared';
import { InkRenderer } from './webgl/renderer';
import { createInkEngine, type InkEngine } from './worker/inkEngine';

export interface InkStageHandle {
  splash: (x: number, y: number, opts?: InkSplashOptions) => void;
  stroke: (points: InkPoint[], opts?: InkSplashOptions) => void;
  clear: () => void;
  dry: () => void;
  snapshot: () => string | null;
}

export interface InkContextValue {
  splash: InkStageHandle['splash'];
  stroke: InkStageHandle['stroke'];
  clear: InkStageHandle['clear'];
  dry: InkStageHandle['dry'];
  snapshot: InkStageHandle['snapshot'];
}

export const InkContext = createContext<InkContextValue | null>(null);

export interface InkStageProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  config?: InkConfig;
  preset?: InkPresetName;
  mode?: InkMode;
  quality?: InkQuality;
  interactive?: boolean;
  viscosity?: number;
  diffusion?: number;
  drying?: number;
  brushSize?: number;
  inkColor?: InkRgb;
  palette?: InkRgb[];
  paper?: InkConfig['paper'];
  onError?: (err: InkRuntimeError) => void;
  onFrame?: (fps: number) => void;
}

const mergeConfig = (
  preset: InkPresetName | undefined,
  config: InkConfig | undefined,
  props: InkStageProps,
): InkConfig => {
  const base = preset ? inkPresets[preset] : config ?? defaultInkConfig;
  return {
    ...base,
    viscosity: props.viscosity ?? base.viscosity,
    diffusion: props.diffusion ?? base.diffusion,
    drying: props.drying ?? base.drying,
    brushSize: props.brushSize ?? base.brushSize,
    inkColor: props.inkColor ?? base.inkColor,
    paper: props.paper ?? base.paper,
  };
};

export const InkStage = forwardRef<InkStageHandle, InkStageProps>(function InkStage(props, ref) {
  const {
    children,
    className,
    style,
    mode = 'trail',
    quality = 'auto',
    interactive = true,
    palette,
    onError,
    onFrame,
  } = props;

  const cfg = useMemo(() => mergeConfig(props.preset, props.config, props), [props]);

  const rootRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<InkEngine | null>(null);
  const rendererRef = useRef<InkRenderer | null>(null);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, t: 0 });
  const fpsRef = useRef({ frames: 0, last: 0 });
  const reducedMotion = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const runtime = supportsInkRuntime();

  const splatNorm = useCallback(
    (nx: number, ny: number, opts: InkSplashOptions = {}, speed = 0) => {
      const eng = engineRef.current;
      if (!eng) return;
      const amount = opts.amount ?? cfg.amount;
      const radius = (opts.radius ?? cfg.brushSize) / Math.max(eng.gw, eng.gh);
      const color = opts.color ?? cfg.inkColor;
      const vx = opts.vx ?? speed;
      const vy = opts.vy ?? 0;
      eng.splat(nx, ny, radius, amount, color.r, color.g, color.b, vx, vy);
      if (palette?.length && Math.random() < 0.08) {
        const accent = palette[Math.floor(Math.random() * palette.length)];
        eng.splat(nx, ny, radius * 0.7, amount * 0.35, accent.r, accent.g, accent.b, vx * 0.3, vy * 0.3);
      }
      if (cfg.accent && Math.random() < 0.12) {
        const a = cfg.accent;
        eng.splat(nx, ny, radius * 0.55, amount * 0.4, a.r, a.g, a.b, vx * 0.2, vy * 0.2);
      }
    },
    [cfg, palette],
  );

  const api: InkContextValue = useMemo(
    () => ({
      splash: (x, y, opts) => {
        const root = rootRef.current;
        if (!root) return;
        const r = root.getBoundingClientRect();
        splatNorm((x - r.left) / r.width, (y - r.top) / r.height, opts);
      },
      stroke: (points, opts) => {
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1];
          const b = points[i];
          splatNorm(b.x, b.y, opts, Math.hypot(b.x - a.x, b.y - a.y) * 4);
        }
      },
      clear: () => engineRef.current?.sim.clear(),
      dry: () => engineRef.current?.sim.dry_all(),
      snapshot: () => rendererRef.current?.snapshot() ?? null,
    }),
    [splatNorm],
  );

  useImperativeHandle(ref, () => api, [api]);

  const rebuildMask = useCallback(() => {
    const root = rootRef.current;
    const eng = engineRef.current;
    if (!root || !eng) return;
    const rect = root.getBoundingClientRect();
    const rects = collectInkRects(root);
    const mask = rasterizeObstacleMask(eng.gw, eng.gh, rect.width, rect.height, rects);
    eng.setMask(mask);
  }, []);

  useEffect(() => {
    if (!runtime.webgl2 || !runtime.wasm) {
      setFailed(true);
      onError?.({
        code: !runtime.webgl2 ? 'no-webgl2' : 'no-wasm',
        message: 'InkStage requires WebGL2 and WebAssembly.',
      });
      return;
    }
    const root = rootRef.current;
    const canvas = layerRef.current;
    if (!root || !canvas) return;

    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let disposed = false;
    const boot = async () => {
      try {
        const rect = root.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const grid = qualityToGrid(quality, rect.width, rect.height);
        const eng = await createInkEngine(grid.w, grid.h);
        if (disposed) {
          eng.dispose();
          return;
        }
        eng.sim.set_params(cfg.viscosity, cfg.diffusion, cfg.drying, cfg.vorticity);
        engineRef.current = eng;
        const renderer = new InkRenderer(canvas);
        renderer.resize(rect.width, rect.height, dpr);
        rendererRef.current = renderer;
        rebuildMask();
        setReady(true);
        lastRef.current = performance.now();
        const tick = (now: number) => {
          if (disposed) return;
          const dt = Math.min(0.05, (now - lastRef.current) / 1000);
          lastRef.current = now;
          const effectiveMode = reducedMotion.current ? 'static' : mode;
          if (effectiveMode !== 'static') {
            eng.step(dt);
            renderer.uploadRGBA(eng.rgba, eng.gw, eng.gh);
            renderer.draw(cfg.paper, effectiveMode === 'ambient' ? 0.25 : 0.65, now * 0.001);
          } else {
            renderer.draw(cfg.paper, 0.1, now * 0.001);
          }
          fpsRef.current.frames += 1;
          if (now - fpsRef.current.last > 500) {
            const fps = (fpsRef.current.frames * 1000) / (now - fpsRef.current.last);
            onFrame?.(fps);
            fpsRef.current.frames = 0;
            fpsRef.current.last = now;
            if (quality === 'auto') {
              const next = qualityToGrid(quality, rect.width, rect.height, fps);
              if (next.w !== eng.gw && fps < 48) {
                /* keep single grid per session for stability */
              }
            }
          }
          if (effectiveMode === 'ambient' && !reducedMotion.current) {
            splatNorm(Math.random(), Math.random(), { amount: 0.08, radius: cfg.brushSize * 0.4 });
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        setFailed(true);
        onError?.({ code: 'no-wasm', message: e instanceof Error ? e.message : 'init failed' });
      }
    };
    void boot();

    const ro = new ResizeObserver(() => {
      const rootEl = rootRef.current;
      const renderer = rendererRef.current;
      if (!rootEl || !renderer) return;
      const r = rootEl.getBoundingClientRect();
      renderer.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 2));
      rebuildMask();
    });
    ro.observe(root);

    const unobserveDom = observeInkDom(root, rebuildMask);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafRef.current);
      unobserveDom();
      ro.disconnect();
      engineRef.current?.dispose();
      engineRef.current = null;
      rendererRef.current = null;
    };
  }, [cfg.paper, cfg.viscosity, cfg.diffusion, cfg.drying, cfg.vorticity, mode, quality, onError, onFrame, rebuildMask, runtime.wasm, runtime.webgl2, splatNorm, cfg.brushSize]);

  useEffect(() => {
    engineRef.current?.sim.set_params(cfg.viscosity, cfg.diffusion, cfg.drying, cfg.vorticity);
  }, [cfg]);

  const onPointer = (e: React.PointerEvent) => {
    if (!interactive || failed || !ready) return;
    const root = rootRef.current;
    const eng = engineRef.current;
    if (!root || !eng) return;
    const rect = root.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const now = performance.now();
    const dt = Math.max(1, now - pointerRef.current.t);
    const vx = (e.clientX - pointerRef.current.x) / dt;
    const vy = (e.clientY - pointerRef.current.y) / dt;
    pointerRef.current = { x: e.clientX, y: e.clientY, vx, vy, t: now };
    if (mode === 'paint' || mode === 'trail') {
      const speed = Math.hypot(vx, vy);
      splatNorm(nx, ny, { radius: cfg.brushSize * (1 + Math.min(speed * 0.02, 0.8)) }, speed * 0.003);
    }
  };

  return (
    <InkContext.Provider value={api}>
      <div
        ref={rootRef}
        className={className}
        style={{ position: 'relative', overflow: 'hidden', ...style }}
        onPointerDown={onPointer}
        onPointerMove={(e) => {
          if (e.buttons > 0) onPointer(e);
        }}
      >
        <canvas
          ref={layerRef}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: interactive ? 'none' : 'auto',
            zIndex: 2,
          }}
        />
        <div style={{ position: 'relative', zIndex: 3, pointerEvents: 'auto' }}>{children}</div>
      </div>
    </InkContext.Provider>
  );
});