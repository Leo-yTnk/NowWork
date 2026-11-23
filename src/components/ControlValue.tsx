import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useApp } from '../state/AppState';

export function ControlValue({ value }: { value: string }) {
  const reducedMotion = useReducedMotion();
  const { data } = useApp();

  return <span className="ds-control-value" aria-hidden="true">
    {reducedMotion || data.profile.reducedMotion ? <span>{value}</span> :
      <AnimatePresence initial={false}>
        <motion.span key={value}
          initial={{ opacity: 0, filter: 'blur(2px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
          exit={{ opacity: 0, filter: 'blur(2px)' }}
          transition={{ duration: .16, ease: 'easeInOut' }}>{value}</motion.span>
      </AnimatePresence>}
  </span>;
}
