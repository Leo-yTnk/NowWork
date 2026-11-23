import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeftRight, Check } from 'lucide-react';
import { IconButton } from '../components/ui';
import { springs } from '../lib/motion';
import { moveRibbonItem, resolveRibbonLane } from '../lib/ribbonOrder';
import { useApp } from '../state/AppState';

export type RibbonCell = { id: string; label: string; control: ReactNode; span?: number };
type Lane = { id: string; flow?: 'horizontal' | 'vertical' | 'matrix'; cells: RibbonCell[] };
export type RibbonSection = { id: string; label: string; fixed?: ReactNode; lanes: Lane[] };

type Gesture = {
  id: string; pointer: number; startX: number; startY: number; x: number; y: number;
  scrollStart: number; started: boolean;
  box: DOMRect; slots: { x: number; y: number }[];
};
type DragCard = { id: string; x: number; y: number; width: number; height: number };
type Preview = DragCard & { position: number };
type Landing = DragCard & { target?: DOMRect };

const dragCardAt = (drag: Gesture): DragCard => ({
  id: drag.id, x: drag.box.left + drag.x - drag.startX, y: drag.box.top + drag.y - drag.startY,
  width: drag.box.width, height: drag.box.height,
});

function RibbonLane({ lane, editing, saved, onSave, endEditing, animate }: {
  lane: Lane; editing: boolean; saved?: string[]; onSave: (order: string[], message: string) => void;
  endEditing: () => void; animate: boolean;
}) {
  const { flow = 'horizontal', cells } = lane;
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [landing, setLanding] = useState<Landing | null>(null);
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const order = resolveRibbonLane(cells.map(({ id }) => id), saved);
  const displayed = preview ? moveRibbonItem(order, preview.id, preview.position) : order;
  const floating = preview ?? landing;

  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useLayoutEffect(() => {
    if (!landing) return;
    if (!editing) { setLanding(null); return; }
    if (landing.target) return;
    const cell = Array.from(root.current?.children ?? []).find((item) => item.getAttribute('data-ribbon-cell') === landing.id);
    setLanding(cell ? { ...landing, target: cell.getBoundingClientRect() } : null);
  }, [editing, landing]);

  const getScroller = () => root.current?.closest<HTMLElement>('.note-ribbon-scroll');
  const positionAt = (drag: Gesture) => {
    const viewport = getScroller();
    const bounds = root.current?.getBoundingClientRect();
    if (!viewport || !bounds) return null;
    const dx = viewport.scrollLeft - drag.scrollStart;
    if (drag.x < bounds.left || drag.x > bounds.right || drag.y < bounds.top || drag.y > bounds.bottom) return null;
    const distance = (slot: Gesture['slots'][number]) => {
      const x = flow === 'vertical' ? 0 : drag.x + dx - slot.x;
      const y = flow === 'horizontal' ? 0 : drag.y - slot.y;
      return x * x + y * y;
    };
    return drag.slots.reduce((best, slot, index) => distance(slot) < distance(drag.slots[best]) ? index : best, 0);
  };
  const paint = (drag: Gesture) => {
    const position = positionAt(drag);
    setPreview((previous) => ({
      ...dragCardAt(drag),
      position: position ?? previous?.position ?? order.indexOf(drag.id),
    }));
  };
  const scrollAtEdge = () => {
    const drag = gesture.current;
    const viewport = getScroller();
    const laneBounds = root.current?.getBoundingClientRect();
    if (!drag?.started || !viewport || !laneBounds) return;
    if (drag.y >= laneBounds.top && drag.y <= laneBounds.bottom) {
      const bounds = viewport.getBoundingClientRect();
      const edge = 28;
      const left = viewport.scrollLeft;
      if (drag.x < bounds.left + edge && laneBounds.left < bounds.left) viewport.scrollLeft -= 8;
      if (drag.x > bounds.right - edge && laneBounds.right > bounds.right) viewport.scrollLeft += 8;
      if (left !== viewport.scrollLeft) paint(drag);
    }
    frame.current = requestAnimationFrame(scrollAtEdge);
  };
  const start = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    const laneBody = root.current;
    const viewport = getScroller();
    const box = event.currentTarget.closest('.note-grid-cell')?.getBoundingClientRect();
    if (!laneBody || !viewport || !box || event.button !== 0 || gesture.current) return;
    event.preventDefault();
    setLanding(null);
    // Measure the original slots once so a sliding neighbor cannot flip the target back.
    const slots = Array.from(laneBody.querySelectorAll('[data-ribbon-handle]'), (handle) => {
      const rect = handle.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    laneBody.setPointerCapture(event.pointerId);
    gesture.current = {
      id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY, box, slots, scrollStart: viewport.scrollLeft, started: false,
    };
  };
  const track = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.started) {
      if (Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 5) return;
      drag.started = true;
      frame.current = requestAnimationFrame(scrollAtEdge);
    }
    paint(drag);
  };
  const save = (id: string, position: number) => {
    const next = moveRibbonItem(order, id, position);
    if (next !== order) onSave(next, byId.get(id)?.label + ', posição ' + (position + 1) + '.');
  };
  const cancel = () => {
    const drag = gesture.current;
    gesture.current = null;
    cancelAnimationFrame(frame.current);
    if (drag && root.current?.hasPointerCapture(drag.pointer)) root.current.releasePointerCapture(drag.pointer);
    setPreview(null);
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    const released = event.type === 'pointerup';
    const last = released ? { ...drag, x: event.clientX, y: event.clientY } : drag;
    const position = drag.started && released ? positionAt(last) : null;
    if (drag.started && released && animate) setLanding(dragCardAt(last));
    cancel();
    if (position !== null) save(drag.id, position);
  };
  const keyMove = (event: KeyboardEvent<HTMLButtonElement>, id: string, index: number) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
      setLanding(null);
      endEditing();
      return;
    }
    const steps: Partial<Record<string, number>> = flow === 'horizontal' ? { ArrowLeft: -1, ArrowRight: 1 }
      : flow === 'vertical' ? { ArrowUp: -1, ArrowDown: 1 }
      : { ArrowLeft: -2, ArrowRight: 2, ArrowUp: -1, ArrowDown: 1 };
    const step = steps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    save(id, Math.max(0, Math.min(order.length - 1, index + step)));
    requestAnimationFrame(() => {
      Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[data-ribbon-handle]') ?? [])
        .find((handle) => handle.dataset.ribbonHandle === id)?.focus();
    });
  };

  return <div ref={root} className="note-ribbon-lane" data-flow={flow}
    onPointerMove={track} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
    {displayed.map((id, index) => {
      const item = byId.get(id)!;
      return <motion.div key={id} className="note-grid-cell" data-ribbon-cell={id}
        data-moving={preview?.id === id} layout={editing && animate && floating?.id !== id ? 'position' : false}
        transition={{ layout: springs.layout }}
        style={{ gridColumn: flow === 'horizontal' ? 'span ' + (item.span ?? 1) : undefined }}>
        <div className="note-grid-control">{item.control}</div>
        {editing && <button type="button" className="note-grid-grip" data-ribbon-handle={id}
          aria-label={'Mover ' + item.label} title={'Arraste para mover ' + item.label}
          onPointerDown={(event) => start(event, id)} onKeyDown={(event) => keyMove(event, id, index)} />}
      </motion.div>;
    })}
    {editing && floating && createPortal(<motion.div className="note-ribbon-dragged" aria-hidden="true"
      data-landing={!!landing?.target} initial={false}
      style={{ left: floating.x, top: floating.y, width: floating.width, height: floating.height }}
      animate={landing?.target ? { x: landing.target.left - landing.x, y: landing.target.top - landing.y, opacity: 0 } : undefined}
      transition={{ duration: .24, ease: [.2, .75, .3, 1] }}
      onAnimationComplete={() => setLanding((current) => current === landing ? null : current)}>
      <span>{byId.get(floating.id)?.label}</span>
    </motion.div>, document.body)}
  </div>;
}

export function RibbonGrid({ sections, extra }: { sections: RibbonSection[]; extra: ReactNode }) {
  const { data, updateProfile } = useApp();
  const reduce = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const actions = useRef<HTMLDivElement>(null);
  const saved = data.profile.ribbonOrder;
  const endEditing = () => {
    setEditing(false);
    actions.current?.querySelector('button')?.focus();
  };

  return <>
    <motion.div layoutScroll className="note-ribbon-scroll" tabIndex={0} role="group" aria-label="Barra avançada em grade" data-editing={editing}>
      {sections.map((section) => <div key={section.id} className="note-ribbon-section" data-section={section.id} role="group" aria-label={section.label}>
        {section.fixed}
        {section.lanes.map((lane) => <RibbonLane key={lane.id} lane={lane} editing={editing}
          animate={!reduce && !data.profile.reducedMotion} saved={saved?.[lane.id] ?? saved?.legacy}
          endEditing={endEditing} onSave={(order, message) => {
            const next = Object.fromEntries(sections.flatMap(({ lanes }) => lanes.map((item) =>
              [item.id, item.id === lane.id ? order : resolveRibbonLane(item.cells.map(({ id }) => id), saved?.[item.id] ?? saved?.legacy)])));
            updateProfile({ ribbonOrder: next });
            setAnnouncement(message);
          }} />)}
      </div>)}
      <div className="note-ribbon-section note-ribbon-extra" role="group" aria-label="Mais ferramentas">{extra}</div>
    </motion.div>
    <div ref={actions} className="note-ribbon-actions">
      <IconButton label={editing ? 'Concluir organização da barra' : 'Reordenar ferramentas'}
        aria-pressed={editing} onMouseDown={(event) => event.preventDefault()}
        onClick={() => setEditing(!editing)}>{editing ? <Check size={18} /> : <ArrowLeftRight size={18} />}</IconButton>
    </div>
    <span role="status" className="visually-hidden">{announcement}</span>
  </>;
}
