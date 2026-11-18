import { parseInkRole, type InkElementRole } from '../shared';

export interface InkObstacleRect {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
  role: InkElementRole;
}

const roleChannel = (role: InkElementRole): [number, number, number] => {
  if (role === 'obstacle') return [1, 0, 0];
  if (role === 'absorb') return [0, 1, 0];
  if (role === 'repel') return [0, 0, 1];
  return [0, 0, 0];
};

const borderRadiusPx = (el: Element, stage: DOMRect): number => {
  const cs = getComputedStyle(el);
  const br = parseFloat(cs.borderTopLeftRadius) || 0;
  return Math.min(br, Math.min(stage.width, stage.height) * 0.5);
};

const paintGlyphs = (ctx: CanvasRenderingContext2D, root: HTMLElement, stage: DOMRect) => {
  const nodes = root.querySelectorAll<HTMLElement>('[data-ink-glyphs], [data-ink="glyphs"]');
  nodes.forEach((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const font = cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const text = (el.textContent || '').trim();
    if (!text) return;
    const role = parseInkRole(el.hasAttribute('data-ink') ? el : el.parentElement || el);
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const color = role === 'absorb' ? '#00ff00' : role === 'repel' ? '#0000ff' : '#ff0000';
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(6, (parseFloat(cs.fontSize) || 24) * 0.055);
    ctx.lineJoin = 'round';
    const x = r.left - stage.left;
    const y = r.top - stage.top;
    const lines = text.split('\n');
    let dy = 0;
    const lh = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) || 20) * 1.15;
    for (const line of lines) {
      ctx.strokeText(line, x, y + dy);
      ctx.fillText(line, x, y + dy);
      dy += lh;
    }
  });
};

export const collectInkRects = (root: HTMLElement): InkObstacleRect[] => {
  const stage = root.getBoundingClientRect();
  const nodes = root.querySelectorAll<HTMLElement>('[data-ink]');
  const out: InkObstacleRect[] = [];
  nodes.forEach((el) => {
    const role = parseInkRole(el);
    if (role === 'ignore') return;
    if (el.hasAttribute('data-ink-glyphs')) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    out.push({
      left: r.left - stage.left,
      top: r.top - stage.top,
      width: r.width,
      height: r.height,
      radius: borderRadiusPx(el, stage),
      role,
    });
  });
  return out;
};

export const rasterizeObstacleMask = (
  root: HTMLElement,
  gw: number,
  gh: number,
  stageW: number,
  stageH: number,
  rects: InkObstacleRect[],
): Float32Array => {
  const n = gw * gh;
  const mask = new Float32Array(n * 3);
  const sx = gw / Math.max(1, stageW);
  const sy = gh / Math.max(1, stageH);

  const glyph = document.createElement('canvas');
  glyph.width = gw;
  glyph.height = gh;
  const gctx = glyph.getContext('2d');
  if (gctx) {
    gctx.scale(sx, sy);
    paintGlyphs(gctx, root, root.getBoundingClientRect());
  }
  const glyphData = gctx?.getImageData(0, 0, gw, gh).data;
  const insideRoundRect = (x: number, y: number, rect: InkObstacleRect): boolean => {
    const rx = rect.left;
    const ry = rect.top;
    const rw = rect.width;
    const rh = rect.height;
    const rad = Math.min(rect.radius, rw * 0.5, rh * 0.5);
    if (x < rx || y < ry || x > rx + rw || y > ry + rh) return false;
    if (rad <= 0) return true;
    const cx = rx + rad;
    const cy = ry + rad;
    const cx2 = rx + rw - rad;
    const cy2 = ry + rh - rad;
    if (x >= cx && x <= cx2 && y >= cy && y <= cy2) return true;
    if (y >= cy && y <= cy2) {
      if (x < cx) {
        const dy = y < cy ? y - cy : y > cy2 ? y - cy2 : 0;
        return (x - cx) ** 2 + dy ** 2 <= rad ** 2;
      }
      if (x > cx2) {
        const dy = y < cy ? y - cy : y > cy2 ? y - cy2 : 0;
        return (x - cx2) ** 2 + dy ** 2 <= rad ** 2;
      }
    }
    if (x < cx && y < cy) return (x - cx) ** 2 + (y - cy) ** 2 <= rad ** 2;
    if (x > cx2 && y < cy) return (x - cx2) ** 2 + (y - cy) ** 2 <= rad ** 2;
    if (x < cx && y > cy2) return (x - cx) ** 2 + (y - cy2) ** 2 <= rad ** 2;
    if (x > cx2 && y > cy2) return (x - cx2) ** 2 + (y - cy2) ** 2 <= rad ** 2;
    return true;
  };

  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const x = (i + 0.5) / sx;
      const y = (j + 0.5) / sy;
      let ch = roleChannel('ignore');
      for (const rect of rects) {
        if (insideRoundRect(x, y, rect)) {
          ch = roleChannel(rect.role);
          break;
        }
      }
      if (glyphData) {
        const gi = (j * gw + i) * 4;
        const a = glyphData[gi + 3];
        if (a > 8) {
          const r = glyphData[gi];
          const g = glyphData[gi + 1];
          const b = glyphData[gi + 2];
          if (r > g && r > b) ch = roleChannel('obstacle');
          else if (g > r && g > b) ch = roleChannel('absorb');
          else if (b > r && b > g) ch = roleChannel('repel');
        }
      }
      const idx = j * gw + i;
      mask[idx] = ch[0];
      mask[n + idx] = ch[1];
      mask[2 * n + idx] = ch[2];
    }
  }
  return mask;
};

export const observeInkDom = (
  root: HTMLElement,
  onChange: () => void,
): (() => void) => {
  const ro = new ResizeObserver(() => onChange());
  ro.observe(root);
  root.querySelectorAll<HTMLElement>('[data-ink]').forEach((el) => ro.observe(el));
  const mo = new MutationObserver(() => {
    ro.disconnect();
    ro.observe(root);
    root.querySelectorAll<HTMLElement>('[data-ink]').forEach((el) => ro.observe(el));
    onChange();
  });
  mo.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-ink', 'data-ink-glyphs', 'class', 'style'],
  });
  return () => {
    ro.disconnect();
    mo.disconnect();
  };
};