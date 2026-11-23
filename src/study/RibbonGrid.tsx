import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { ArrowLeftRight, Check } from 'lucide-react';
import { IconButton } from '../components/ui';
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
type Preview = { id: string; position: number; x: number; y: number };
type Slot = { x: number; y: number; moving: boolean };

const translate = (x: number, y: number) => 'translate3d(' + x + 'px,' + y + 'px,0)';

function useRibbonMovement(root: { current: HTMLDivElement | null }, preview: Preview | null, animate: boolean) {
  const slots = useRef(new Map<string, Slot>());
  const running = useRef(new Map<string, Animation>());

  useLayoutEffect(() => {
    const next = new Map<string, Slot>();
    const updates: { id: string; item: HTMLElement; x: number; y: number; moving: boolean; wasMoving: boolean }[] = [];
    for (const cell of Array.from(root.current?.children ?? []) as HTMLElement[]) {
      const id = cell.dataset.ribbonCell;
      const item = cell.firstElementChild as HTMLElement;
      if (!id || !item) continue;
      const before = slots.current.get(id);
      const position = { x: cell.offsetLeft, y: cell.offsetTop, moving: preview?.id === id };
      next.set(id, position);
      if (position.moving && preview) {
        const box = cell.getBoundingClientRect();
        updates.push({ id, item, x: preview.x - box.left, y: preview.y - box.top, moving: true, wasMoving: true });
      } else if (before && (before.moving || before.x !== position.x || before.y !== position.y || (!animate && running.current.has(id)))) {
        // Preserve the on-screen position even if the previous slide is still in flight.
        const box = cell.getBoundingClientRect();
        const visual = item.getBoundingClientRect();
        updates.push({
          id, item, x: before.x - position.x + visual.left - box.left,
          y: before.y - position.y + visual.top - box.top, moving: false, wasMoving: before.moving,
        });
      }
    }
    slots.current = next;

    for (const { id, item, x, y, moving, wasMoving } of updates) {
      running.current.get(id)?.cancel();
      running.current.delete(id);
      item.style.transform = moving ? translate(x, y) : '';
      item.style.zIndex = moving ? '2' : '';
      if (moving || !animate || Math.hypot(x, y) < 1) continue;
      if (wasMoving) item.style.zIndex = '2';
      const animation = item.animate([
        { transform: translate(x, y) },
        { transform: translate(0, 0) },
      ], { duration: 280, easing: 'cubic-bezier(.2,.75,.3,1)' });
      running.current.set(id, animation);
      animation.onfinish = () => {
        item.style.zIndex = '';
        running.current.delete(id);
      };
    }
  });

  useEffect(() => {
    const animations = running.current;
    return () => {
      animations.forEach((animation) => animation.cancel());
      animations.clear();
    };
  }, []);
}

function RibbonLane({ lane, editing, saved, onSave, endEditing, animate }: {
  lane: Lane; editing: boolean; saved?: string[]; onSave: (order: string[], message: string) => void;
  endEditing: () => void; animate: boolean;
}) {
  const { flow = 'horizontal', cells } = lane;
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const order = resolveRibbonLane(cells.map(({ id }) => id), saved);
  const displayed = preview ? moveRibbonItem(order, preview.id, preview.position) : order;
  useRibbonMovement(root, preview, editing && animate);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const getScroller = () => root.current?.closest<HTMLElement>('.note-ribbon-scroll');
  const positionAt = (drag: Gesture) => {
    const viewport = getScroller();
    const bounds = root.current?.getBoundingClientRect();
    if (!viewport || !bounds) return null;
    const dx = viewport.scrollLeft - drag.scrollStart + drag.box.right - drag.startX;
    const dy = drag.box.top - drag.startY;
    if (drag.x < bounds.left || drag.x > bounds.right || drag.y < bounds.top || drag.y > bounds.bottom) return null;
    const distance = (slot: Gesture['slots'][number]) => {
      const x = flow === 'vertical' ? 0 : drag.x + dx - slot.x;
      const y = flow === 'horizontal' ? 0 : drag.y + dy - slot.y;
      return x * x + y * y;
    };
    return drag.slots.reduce((best, slot, index) => distance(slot) < distance(drag.slots[best]) ? index : best, 0);
  };
  const paint = (drag: Gesture) => {
    const position = positionAt(drag);
    setPreview((previous) => ({
      id: drag.id, x: drag.box.left + drag.x - drag.startX, y: drag.box.top + drag.y - drag.startY,
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
    const box = event.currentTarget.closest('.note-grid-item')?.getBoundingClientRect();
    if (!laneBody || !viewport || !box || event.button !== 0 || gesture.current) return;
    event.preventDefault();
    // Measure the original slots before any neighbors start sliding.
    const slots = Array.from(laneBody.children, (cell) => {
      const rect = cell.getBoundingClientRect();
      return { x: rect.right, y: rect.top };
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
    cancel();
    if (position !== null) save(drag.id, position);
  };
  const keyMove = (event: KeyboardEvent<HTMLButtonElement>, id: string, index: number) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
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
      return <div key={id} className="note-grid-cell" data-ribbon-cell={id}
        data-moving={preview?.id === id}
        style={{ gridColumn: flow === 'horizontal' ? 'span ' + (item.span ?? 1) : undefined }}>
        <div className="note-grid-item">
          <div className="note-grid-face">
            <div className="note-grid-control" inert={editing}>{item.control}</div>
            {editing && <button type="button" className="note-grid-grip" data-ribbon-handle={id}
              aria-label={'Mover ' + item.label} title={'Arraste para mover ' + item.label}
              onPointerDown={(event) => start(event, id)} onKeyDown={(event) => keyMove(event, id, index)} />}
          </div>
        </div>
      </div>;
    })}
  </div>;
}

export function RibbonGrid({ sections, extra, onEditingStart }: {
  sections: RibbonSection[]; extra?: ReactNode; onEditingStart: () => void;
}) {
  const { data, updateProfile } = useApp();
  const reduce = useReducedMotion();
  const animate = !reduce && !data.profile.reducedMotion;
  const [editing, setEditing] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const actions = useRef<HTMLDivElement>(null);
  const saved = data.profile.ribbonOrder;
  const endEditing = () => {
    setEditing(false);
    actions.current?.querySelector('button')?.focus();
  };

  return <>
    <div className="note-ribbon-scroll" tabIndex={0} role="group" aria-label="Barra avançada em grade"
      data-editing={editing} data-animate={animate}>
      {sections.map((section) => <div key={section.id} className="note-ribbon-section" data-section={section.id} role="group" aria-label={section.label}>
        {section.fixed && <div className="note-ribbon-fixed" inert={editing}>{section.fixed}</div>}
        {section.lanes.map((lane) => <RibbonLane key={lane.id} lane={lane} editing={editing}
          animate={animate} saved={saved?.[lane.id] ?? saved?.legacy}
          endEditing={endEditing} onSave={(order, message) => {
            const next = Object.fromEntries(sections.flatMap(({ lanes }) => lanes.map((item) =>
              [item.id, item.id === lane.id ? order : resolveRibbonLane(item.cells.map(({ id }) => id), saved?.[item.id] ?? saved?.legacy)])));
            updateProfile({ ribbonOrder: next });
            setAnnouncement(message);
          }} />)}
      </div>)}
      {extra && <div className="note-ribbon-section note-ribbon-extra" role="group" aria-label="Ferramentas contextuais" inert={editing}>{extra}</div>}
    </div>
    <div ref={actions} className="note-ribbon-actions">
      <IconButton label={editing ? 'Concluir organização da barra' : 'Reordenar ferramentas'}
        aria-pressed={editing} onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (!editing) onEditingStart();
          setEditing(!editing);
        }}>{editing ? <Check size={18} /> : <ArrowLeftRight size={18} />}</IconButton>
    </div>
    <span role="status" className="visually-hidden">{announcement}</span>
  </>;
}
