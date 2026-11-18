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
import type { PaperName } from './webgl/renderer';
import { createInkRuntime, type InkSimBridge } from './worker/inkRuntime';

export interface InkStageHandle {
  splash: (x: number, y: number, opts?: InkSplashOptions) => void;
  stroke: (points: InkPoint[], opts?: InkSplashOptions) => void;
  clear: () => void;
  dry: () => void;
  snapshot: () => Promise<string | null>;
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

export const InkStage = forwardRef<InkStageHandle, InkStageProps>(function InkStage(props, ref) {
  const {
    children,
    className,
    style,
    mode = 'trail',
    quality = 'auto',
    interactive = true,
    onError,
    onFrame,
    onReady,
  } = props;

  const cfg = useMemo(() => mergeConfig(props.preset, props.config, props), [props]);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const rootRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLCanvasElement>(null);
  const bridgeRef = useRef<InkSimBridge | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, nx: 0, ny: 0, t: 0, down: false });
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

  const pxToCells = (px: number) => {
    const eng = bridgeRef.current;
    const root = rootRef.current;
    if (!eng || !root) return px;
    const w = Math.max(1, root.getBoundingClientRect().width);
    return (px / w) * eng.gw;
  };

  const api: InkContextValue = useMemo(
    () => ({
      splash: (x, y, opts) => {
        const root = rootRef.current;
        const eng = bridgeRef.current;
        if (!root || !eng) return;
        const r = root.getBoundingClientRect();
        const color = opts?.color ?? cfgRef.current.inkColor;
        eng.splat(
          (x - r.left) / r.width,
          (y - r.top) / r.height,
          pxToCells(opts?.radius ?? cfgRef.current.brushSize),
          opts?.amount ?? cfgRef.current.amount,
          color.r,
          color.g,
          color.b,
          opts?.vx ?? 0,
          opts?.vy ?? 0,
        );
      },
      stroke: (points, opts) => {
        const eng = bridgeRef.current;
        if (!eng || points.length < 2) return;
        const cells = pxToCells(opts?.radius ?? cfgRef.current.brushSize);
        const pressure = opts?.pressure ?? Math.min(1, opts?.amount ?? cfgRef.current.amount);
        const load = opts?.load ?? cfgRef.current.amount;
        const speed = opts?.speed ?? 0.18;
        const wash = opts?.wash ?? 0.16;
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1];
          const b = points[i];
          eng.stroke(a.x, a.y, b.x, b.y, cells, pressure, load, speed, wash);
        }
      },
      clear: () => bridgeRef.current?.clear(),
      dry: () => bridgeRef.current?.dryAll(),
      snapshot: () => bridgeRef.current?.snapshot() ?? Promise.resolve(null),
    }),
    [],
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
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const grid = qualityToGrid(quality, rect.width, rect.height);
        const paper = cfgRef.current.paper as PaperName;
        let surface: HTMLCanvasElement | OffscreenCanvas = canvas;
        let transferred = false;
        const forceMain = new URLSearchParams(window.location.search).get('ink-main') === '1';
        if (!forceMain && typeof Worker !== 'undefined' && typeof canvas.transferControlToOffscreen === 'function') {
          try {
            surface = canvas.transferControlToOffscreen();
            transferred = true;
          } catch {
            surface = canvas;
          }
        }
        let bridge: InkSimBridge;
        try {
          bridge = await createInkRuntime({
            vw: grid.vw,
            vh: grid.vh,
            scale: grid.scale,
            canvas: surface,
            viewW: rect.width,
            viewH: rect.height,
            dpr,
            paper,
          });
        } catch (err) {
          if (!transferred || disposed) throw err;
          canvas.remove();
          const fresh = document.createElement('canvas');
          fresh.className = 'ink-stage-layer';
          fresh.setAttribute('aria-hidden', 'true');
          const paperEl = root.querySelector('.ink-stage-paper');
          if (paperEl) root.insertBefore(fresh, paperEl);
          else root.appendChild(fresh);
          layerRef.current = fresh;
          bridge = await createInkRuntime({
            vw: grid.vw,
            vh: grid.vh,
            scale: grid.scale,
            canvas: fresh,
            viewW: rect.width,
            viewH: rect.height,
            dpr,
            paper,
          });
        }
        if (disposed) {
          bridge.dispose();
          return;
        }
        const c = cfgRef.current;
        bridge.setParams(c.viscosity, c.diffusion, c.drying, c.vorticity);
        bridge.setMode(reducedMotion.current ? 'static' : modeRef.current);
        bridge.onFps = (fps) => onFrameRef.current?.(fps);
        bridgeRef.current = bridge;
        rebuildMask();
        const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
        void fonts?.ready.then(() => {
          if (!disposed) rebuildMask();
        });
        setReady(true);
        onReadyRef.current?.({ worker: bridge.usedWorker });
      } catch (e) {
        if (disposed) return;
        setFailed(true);
        onErrorRef.current?.({ code: 'worker-failed', message: e instanceof Error ? e.message : 'init failed' });
      }
    };
    void boot();

    const ro = new ResizeObserver(() => {
      const rootEl = rootRef.current;
      const bridge = bridgeRef.current;
      if (!rootEl || !bridge) return;
      const r = rootEl.getBoundingClientRect();
      bridge.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 1.5));
      rebuildMask();
    });
    ro.observe(root);
    const unobserveDom = observeInkDom(root, rebuildMask);

    return () => {
      disposed = true;
      unobserveDom();
      ro.disconnect();
      bridgeRef.current?.dispose();
      bridgeRef.current = null;
      setReady(false);
    };
  }, [quality, rebuildMask, runtime.wasm, runtime.webgl2]);

  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    bridge.setParams(cfg.viscosity, cfg.diffusion, cfg.drying, cfg.vorticity);
    bridge.setPaper(cfg.paper);
  }, [cfg]);

  useEffect(() => {
    bridgeRef.current?.setMode(reducedMotion.current ? 'static' : mode);
  }, [mode, ready]);

  const onPointer = (e: React.PointerEvent) => {
    if (!interactive || failed || !ready) return;
    const root = rootRef.current;
    const eng = bridgeRef.current;
    if (!root || !eng) return;
    const rect = root.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
    const ny = (e.clientY - rect.top) / Math.max(1, rect.height);
    const now = performance.now();
    const prev = pointerRef.current;
    const dt = Math.max(8, now - prev.t);
    const speedPx = Math.hypot(e.clientX - prev.x, e.clientY - prev.y) / dt;
    const speed = Math.max(0.04, Math.min(1, speedPx / 1.4));
    const pressure = Math.max(0.22, Math.min(1, 1.05 - speed * 0.7));
    const load = Math.max(0.3, cfg.amount * (1 - speed * 0.35));
    const cells = pxToCells(cfg.brushSize * (0.65 + pressure));
    if (prev.down) {
      eng.stroke(prev.nx, prev.ny, nx, ny, cells, pressure, load, speed, speed > 0.55 ? 0.05 : 0.18);
    }
    pointerRef.current = { x: e.clientX, y: e.clientY, nx, ny, t: now, down: true };
  };

  const endPointer = () => {
    pointerRef.current.down = false;
  };

  return (
    <InkContext.Provider value={api}>
      <div
        ref={rootRef}
        className={className}
        style={{ position: 'relative', overflow: 'hidden', touchAction: 'none', ...style }}
        onPointerDownCapture={onPointer}
        onPointerMoveCapture={(e) => {
          if (e.buttons > 0) onPointer(e);
        }}
        onPointerUpCapture={endPointer}
        onPointerLeave={endPointer}
      >
        <canvas ref={layerRef} className="ink-stage-layer" aria-hidden />
        <div className="ink-stage-paper">{children}</div>
      </div>
    </InkContext.Provider>
  );
});
