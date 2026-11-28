import { useReducedMotion } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';
import { useApp } from '../state/AppState';

export function ControlValue({ value }: { value: string }) {
  const reducedMotion = useReducedMotion();
  const { data } = useApp();
  const reduce = !!reducedMotion || data.profile.reducedMotion;
  const label = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);

  useLayoutEffect(() => {
    const changed = previous.current !== value;
    previous.current = value;
    if (!changed || reduce) return;
    const animation = label.current?.animate?.([{ opacity: .65 }, { opacity: 1 }], { duration: 120 });
    return () => animation?.cancel();
  }, [reduce, value]);

  return <span className="ds-control-value" aria-hidden="true"><span ref={label}>{value}</span></span>;
}
