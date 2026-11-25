import { useState, type FormEvent } from 'react';
import { ArrowUpRight, BookOpen, Check, ListTodo, Search } from 'lucide-react';
import { EntryFields, freshInput } from '../components/EntryFields';
import { Button } from '../components/ui';
import { normalizeText } from '../lib/capture';
import { noteText } from '../lib/documents';
import { getSubjectIcon, subjectColor, subjectIcons, subjectTone } from '../lib/subjectAppearance';
import { SubjectIcon, SubjectMark } from './Subjects';
import { useApp } from '../state/AppState';
import { SUBJECT_COLORS, uid, type Subject, type EntryInput } from '../types';

export function TaskForm({ subjectId, dueAt, close }: { subjectId?: string; dueAt?: string | null; close: () => void }) {
  const app = useApp();
  const [draft, setDraft] = useState<EntryInput>(() => ({ ...freshInput(), subjectId, dueAt: dueAt ?? null }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    app.addEntry({ ...draft, title: draft.title.trim() });
    close();
  };
  return <form className="nw-stack" onSubmit={submit}>
    <EntryFields value={draft} onChange={setDraft} />
    <div className="nw-toolbar"><Button variant="primary" type="submit">Salvar registro</Button><Button onClick={close}>Cancelar</Button></div>
  </form>;
}

export function SubjectForm({ subject, save, remove, close }: {
  subject?: Subject; save: (subject: Subject) => void; remove: (id: string) => void; close: () => void;
}) {
  const [draft, setDraft] = useState<Subject>(() => subject || { id: uid(), title: '', color: 'mint' });
  const [iconQuery, setIconQuery] = useState('');
  const icons = subjectIcons.filter(({ label, icon }) => normalizeText(label + ' ' + icon.iconName).includes(normalizeText(iconQuery.trim())));
  return <form className="nw-stack" onSubmit={(event) => { event.preventDefault(); if (draft.title.trim()) save({ ...draft, title: draft.title.trim() }); }}>
    <label className="field-label">Nome da matéria<input required value={draft.title} placeholder="Ex.: Geografia" maxLength={60}
      onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
    <div className="subject-preview"><SubjectMark subject={draft} /><strong>{draft.title.trim() || 'Nova matéria'}</strong></div>
    <fieldset className="nw-color-field"><legend>Cor</legend><div className="subject-color-grid">{SUBJECT_COLORS.map((color) => {
      const [label, hex] = subjectColor(color);
      return <button type="button" aria-label={label} title={label} aria-pressed={draft.color === color} key={color}
        className="subject-swatch" style={{ backgroundColor: hex }} onClick={() => setDraft({ ...draft, color })}>
        {draft.color === color && <Check size={16} />}</button>;
    })}</div></fieldset>
    <fieldset className="nw-color-field"><legend>Ícone</legend>
      <label className="nw-search-field"><Search size={17} /><input type="search" aria-label="Buscar ícone"
        placeholder="Buscar ícone" value={iconQuery} onChange={(event) => setIconQuery(event.target.value)} /></label>
      <div className="subject-icon-grid">{icons.map(({ icon, label }) =>
        <button type="button" key={icon.iconName} title={label} aria-label={label}
          aria-pressed={getSubjectIcon(draft).iconName === icon.iconName} className="subject-tone" style={subjectTone(draft.color)}
          onClick={() => setDraft({ ...draft, icon: icon.iconName })}><SubjectIcon icon={icon} /></button>)}</div>
      {!icons.length && <p className="nw-muted" role="status">Nenhum ícone encontrado.</p>}
    </fieldset>
    <div className="nw-toolbar"><Button variant="primary" type="submit">Salvar matéria</Button><Button onClick={close}>Cancelar</Button>
      {subject && <Button variant="danger" onClick={() => {
        if (window.confirm('Excluir a matéria, suas páginas e cartões? As tarefas serão mantidas na lista Sem matéria.')) remove(subject.id);
      }}>Excluir matéria</Button>}
    </div>
  </form>;
}

export function WorkspaceSearch({ subject, note, entry, card }: {
  subject: (id: string) => void; note: (subjectId: string, id: string) => void; entry: (id: string) => void; card: (id: string) => void;
}) {
  const { data } = useApp();
  const [query, setQuery] = useState('');
  const term = normalizeText(query.trim());
  const results = term ? [
    ...data.subjects.map((item) => ({ id: 's-' + item.id, title: item.title, type: 'Matéria', content: item.title, Icon: BookOpen, open: () => subject(item.id) })),
    ...data.entries.map((item) => ({ id: 't-' + item.id, title: item.title, type: item.kind === 'task' ? 'Tarefa' : 'Registro',
      content: item.title + ' ' + (item.capture?.content ?? item.note) + ' ' + item.steps.map((step) => step.title).join(' '), Icon: ListTodo, open: () => entry(item.id) })),
    ...data.flashcards.map((item) => ({ id: 'c-' + item.id, title: item.front, type: 'Cartão',
      content: item.front + ' ' + item.back + ' ' + (item.topic ?? ''), Icon: BookOpen, open: () => card(item.id) })),
    ...data.notes.map((item) => ({ id: 'n-' + item.id, title: item.title || 'Sem título', type: 'Página',
      content: item.title + ' ' + (item.topic ?? '') + ' ' + noteText(item), Icon: BookOpen,
      open: () => note(item.subjectId, item.id) })),
  ].filter((item) => normalizeText(item.content).includes(term)).slice(0, 40) : [];
  return <div className="nw-stack">
    <label className="nw-search-field"><Search size={19} /><input autoFocus type="search" aria-label="Buscar matérias, tarefas, páginas e cartões" placeholder="Buscar matérias, tarefas, páginas e cartões…" value={query}
      onChange={(event) => setQuery(event.target.value)} /></label>
    <div className="nw-search-results" aria-label="Resultados da busca">
      {!results.length && <p className="nw-muted" role="status">{term ? 'Nenhum resultado encontrado.' : 'Digite um título ou trecho para buscar.'}</p>}
      {results.map(({ id, title, type, Icon, open }) => <button type="button" key={id} onClick={open}><Icon size={17} /><span><strong>{title}</strong><small>{type}</small></span><ArrowUpRight size={15} /></button>)}
    </div>
  </div>;
}
