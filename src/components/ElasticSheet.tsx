import { useId, useLayoutEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { GripHorizontal, X } from 'lucide-react';
import { springs, rubberBand } from '../lib/motion';
import { useApp } from '../state/AppState';
import { IconButton } from './ui';

const overshoot = 72;

interface Drag { id: number; y: number; height: number; lastY: number; lastTime: number; velocity: number; moved: boolean }

export function ElasticSheet({ title, children, onClose, immediateFocus = false, focusField = true }: {
  immediateFocus?: boolean; focusField?: boolean; title: string; children: ReactNode | ((dismiss: () => void) => ReactNode); onClose: () => void;
}) {
  const titleId = useId();
  const { data } = useApp();
  const systemReduced = useReducedMotion();
  const reduce = !!systemReduced || data.profile.reducedMotion;
  const height = useMotionValue(0);
  const offset = useMotionValue(0);
  const backdrop = useMotionValue(0);
  const drag = useRef<Drag | null>(null);
  const closing = useRef(false);
  const expanded = useRef(false);
  const panel = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const getLimits = () => {
    const max = Math.max(220, window.innerHeight - 96);
    return { min: Math.min(max, Math.max(310, Math.min(530, window.innerHeight * 0.68))), max };
  };
  const settle = (target: number, velocity: number) => {
    const finish = () => { height.set(target); offset.set(0); };
    if (reduce) { finish(); return; }
    animate(offset, height.get() - target, {
      ...springs.panel, velocity: Math.max(-1400, Math.min(1400, -velocity)), onComplete: finish,
    });
  };
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    drag.current = null;
    offset.stop();
    backdrop.stop();
    if (reduce) { onClose(); return; }
    animate(backdrop, 0, { duration: 0.18 });
    animate(offset, height.get(), { duration: 0.21, ease: 'easeIn', onComplete: onClose });
  };
  useLayoutEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initialHeight = getLimits().min;
    height.set(initialHeight);
    offset.set(reduce ? 0 : initialHeight);
    backdrop.set(reduce ? 1 : 0);
    const moveFocus = () => {
      if (!focusField) return;
      const fields = panel.current?.querySelectorAll<HTMLElement>('.sheet-scroll input:not([type="file"]), .sheet-scroll textarea');
      const target = Array.from(fields ?? []).find((field) => field.getClientRects().length > 0);
      (target || panel.current)?.focus({ preventScroll: true });
    };
    panel.current?.focus({ preventScroll: true });
    if (reduce || immediateFocus) moveFocus();
    if (!reduce) {
      animate(backdrop, 1, { duration: 0.18 });
      animate(offset, 0, { duration: 0.3, ease: [0.22, 1, 0.36, 1], onComplete: () => {
        if (document.activeElement === panel.current) moveFocus();
      } });
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest('.ds-select-content')) return;
      if (event.key === 'Escape' && !event.defaultPrevented) close();
      if (event.key !== 'Tab') return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled):not([type="file"]), select:not(:disabled), textarea:not(:disabled), a[href], summary',
      ) || []).filter((item) => item.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if ((event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) ||
        (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      offset.stop();
      backdrop.stop();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      trigger.current?.focus({ preventScroll: true });
    };
  }, []);
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (closing.current || drag.current || event.button !== 0) return;
    offset.stop();
    const visible = height.get() - offset.get();
    // Reserve the drag area once. Pointer moves only translate the panel.
    const dragHeight = getLimits().max + overshoot;
    height.set(dragHeight);
    offset.set(dragHeight - visible);
    drag.current = { id: event.pointerId, y: event.clientY, height: visible,
      lastY: event.clientY, lastTime: performance.now(), velocity: 0, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    const delta = state.y - event.clientY;
    if (Math.abs(delta) >= 8) state.moved = true;
    const { min, max } = getLimits();
    const raw = state.height + delta;
    const visible = raw > max ? max + rubberBand(raw - max, overshoot) : raw < min ? min + rubberBand(raw - min, overshoot) : raw;
    offset.set(Math.max(0, height.get() - visible));
    const now = performance.now();
    const elapsed = Math.max(1, now - state.lastTime);
    state.velocity = ((state.lastY - event.clientY) / elapsed) * 1000;
    state.lastTime = now;
    state.lastY = event.clientY;
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    drag.current = null;
    const { min, max } = getLimits();
    if (event.type !== 'pointerup' || !state.moved) {
      settle(expanded.current ? max : min, 0);
      return;
    }
    const visible = height.get() - offset.get();
    const velocity = performance.now() - state.lastTime < 100 ? state.velocity : 0;
    if (visible < min - 36 || (velocity < -650 && visible < min + 30)) return close();
    expanded.current = visible > min + (max - min) * 0.35 || velocity > 650;
    settle(expanded.current ? max : min, velocity);
  };

  return createPortal(<div className="sheet-root">
    <motion.div className="sheet-backdrop" style={{ opacity: backdrop }} onClick={close} aria-hidden="true" />
    <motion.section className="elastic-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}
      ref={panel} tabIndex={-1} style={{ height, y: offset }}>
      <div className="sheet-grab" onPointerDown={pointerDown} onPointerMove={pointerMove}
        onPointerUp={pointerUp} onPointerCancel={pointerUp} onLostPointerCapture={pointerUp} aria-label="Arraste para expandir ou reduzir o painel">
        <GripHorizontal size={26} strokeWidth={1.6} />
      </div>
      <div className="sheet-head"><h2 id={titleId}>{title}</h2><IconButton label="Fechar painel" onClick={close}><X size={19} /></IconButton></div>
      <div className="sheet-scroll">{typeof children === 'function' ? children(close) : children}</div>
    </motion.section>
  </div>, document.body);
}
