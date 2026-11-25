import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Ellipsis, House, LibraryBig, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings2, Timer } from 'lucide-react';
import { areas, routeHref, type Area } from '../lib/navigation';
import { springs } from '../lib/motion';
import { useApp } from '../state/AppState';
import { IconButton, Toolbar } from './ui';

const destinations = [
  { area: 'hoje', title: 'Hoje', Icon: House },
  { area: 'planejar', title: 'Planejar', Icon: CalendarDays },
  { area: 'materias', title: 'Matérias', Icon: LibraryBig },
  { area: 'estudar', title: 'Estudar', Icon: Timer },
] as const;

type NotebookNavigation = {
  sidebarId: string; toggleId: string; pagesOpen: boolean; togglePages: () => void;
  directoryHref: string; openOptions: () => void;
};

type BrowserNavigation = EventTarget & {
  currentEntry: { index: number } | null;
  entries: () => { url: string | null }[];
};

function useHistoryControls() {
  const navigation = (window as Window & { navigation?: BrowserNavigation }).navigation;
  const available = () => {
    if (!navigation) return { back: window.history.length > 1, forward: true };
    const index = navigation.currentEntry?.index ?? -1;
    const entries = navigation.entries();
    const inWorkspace = (offset: number) => {
      const url = index >= 0 ? entries[index + offset]?.url : null;
      if (!url) return false;
      const { origin, pathname } = new URL(url);
      return origin === window.location.origin && pathname === window.location.pathname;
    };
    return { back: inWorkspace(-1), forward: inWorkspace(1) };
  };
  const [history, setHistory] = useState(available);
  useEffect(() => {
    const sync = () => setHistory(available());
    sync();
    navigation?.addEventListener('currententrychange', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      navigation?.removeEventListener('currententrychange', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, [navigation]);
  return history;
}

function NavigationIndicator({ activeKey, className }: { activeKey?: string; className: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [bounds, setBounds] = useState<{ x: number; y: number; width: number }>();
  const reduced = useReducedMotion();
  const { data } = useApp();

  useLayoutEffect(() => {
    const nav = ref.current?.parentElement;
    const active = nav?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!nav || !active) { setBounds(undefined); return; }
    const measure = () => {
      const { offsetLeft: x, offsetTop: y, offsetWidth: width } = active;
      setBounds((last) => last?.x === x && last.y === y && last.width === width ? last : { x, y, width });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    nav.querySelectorAll('a').forEach((link) => observer.observe(link));
    return () => observer.disconnect();
  }, [activeKey]);

  return <span ref={ref} className="workspace-indicator-slot" aria-hidden="true">
    {bounds && <motion.span className={className} initial={false} animate={bounds}
      transition={reduced || data.profile.reducedMotion ? { duration: 0 } : springs.layout} />}
  </span>;
}

export function SectionContent({ activeIndex, children }: { activeIndex: number; children: ReactNode }) {
  const previous = useRef(activeIndex);
  const reduced = useReducedMotion();
  const { data } = useApp();
  const direction = Math.sign(activeIndex - previous.current);
  useLayoutEffect(() => { previous.current = activeIndex; }, [activeIndex]);
  const animate = direction !== 0 && !reduced && !data.profile.reducedMotion;

  return <motion.div key={activeIndex} initial={animate ? { opacity: .55, x: direction * 10 } : false}
    animate={{ opacity: 1, x: 0 }}
    transition={reduced || data.profile.reducedMotion ? { duration: 0 } : { duration: .24, ease: [.2, .75, .3, 1] }}>
    {children}
  </motion.div>;
}

export function WorkspaceNavigation({ current, search, settings, capture, shortcut, notebook }: {
  current: Area; search: () => void; settings: () => void; capture: () => void; shortcut: string; notebook?: NotebookNavigation;
}) {
  const history = useHistoryControls();
  return <header className="workspace-header">
    <div className="workspace-header-inner">
      <nav className="workspace-primary" aria-label="Navegação principal">
        <NavigationIndicator className="workspace-current" activeKey={current} />
        {destinations.map(({ area, title, Icon }) => <a key={area} href={routeHref(areas[area])} draggable={false} aria-label={title} aria-current={current === area ? 'page' : undefined}>
          <Icon size={17} aria-hidden="true" /><span className="workspace-tab-label" data-label={title}><span>{title}</span></span>
        </a>)}
      </nav>
      <Toolbar label="Histórico e páginas" className="workspace-history">
        <div className="workspace-sidebar-toggle" data-visible={!!notebook} aria-hidden={!notebook}>
          <IconButton id={notebook?.toggleId} label={notebook?.pagesOpen ? 'Recolher páginas da matéria' : 'Expandir páginas da matéria'}
            aria-expanded={notebook?.pagesOpen} aria-controls={notebook?.sidebarId} disabled={!notebook} onClick={notebook?.togglePages}>
            {notebook?.pagesOpen ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
          </IconButton>
        </div>
        <IconButton className="workspace-history-step" label={!history.back && notebook ? 'Voltar para páginas' : 'Voltar'} disabled={!history.back && !notebook}
          onClick={() => {
            if (history.back) window.history.back();
            else if (notebook) window.location.hash = notebook.directoryHref;
          }}><ArrowLeft size={18} /></IconButton>
        <IconButton className="workspace-history-step" label="Avançar" disabled={!history.forward} onClick={() => window.history.forward()}><ArrowRight size={18} /></IconButton>
      </Toolbar>
      <Toolbar label="Atalhos do NowWork" className="workspace-actions">
        <IconButton label="Captura rápida" aria-haspopup="dialog" aria-keyshortcuts={'Control+Shift+' + shortcut + ' Meta+Shift+' + shortcut} onClick={capture}><Plus size={21} /></IconButton>
        <IconButton label="Buscar no NowWork" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" onClick={search}><Search size={19} /></IconButton>
        <IconButton label="Configurações" aria-haspopup="dialog" onClick={settings}><Settings2 size={19} /></IconButton>
        {notebook && <IconButton label="Opções da página" aria-haspopup="dialog" onClick={notebook.openOptions}><Ellipsis size={21} /></IconButton>}
      </Toolbar>
    </div>
  </header>;
}

export function SectionNavigation({ label, links }: { label: string; links: readonly { label: string; href: string; active: boolean }[] }) {
  return <nav className="workspace-sections" aria-label={label}>
    <NavigationIndicator className="workspace-section-indicator" activeKey={links.find((link) => link.active)?.href} />
    {links.map(({ label, href, active }) => <a key={href} href={href} draggable={false} aria-current={active ? 'page' : undefined}>
      <span className="workspace-tab-label" data-label={label}><span>{label}</span></span>
    </a>)}
  </nav>;
}
