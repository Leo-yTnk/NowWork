import { lazy, Suspense, useEffect, useRef, useState, type ComponentPropsWithoutRef, type FormEvent } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { BookOpen, FilePenLine, FileText, Pencil, Trash2 } from 'lucide-react';
import { Button, CreateButton, EmptyState, Segment, Stack, Surface, Toolbar } from '../components/ui';
import { ElasticSheet } from '../components/ElasticSheet';
import { fromBlocks, noteText } from '../lib/documents';
import { routeHref } from '../lib/navigation';
import { useApp } from '../state/AppState';
import { uid } from '../types';
import { EditorTypographySettings } from './EditorTypographySettings';
import { SubjectMark } from './Subjects';
const RichTextEditor = lazy(() => import('./RichTextEditor').then((module) => ({ default: module.RichTextEditor })));

type PageControls = {
  mobile: boolean; pagesOpen: boolean; sidebarId: string; closePages: () => void;
  optionsOpen: boolean; closeOptions: () => void;
};

function PageLink({ onEdit, onRename, onClick, ...props }: ComponentPropsWithoutRef<'a'> & {
  onEdit: () => void; onRename: () => void;
}) {
  const link = useRef<HTMLAnchorElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuOpen = useRef(false);
  const selected = useRef(false);
  const run = (action: () => void) => {
    selected.current = true;
    link.current?.focus({ preventScroll: true });
    action();
  };

  return <ContextMenu.Root modal={false} onOpenChange={(open) => {
    menuOpen.current = open;
    if (open) selected.current = false;
  }}>
    <ContextMenu.Trigger asChild>
      <a {...props} ref={link} aria-haspopup="menu" aria-keyshortcuts="Shift+F10" onKeyDown={(event) => {
        if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
        event.preventDefault();
        const { left, bottom } = event.currentTarget.getBoundingClientRect();
        event.currentTarget.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true, cancelable: true, clientX: left, clientY: bottom,
        }));
      }} onClick={(event) => {
        if (menuOpen.current) {
          event.preventDefault();
          menu.current?.focus({ preventScroll: true });
          return;
        }
        onClick?.(event);
      }} />
    </ContextMenu.Trigger>
    <ContextMenu.Portal>
      <ContextMenu.Content ref={menu} className="ds-popup ds-context-menu" collisionPadding={8} aria-label="Ações da página"
        onFocusOutside={(event) => { if (event.target === link.current) event.preventDefault(); }}
        onCloseAutoFocus={(event) => { if (selected.current) event.preventDefault(); }}>
        <ContextMenu.Item className="ds-context-option" onSelect={() => run(onEdit)}>
          <FilePenLine size={16} aria-hidden="true" />Editar
        </ContextMenu.Item>
        <ContextMenu.Item className="ds-context-option" onSelect={() => run(onRename)}>
          <Pencil size={16} aria-hidden="true" />Renomear
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Portal>
  </ContextMenu.Root>;
}

export function Notebook({ subjectId, noteId, open, pageControls }: {
  subjectId: string; noteId?: string; open: (id?: string) => void; pageControls?: PageControls;
}) {
  const app = useApp();
  const [title, setTitle] = useState('');
  const [widthSettings, setWidthSettings] = useState<HTMLDivElement | null>(null);
  const [rename, setRename] = useState<{ id: string; title: string } | null>(null);
  const { mobile, pagesOpen } = pageControls ?? {};
  const sidebar = useRef<HTMLElement>(null);
  const subject = app.data.subjects.find(({ id }) => id === subjectId);
  const notes = app.data.notes.filter((note) => note.subjectId === subjectId);
  const note = notes.find(({ id }) => id === noteId);
  useEffect(() => {
    if (mobile && pagesOpen) sidebar.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus({ preventScroll: true });
  }, [mobile, pagesOpen]);

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const id = uid();
    app.saveNote({ id, subjectId, title: title.trim(), blocks: [], content: fromBlocks([]), updatedAt: '' });
    setTitle('');
    open(id);
  };

  const renameSheet = rename && notes.some(({ id }) => id === rename.id) && <ElasticSheet title="Renomear página" onClose={() => setRename(null)}>
    {(dismiss) => <form className="ds-stack" onSubmit={(event) => {
      event.preventDefault();
      const title = rename.title.trim();
      if (!title) return;
      app.updateNote(rename.id, { title });
      dismiss();
    }}>
      <label className="field-label">Título da página
        <input className="ds-input" maxLength={150} required value={rename.title}
          onChange={(event) => setRename({ ...rename, title: event.target.value })} />
      </label>
      <Toolbar>
        <Button type="submit" variant="primary" disabled={!rename.title.trim()}>Salvar</Button>
        <Button onClick={dismiss}>Cancelar</Button>
      </Toolbar>
    </form>}
  </ElasticSheet>;

  if (!note || !pageControls) return <Stack className="notebook-pages">
    <form className="nw-inline-form" onSubmit={add}>
      <input className="ds-input" aria-label="Título da nova página" placeholder="Título da nova página" required maxLength={150} value={title}
        onChange={(event) => setTitle(event.target.value)} />
      <CreateButton type="submit">Nova página</CreateButton>
    </form>
    {notes.length ? <ul className="notebook-page-list">{notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((page) => <li key={page.id}>
      <PageLink href={routeHref({ area: 'materias', subjectId, view: 'caderno', noteId: page.id })}
        onEdit={() => open(page.id)} onRename={() => setRename({ id: page.id, title: page.title })}>
        <FileText size={19} aria-hidden="true" />
        <span><strong>{page.title || 'Sem título'}</strong>
          <small>{noteText(page).slice(0, 180) || 'Página em branco'}</small></span>
      </PageLink>
    </li>)}</ul> : <Surface><EmptyState icon={<BookOpen size={23} />} title="Seu caderno está em branco"
      description="Crie uma página para guardar os resumos, exercícios e links desta matéria." /></Surface>}
    {renameSheet}
  </Stack>;

  const { closePages, sidebarId, optionsOpen, closeOptions } = pageControls;
  return <section className="document-layout" data-pages-open={pagesOpen} aria-label="Editor do caderno">
    {mobile && <div className="document-sidebar-backdrop" aria-hidden="true" onClick={closePages} />}
    <div className="document-sidebar-slot">
      <nav ref={sidebar} id={sidebarId} className="document-sidebar" aria-label="Páginas da matéria" inert={!pagesOpen}
        onKeyDown={(event) => { if (event.key === 'Escape' && event.target instanceof Node && event.currentTarget.contains(event.target)) closePages(); }}>
        <div className="document-sidebar-heading">{subject && <SubjectMark subject={subject} />}
          <h2>{subject?.title || 'Páginas da matéria'}</h2>
        </div>
        <ul>{notes.map((page) => <li key={page.id}>
          <PageLink href={routeHref({ area: 'materias', subjectId, view: 'caderno', noteId: page.id })}
            onEdit={() => { if (mobile) closePages(); open(page.id); }}
            onRename={() => setRename({ id: page.id, title: page.title })}
            aria-current={page.id === note.id ? 'page' : undefined}
            onClick={(event) => {
              if (mobile && !event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) closePages();
            }}>
            <FileText size={17} aria-hidden="true" /><span>{page.title || 'Sem título'}</span>
          </PageLink>
        </li>)}</ul>
      </nav>
    </div>
    <div className="document-writing-area" inert={mobile && pagesOpen}>
      <Suspense fallback={<p role="status" className="document-loading nw-muted">Abrindo editor…</p>}>
        <RichTextEditor key={note.id} content={note.content || fromBlocks(note.blocks)}
          widthSettings={widthSettings} onChange={(content) => app.updateNote(note.id, { content })} />
      </Suspense>
    </div>
    {renameSheet}
    {optionsOpen && <ElasticSheet title="Opções da página" onClose={closeOptions}>
      <Stack>
        <details className="note-type-settings">
          <summary>Renomear página</summary>
          <input className="ds-input" aria-label="Título da página" value={note.title} placeholder="Sem título" maxLength={150}
            onChange={(event) => app.updateNote(note.id, { title: event.target.value })} />
        </details>
        <section className="document-editor-settings">
          <h3>Configurações do editor</h3>
          <div className="field-label">Barra de ferramentas
            <Segment label="Modo da barra de ferramentas" value={app.data.profile.toolbarMode}
              onChange={(toolbarMode) => app.updateProfile({ toolbarMode })}
              options={[{ id: 'simple', label: 'Simplificado' }, { id: 'advanced', label: 'Avançado' }]} />
          </div>
          <div ref={setWidthSettings} />
          <EditorTypographySettings />
        </section>
        <div><Button variant="danger" icon={<Trash2 size={16} />} onClick={() => {
          if (window.confirm('Excluir esta página e seu conteúdo?')) { app.removeNote(note.id); open(); }
        }}>Excluir página</Button></div>
      </Stack>
    </ElasticSheet>}
  </section>;
}
