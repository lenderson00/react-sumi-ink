import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { StickerState } from '../playground/Scene';

/** Draggable sticker state (positions relative to the scene centre). */
export function useStickers(initial: StickerState[]) {
  const [stickers, setStickers] = useState(initial);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const ref = useRef(stickers);
  ref.current = stickers;

  const onStickerPointerDown = useCallback((id: string, e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const current = ref.current.find((s) => s.id === id)!;
    const origin = { x: current.x, y: current.y };
    setStickers((list) => {
      const top = Math.max(...list.map((s) => s.z)) + 1;
      return list.map((s) => (s.id === id ? { ...s, z: top } : s));
    });
    setDraggingId(id);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setStickers((list) => list.map((s) => (s.id === id ? { ...s, x: origin.x + dx, y: origin.y + dy } : s)));
    };
    const up = () => {
      setDraggingId(null);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }, []);

  const reset = useCallback(() => setStickers(initial), [initial]);

  return { stickers, draggingId, onStickerPointerDown, reset };
}
