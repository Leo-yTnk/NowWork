import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Check, Grip, GripHorizontal } from 'lucide-react';
import { IconButton } from '../components/ui';
import { moveRibbonItem, resolveRibbonOrder, type RibbonPosition } from '../lib/ribbonOrder';
import { useApp } from '../state/AppState';

export type RibbonCell = { id: string; label: string; control: ReactNode; span?: number };

type Drag = {
  pointer: number; id: string; startX: number; startY: number; scrollStart: number; scrollLimit: number;
  x: number; y: number; started: boolean;
};
type Preview = { id: string; x: number; y: number; target: RibbonPosition | null };

export function RibbonGrid({ rows, extra }: { rows: [RibbonCell[], RibbonCell[]]; extra: ReactNode }) {
  const { data, updateProfile } = useApp();
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const scroll = useRef<HTMLDivElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const gesture = useRef<Drag | null>(null);
  const frame = useRef(0);
  const cells = new Map(rows.flat().map((item) => [item.id, item]));
  const order = resolveRibbonOrder([rows[0].map(({ id }) => id), rows[1].map(({ id }) => id)], data.profile.ribbonOrder);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const locate = (drag: Drag): RibbonPosition | null => {
    const viewport = scroll.current;
    if (!viewport) return null;
    const rect = viewport.getBoundingClientRect();
    if (drag.y < rect.top || drag.y > rect.bottom || drag.x < rect.left || drag.x > rect.right) return null;
    const strips = viewport.querySelectorAll<HTMLElement>('.note-grid-row');
    const row = drag.y < strips[1].getBoundingClientRect().top ? 0 : 1;
    const targets = Array.from(strips[row].children).filter((item) => item.getAttribute('data-ribbon-cell') !== drag.id);
    const before = targets.findIndex((item) => {
      const { left, width } = item.getBoundingClientRect();
      return drag.x < left + width / 2;
    });
    return { row, index: before < 0 ? targets.length : before };
  };

  const show = (drag: Drag) => {
    if (!scroll.current) return;
    setPreview({
      id: drag.id,
      x: drag.x - drag.startX + scroll.current.scrollLeft - drag.scrollStart,
      y: drag.y - drag.startY,
      target: locate(drag),
    });
  };

  const scrollWhileDragging = () => {
    const drag = gesture.current;
    const viewport = scroll.current;
    if (!drag?.started || !viewport) return;
    const rect = viewport.getBoundingClientRect();
    if (drag.y >= rect.top && drag.y <= rect.bottom) {
      const start = viewport.scrollLeft;
      const edge = 32;
      if (drag.x < rect.left + edge) viewport.scrollLeft -= 9;
      if (drag.x > rect.right - edge) viewport.scrollLeft = Math.min(drag.scrollLimit, start + 9);
      if (start !== viewport.scrollLeft) show(drag);
    }
    frame.current = requestAnimationFrame(scrollWhileDragging);
  };

  const start = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    const viewport = scroll.current;
    if (!viewport || event.button !== 0 || gesture.current) return;
    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);
    gesture.current = {
      pointer: event.pointerId, id, startX: event.clientX, startY: event.clientY,
      scrollStart: viewport.scrollLeft, scrollLimit: viewport.scrollWidth - viewport.clientWidth, x: event.clientX, y: event.clientY, started: false,
    };
  };
  const track = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || event.pointerId !== drag.pointer) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.started) {
      if (Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 5) return;
      drag.started = true;
      frame.current = requestAnimationFrame(scrollWhileDragging);
    }
    show(drag);
  };
  const move = (id: string, target: RibbonPosition) => {
    const next = moveRibbonItem(order, id, target);
    if (next.every((row, i) => row.join('\n') === order[i].join('\n'))) return;
    updateProfile({ ribbonOrder: next });
    setAnnouncement(cells.get(id)?.label + ', linha ' + (target.row + 1) + ', posição ' + (target.index + 1) + '.');
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || event.pointerId !== drag.pointer) return;
    gesture.current = null;
    cancelAnimationFrame(frame.current);
    setPreview(null);
    if (!drag.started || event.type !== 'pointerup') return;
    const target = locate({ ...drag, x: event.clientX, y: event.clientY });
    if (target) move(drag.id, target);
  };

  const keyMove = (event: KeyboardEvent<HTMLButtonElement>, id: string, row: 0 | 1, index: number) => {
    const { key } = event;
    if (key === 'Escape') {
      event.preventDefault();
      setEditing(false);
      actions.current?.querySelector('button')?.focus();
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return;
    event.preventDefault();
    const rowTarget = key === 'ArrowUp' ? 0 : key === 'ArrowDown' ? 1 : row;
    const shift = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
    const last = order[rowTarget].length - (rowTarget === row ? 1 : 0);
    move(id, { row: rowTarget, index: Math.max(0, Math.min(last, index + shift)) });
    requestAnimationFrame(() => {
      Array.from(scroll.current?.querySelectorAll<HTMLButtonElement>('[data-ribbon-handle]') ?? [])
        .find((handle) => handle.dataset.ribbonHandle === id)?.focus();
    });
  };

  return <>
    <div ref={scroll} className="note-ribbon-scroll" tabIndex={0} role="group" aria-label="Barra avançada em grade"
      onPointerMove={track} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
      <div className="note-ribbon-grid" data-editing={editing}>
        {([0, 1] as const).map((row) => {
          const destination = preview?.target?.row === row ? preview.target.index : null;
          const remaining = order[row].filter((id) => id !== preview?.id);
          return <div key={row} className="note-grid-row" data-drop-end={destination === remaining.length}>
            {order[row].map((id, index) => {
              const item = cells.get(id)!;
              const moving = preview?.id === id;
              return <div key={id} className="note-grid-cell" data-ribbon-cell={id} data-moving={moving}
                data-drop-before={destination !== null && remaining[destination] === id}
                style={{ gridColumn: 'span ' + (item.span ?? 1), translate: moving ? preview.x + 'px ' + preview.y + 'px' : undefined }}>
                <div className="note-grid-control" inert={editing}>{item.control}</div>
                {editing && <button type="button" className="note-grid-grip" data-ribbon-handle={id}
                  aria-label={'Mover ' + item.label} title={'Arraste para mover ' + item.label}
                  onPointerDown={(event) => start(event, id)} onKeyDown={(event) => keyMove(event, id, row, index)}>
                  <GripHorizontal size={15} aria-hidden="true" />
                </button>}
              </div>;
            })}
          </div>;
        })}
      </div>
    </div>
    <div ref={actions} className="note-ribbon-extra" role="group" aria-label="Mais ferramentas">
      <IconButton label={editing ? 'Concluir organização da barra' : 'Reordenar ferramentas'}
        aria-pressed={editing} onClick={() => setEditing(!editing)}>{editing ? <Check size={18} /> : <Grip size={18} />}</IconButton>
      {extra}
    </div>
    <span role="status" className="visually-hidden">{announcement}</span>
  </>;
}
