import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, KeyboardOff, List, Type } from 'lucide-react';
import { Button, IconButton } from '../components/ui';
import { springs } from '../lib/motion';
import { useApp } from '../state/AppState';

export interface EditorAction {
  label: string;
  icon: ReactNode;
  pressed?: boolean | 'mixed';
  disabled?: boolean;
  run: () => void;
}

export function EditorActionButton({ action }: { action: EditorAction }) {
  return <IconButton label={action.pressed === 'mixed' ? action.label + ' (Misto)' : action.label} aria-pressed={action.pressed} disabled={action.disabled}
    onMouseDown={(event) => event.preventDefault()} onClick={action.run}>{action.icon}</IconButton>;
}

export function useMobileEditor() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 800px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 800px)');
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return mobile;
}

function useKeyboardInset(enabled: boolean) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!enabled || !viewport) { setInset(0); return; }
    const update = () => {
      const gap = window.innerHeight - viewport.height - viewport.offsetTop;
      setInset(Math.abs(viewport.scale - 1) < .05 && gap > 85 ? Math.round(gap) : 0);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [enabled]);
  return inset;
}

export interface ToolGroup { label: string; rows: ReactNode[] }
export interface ToolCategory { id: string; label: string; icon: ReactNode; groups: ToolGroup[] }

function ToolGroups({ groups }: { groups: ToolGroup[] }) {
  return <div className="note-tool-groups">
    {groups.map(({ label, rows }) => <div key={label} className="note-tool-group" role="group" aria-label={label}>
      <span className="note-tool-label" aria-hidden="true">{label}</span>
      {rows.map((row, index) => <div key={index} className="note-tool-row">{row}</div>)}
    </div>)}
  </div>;
}

export function NotebookToolbar({ simple, ribbon, insertion, reorderActions, supplemental, categories, mobile, panel, setPanel, extra, dismissKeyboard, clearExtra }: {
  simple: { history: ReactNode; text: ReactNode; lists: ReactNode; insertIcon: ReactNode };
  ribbon: ReactNode; insertion: ReactNode; reorderActions: ReactNode; supplemental: ToolGroup[]; categories: ToolCategory[]; mobile: boolean; panel: string | null; setPanel: (panel: string | null) => void; extra?: ReactNode;
  dismissKeyboard: () => void; clearExtra: () => void;
}) {
  const [simpleCategory, setSimpleCategory] = useState('format');
  const root = useRef<HTMLDivElement>(null);
  const [narrowToolbar, setNarrowToolbar] = useState(false);
  const compact = mobile || narrowToolbar;
  const trigger = useRef<HTMLElement>(null);
  const inset = useKeyboardInset(mobile);
  const reduced = useReducedMotion();
  const { data } = useApp();
  const { toolbarMode, reducedMotion } = data.profile;
  const advanced = toolbarMode === 'advanced';
  const animate = !reduced && !reducedMotion;
  const context = categories.find(({ id }) => id === 'context');
  const selected = categories.find(({ id }) => id === (advanced || panel === 'context' ? panel : simpleCategory)) ?? categories[0];
  const open = !!extra || panel === 'more' || panel === 'text' || panel === 'lists' || (panel === 'context' && !!context);
  const extraRef = useRef(clearExtra);
  extraRef.current = clearExtra;

  useEffect(() => {
    const element = root.current;
    if (mobile || !element) return;
    const update = () => setNarrowToolbar(element.clientWidth < 560);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [mobile]);

  useEffect(() => { setPanel(null); extraRef.current(); }, [toolbarMode, mobile, compact, setPanel]);
  useEffect(() => {
    if (!open && panel !== 'insert') return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.ds-select-content')) return;
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        setPanel(null);
        extraRef.current();
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.target instanceof Element && event.target.closest('[role="dialog"], .document-link-form, .ds-select-content')) return;
      event.preventDefault();
      event.stopPropagation();
      setPanel(null);
      extraRef.current();
      if (root.current?.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open, panel, setPanel]);

  const togglePanel = (id: string, button: HTMLElement) => {
    trigger.current = button;
    clearExtra();
    setPanel(panel === id && !extra ? null : id);
  };
  const categoryButton = ({ id, label, icon }: ToolCategory) => <Button key={id} variant="ghost" size="sm"
    aria-label={label} title={label} icon={icon}
    aria-expanded={panel === id && open} onMouseDown={(event) => event.preventDefault()}
    onClick={(event) => togglePanel(id, event.currentTarget)}><span>{label}</span></Button>;
  const formatPanel = panel === 'text' || panel === 'lists'
    ? <div className="note-tool-row">{panel === 'text' ? simple.text : simple.lists}</div>
    : <>
      {!advanced && panel !== 'context' && <div className="note-category-row" role="group" aria-label="Categorias de ferramentas">
        {categories.map(({ id, label }) => <Button key={id} variant="ghost" size="sm" aria-pressed={id === selected.id}
          onMouseDown={(event) => event.preventDefault()} onClick={() => setSimpleCategory(id)}>{label}</Button>)}
      </div>}
      <ToolGroups groups={advanced && panel === 'more' ? supplemental : selected.groups} />
    </>;

  const insert = <IconButton label={panel === 'insert' ? 'Voltar às ferramentas' : 'Inserir'} aria-pressed={panel === 'insert'} onMouseDown={(event) => event.preventDefault()}
    onClick={(event) => togglePanel('insert', event.currentTarget)}>{panel === 'insert' ? <ArrowLeft size={19} /> : simple.insertIcon}</IconButton>;
  const more = <IconButton label="Mais ferramentas" aria-expanded={panel === 'more'} onMouseDown={(event) => event.preventDefault()}
    onClick={(event) => togglePanel('more', event.currentTarget)}><strong>Aa</strong></IconButton>;

  const bar = <div ref={root} className={mobile ? 'note-controls note-dock' : 'note-controls note-toolbar'}
    style={mobile && inset ? { bottom: inset + 8, '--note-keyboard-inset': inset + 'px' } as CSSProperties : undefined}>
    <div className={'note-command-bar' + (advanced ? ' note-command-advanced' : '')} role="group" aria-label="Ferramentas do caderno">
      {advanced ? <div className="note-ribbon-scroll" tabIndex={0} role="group" aria-label="Barra avançada rolável">
        <div className="note-history-group" role="group" aria-label="Histórico">{simple.history}</div>
        {ribbon}
        <div className="note-ribbon-end">{insertion}<div className="note-reorder-actions" role="group" aria-label="Mover bloco">{reorderActions}</div></div>
        <div className="note-ribbon-extra" role="group" aria-label="Mais ferramentas">
          {more}{context && categoryButton(context)}
        </div>
      </div> : panel === 'insert' ? <div className="note-simple-insertion">{insert}{insertion}<div className="note-reorder-actions" role="group" aria-label="Mover bloco">{reorderActions}</div></div>
      : <div className="note-command-scroll">
        <div className="note-command-group">{simple.history}</div>
        {compact ? <div className="note-command-group">
          {([['text', 'Texto', Type], ['lists', 'Listas', List]] as const).map(([id, label, Icon]) =>
            <IconButton key={id} label={label} aria-expanded={panel === id && !extra} onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => togglePanel(id, event.currentTarget)}><Icon size={19} /></IconButton>)}
        </div> : <>
          <div className="note-command-group">{simple.text}</div>
          <div className="note-command-group">{simple.lists}</div>
        </>}
        <div className="note-command-group">{insert}{reorderActions}{more}{context &&
          <IconButton label={context.label} aria-expanded={panel === 'context' && open} onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => togglePanel('context', event.currentTarget)}>{context.icon}</IconButton>}
        </div>
      </div>}
      {mobile && inset > 0 && <IconButton label="Recolher teclado" onMouseDown={(event) => event.preventDefault()}
        onClick={dismissKeyboard}><KeyboardOff size={18} /></IconButton>}
    </div>
    <AnimatePresence initial={false}>
      {open && <motion.div key="tools" className="note-tool-panel"
        style={{ transformOrigin: mobile ? 'bottom center' : 'top center' }}
        initial={animate ? { opacity: 0, y: mobile ? 8 : -6, scale: .98 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }} exit={animate ? { opacity: 0, scale: .98 } : undefined}
        transition={animate ? springs.panel : { duration: 0 }}>
        {extra || formatPanel}
      </motion.div>}
    </AnimatePresence>
  </div>;

  return mobile ? createPortal(bar, document.body) : bar;
}
