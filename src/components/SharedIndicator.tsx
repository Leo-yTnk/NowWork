import { motion, useReducedMotion } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { springs } from '../lib/motion';
import { useApp } from '../state/AppState';

type Bounds = { x: number; y: number; width: number; height?: number };

export function SharedIndicator({ activeKey, marker, className }: {
  activeKey?: string;
  marker: 'page' | 'pressed';
  className: string;
}) {
  const slot = useRef<HTMLSpanElement>(null);
  const [bounds, setBounds] = useState<Bounds>();
  const reduced = useReducedMotion();
  const { data } = useApp();

  useLayoutEffect(() => {
    const group = slot.current?.parentElement;
    if (!group) return;
    const selector = marker === 'page' ? ':scope > a[aria-current="page"]' : ':scope > button[aria-pressed="true"]';
    const measure = () => {
      const active = group.querySelector<HTMLElement>(selector);
      if (!active) {
        setBounds(undefined);
        return;
      }
      const { offsetLeft: x, offsetTop: y, offsetWidth: width, offsetHeight } = active;
      const height = marker === 'pressed' ? offsetHeight : undefined;
      setBounds((last) => last?.x === x && last.y === y && last.width === width && last.height === height
        ? last : { x, y, width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    group.querySelectorAll(':scope > a, :scope > button').forEach((control) => observer.observe(control));
    return () => observer.disconnect();
  }, [activeKey, marker]);

  return <span ref={slot} className="ds-indicator-slot" aria-hidden="true">
    {bounds && <motion.span className={'ds-shared-indicator ' + className} initial={false} animate={bounds}
      transition={reduced || data.profile.reducedMotion ? { duration: 0 } : springs.layout} />}
  </span>;
}
