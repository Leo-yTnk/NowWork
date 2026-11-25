import { motion, useReducedMotion } from 'motion/react';
import { Children, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { springs } from '../lib/motion';
import { useApp } from '../state/AppState';
import { ArrowUpRight, Inbox, Plus } from 'lucide-react';

type ButtonProps = Omit<ComponentPropsWithoutRef<typeof motion.button>, 'children' | 'size'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  children: ReactNode;
};

export function Button({ variant = 'secondary', size = 'md', icon, children, className = '', ...rest }: ButtonProps) {
  const prefersReducedMotion = useReducedMotion();
  const { data } = useApp();
  const reduce = !!prefersReducedMotion || data.profile.reducedMotion;
  return <motion.button type="button" {...rest}
    whileTap={reduce ? undefined : { scale: 0.97 }}
    transition={reduce ? { duration: 0 } : springs.press}
    className={'btn btn-' + variant + ' btn-' + size + ' ' + className}>
    {icon}{children}
  </motion.button>;
}

export function CreateButton(props: Omit<ButtonProps, 'variant' | 'icon' | 'size'>) {
  return <Button {...props} variant="primary" icon={<Plus size={16} />} className={'btn-create ' + (props.className ?? '')} />;
}

export function Surface({ children, className = '', layout = false, variant }: {
  children: ReactNode; className?: string; layout?: boolean; variant?: 'outlined' | 'grouped' | 'editorial';
}) {
  const reduce = useReducedMotion();
  const { data } = useApp();
  return <motion.section layout={layout && !reduce && !data.profile.reducedMotion ? 'position' : false}
    transition={springs.layout} className={'surface ' + className} data-variant={variant}>{children}</motion.section>;
}

export function SettingsGroup({ title, children, danger = false }: { title: string; children: ReactNode; danger?: boolean }) {
  const id = useId();
  return <section className={'settings-group' + (danger ? ' danger-zone' : '')} aria-labelledby={id}>
    <h3 className="settings-group-title" id={id}>{title}</h3>
    <div className="grouped-list">{Children.map(children, (child) => child && <div className="grouped-row">{child}</div>)}</div>
  </section>;
}

export function Switch({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (value: boolean) => void;
}) {
  const descriptionId = useId();
  return <label className="toggle-row">
    <span><strong>{label}</strong>{description && <small id={descriptionId}>{description}</small>}</span>
    <input className="ds-switch" type="checkbox" role="switch" aria-label={label} checked={checked}
      aria-describedby={description ? descriptionId : undefined}
      onChange={(event) => onChange(event.target.checked)} />
  </label>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state">
    <div className="empty-icon">{icon || <Inbox size={23} strokeWidth={1.6} />}</div>
    <h3>{title}</h3><p>{description}</p>{action && <div className="empty-action">{action}</div>}
  </div>;
}

export function SectionHeader({ label, trailing }: { label: string; trailing?: ReactNode }) {
  return <div className="section-heading"><h2>{label}</h2>{trailing}</div>;
}

export function Stat({ value, label, symbol }: { value: string | number; label: string; symbol?: ReactNode }) {
  return <div className="stat"><div className="stat-value">{symbol}{value}</div><div className="stat-label">{label}</div></div>;
}

export function KindPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'teal' | 'amber' | 'purple' }) {
  return <span className={'kind-pill kind-' + tone}>{children}</span>;
}

export function ExternalHint({ children }: { children: ReactNode }) {
  return <span className="external-hint">{children}<ArrowUpRight size={13} /></span>;
}

export function Stack({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={'ds-stack ' + className}>{children}</div>;
}

export function Toolbar({ children, label, className = '' }: { children: ReactNode; label?: string; className?: string }) {
  return <div className={'ds-toolbar ' + className} role={label ? 'group' : undefined} aria-label={label}>{children}</div>;
}

export function IconButton({ label, children, ...props }: Omit<ButtonProps, 'children' | 'aria-label'> & { label: string; children: ReactNode }) {
  return <Button {...props} aria-label={label} title={label} variant={props.variant || 'ghost'} size="sm"
    className={'ds-icon-button ' + (props.className || '')}>{children}</Button>;
}

export function PageHeading({ title, description, icon, action }: { title: string; description?: string; icon?: ReactNode; action?: ReactNode }) {
  return <header className="ds-page-heading"><div className="ds-page-heading-main">{icon}<div>
    <h1>{title}</h1>{description && <p>{description}</p>}</div></div>{action && <div className="ds-page-actions">{action}</div>}</header>;
}

export function Segment<T extends string>({ label, options, value, onChange, className = '' }: {
  label: string; options: readonly { id: T; label: ReactNode }[]; value: T; onChange: (value: T) => void; className?: string;
}) {
  return <div className={'ds-segment ' + className} role="group" aria-label={label}>
    {options.map((item) => <Button key={item.id} variant="ghost" size="sm" aria-pressed={item.id === value}
      onClick={() => onChange(item.id)}>{item.label}</Button>)}
  </div>;
}
