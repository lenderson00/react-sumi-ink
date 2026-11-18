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
import {
  qualityToGrid,
  supportsInkRuntime,
  type InkMode,
  type InkPoint,
  type InkQuality,
  type InkRgb,
  type InkRuntimeError,
  type InkSplashOptions,
} from './shared';
import { InkRenderer } from './webgl/renderer';
import { createInkRuntime, type InkSimBridge } from './worker/inkRuntime';

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
  onReady?: (info: { worker: boolean }) => void;
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

const cellRadius = (brushPx: number, stageW: number, stageH: number, gw: number, gh: number) =>
  Math.max(2.5, (brushPx / Math.max(stageW, stageH)) * Math.max(gw, gh) * 1.15);

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
    onReady,
  } = props;

  const cfg = useMemo(() => mergeConfig(props.preset, props.config, props), [props]);

  const rootRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLCanvasElement>(null);
  const bridgeRef = useRef<InkSimBridge | null>(null);
  const rendererRef = useRef<InkRenderer | null>(null);
  const stagePxRef = useRef({ w: 1, h: 1 });
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, t: 0 });
  const fpsRef = useRef({ frames: 0, last: 0 });
  const reducedMotion = useRef(false);
  const onErrorRef = useRef(onError);
  const onFrameRef = useRef(onFrame);
  const onReadyRef = useRef(onReady);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onErrorRef.current = onError;
    onFrameRef.current = onFrame;
    onReadyRef.current = onReady;
  }, [onError, onFrame, onReady]);

  const runtime = supportsInkRuntime();

  const splatNorm = useCallback(
    (nx: number, ny: number, opts: InkSplashOptions = {}, speed = 0) => {
      const eng = bridgeRef.current;
      const root = rootRef.current;
      if (!eng || !root) return;
      const rect = root.getBoundingClientRect();
      stagePxRef.current = { w: rect.width, h: rect.height };
      const amount = opts.amount ?? cfg.amount;
      const br = opts.radius ?? cfg.brushSize;
      const radius = cellRadius(br, rect.width, rect.height, eng.gw, eng.gh);
      const color = opts.color ?? cfg.inkColor;
      const vx = opts.vx ?? speed;
      const vy = opts.vy ?? 0;
      eng.splat(nx, ny, radius, amount, color.r, color.g, color.b, vx, vy);
      if (speed > 2.5) {
        eng.splat(nx, ny, radius * 0.55, amount * 0.35, color.r, color.g, color.b, vx * 1.2, vy * 1.2);
      }
      if (cfg.accent && Math.random() < 0.14) {
        const a = cfg.accent;
        eng.splat(nx, ny, radius * 0.65, amount * 0.55, a.r, a.g, a.b, vx * 0.15, vy * 0.15);
      }
      if (palette?.length && Math.random() < 0.1) {
        const accent = palette[Math.floor(Math.random() * palette.length)];
        eng.splat(nx, ny, radius * 0.5, amount * 0.4, accent.r, accent.g, accent.b, 0, 0);
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
          splatNorm(b.x, b.y, opts, Math.hypot(b.x - a.x, b.y - a.y) * 5);
        }
      },
      clear: () => bridgeRef.current?.clear(),
      dry: () => bridgeRef.current?.dryAll(),
      snapshot: () => rendererRef.current?.snapshot() ?? null,
    }),
    [splatNorm],
  );

  useImperativeHandle(ref, () => api, [api]);

  const rebuildMask = useCallback(() => {
    const root = rootRef.current;
    const eng = bridgeRef.current;
    if (!root || !eng) return;
    const rect = root.getBoundingClientRect();
    const rects = collectInkRects(root);
    const mask = rasterizeObstacleMask(root, eng.gw, eng.gh, rect.width, rect.height, rects);
    eng.setMask(mask);
  }, []);

  useEffect(() => {
    if (!runtime.webgl2 || !runtime.wasm) {
      setFailed(true);
      onErrorRef.current?.({
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
        const bridge = await createInkRuntime(grid.w, grid.h, true);
        if (disposed) {
          bridge.dispose();
          return;
        }
        bridge.setParams(cfg.viscosity, cfg.diffusion, cfg.drying, cfg.vorticity);
        bridgeRef.current = bridge;
        const renderer = new InkRenderer(canvas);
        renderer.resize(rect.width, rect.height, dpr);
        rendererRef.current = renderer;
        rebuildMask();
        splatNorm(0.48, 0.52, { amount: 0.85, radius: cfg.brushSize * 2.2 });
        const bootRgba = await bridge.step(1 / 60);
        renderer.uploadRGBA(bootRgba, bridge.gw, bridge.gh);
        renderer.draw(cfg.paper, 0.75, 0);
        setReady(true);
        onReadyRef.current?.({ worker: bridge.usedWorker });
        lastRef.current = performance.now();

        let simBusy = false;
        const tick = (now: number) => {
          if (disposed) return;
          const dt = Math.min(0.05, (now - lastRef.current) / 1000);
          lastRef.current = now;
          const effectiveMode = reducedMotion.current ? 'static' : mode;
          const runSim = effectiveMode !== 'static' && !simBusy;
          if (runSim) {
            simBusy = true;
            void bridge.step(dt).then((rgba) => {
              simBusy = false;
              if (disposed) return;
              renderer.uploadRGBA(rgba, bridge.gw, bridge.gh);
              renderer.draw(cfg.paper, effectiveMode === 'ambient' ? 0.35 : 0.75, now * 0.001);
            });
          } else if (!simBusy) {
            renderer.draw(cfg.paper, effectiveMode === 'ambient' ? 0.35 : 0.12, now * 0.001);
          }
          fpsRef.current.frames += 1;
          if (now - fpsRef.current.last > 500) {
            const fps = (fpsRef.current.frames * 1000) / (now - fpsRef.current.last);
            onFrameRef.current?.(fps);
            fpsRef.current.frames = 0;
            fpsRef.current.last = now;
          }
          if (effectiveMode === 'ambient' && !reducedMotion.current && Math.random() < 0.06) {
            splatNorm(Math.random(), Math.random(), { amount: 0.12, radius: cfg.brushSize * 0.45 });
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        setFailed(true);
        onErrorRef.current?.({ code: 'worker-failed', message: e instanceof Error ? e.message : 'init failed' });
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
      bridgeRef.current?.dispose();
      bridgeRef.current = null;
      rendererRef.current = null;
    };
  }, [
    cfg.paper,
    cfg.viscosity,
    cfg.diffusion,
    cfg.drying,
    cfg.vorticity,
  mode,
    quality,
    rebuildMask,
    runtime.wasm,
    runtime.webgl2,
    cfg.brushSize,
    cfg.amount,
  ]);

  useEffect(() => {
    bridgeRef.current?.setParams(cfg.viscosity, cfg.diffusion, cfg.drying, cfg.vorticity);
  }, [cfg]);

  const onPointer = (e: React.PointerEvent) => {
    if (!interactive || failed || !ready) return;
    const root = rootRef.current;
    if (!root) return;
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
      const widen = 1 + Math.min(speed * 0.015, 1.2);
      splatNorm(nx, ny, { radius: cfg.brushSize * widen, amount: cfg.amount * (1 + speed * 0.002) }, speed * 0.004);
    }
  };

  return (
    <InkContext.Provider value={api}>
      <div
        ref={rootRef}
        className={className}
        style={{ position: 'relative', overflow: 'hidden', ...style }}
        onPointerDownCapture={onPointer}
        onPointerMoveCapture={(e) => {
          if (e.buttons > 0) onPointer(e);
        }}
      >
        <canvas
          ref={layerRef}
          className="ink-stage-layer"
          aria-hidden
        />
        <div className="ink-stage-paper">{children}</div>
      </div>
    </InkContext.Provider>
  );
});