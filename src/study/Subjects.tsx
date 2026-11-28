import { useState } from 'react';
import { ArrowRight, LibraryBig, Search } from 'lucide-react';
import { Button, CreateButton, EmptyState, PageHeading, Stack, Surface } from '../components/ui';
import { useApp } from '../state/AppState';
import { getSubjectIcon, subjectTone } from '../lib/subjectAppearance';
import type { Subject } from '../types';

function useSubjectCounts(id: string) {
  const { data } = useApp();
  return {
    tasks: data.entries.filter((entry) => entry.subjectId === id && entry.status === 'active' && ['task', 'event'].includes(entry.kind)).length,
    notes: data.notes.filter((note) => note.subjectId === id).length,
  };
}

const countLabel = (count: number, singular: string, plural: string) => count + ' ' + (count === 1 ? singular : plural);

export function SubjectIcon({ icon }: { icon: ReturnType<typeof getSubjectIcon> }) {
  const [width, height, , , paths] = icon.icon;
  return <svg aria-hidden="true" viewBox={`0 0 ${width} ${height}`} width="19" height="19" fill="currentColor">
    {(typeof paths === 'string' ? [paths] : paths).map((path) => <path key={path} d={path} />)}
  </svg>;
}

export function SubjectMark({ subject, shared = false }: { subject: Subject; shared?: boolean }) {
  return <span className="nw-subject-mark subject-tone" style={subjectTone(subject.color)} data-shared-subject={shared ? subject.id : undefined}>
    <SubjectIcon icon={getSubjectIcon(subject)} />
  </span>;
}

export function SubjectCard({ subject, open }: { subject: Subject; open: () => void }) {
  const counts = useSubjectCounts(subject.id);
  return <Surface layout className="subject-card">
    <Button className="ds-card-button" variant="ghost" onClick={open}>
      <SubjectMark subject={subject} shared />
      <strong>{subject.title}</strong>
      <span className="nw-muted">{countLabel(counts.tasks, 'pendência', 'pendências')} · {countLabel(counts.notes, 'página', 'páginas')}</span>
      <ArrowRight className="ds-card-arrow" size={16} aria-hidden="true" />
    </Button>
  </Surface>;
}

function useSubjectFilter() {
  const { subjects } = useApp().data;
  const [query, setQuery] = useState('');
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const term = normalize(query.trim());
  const filtered = subjects.filter((item) => normalize(item.title).includes(term))
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  return { subjects, filtered, query, setQuery };
}

function SubjectFilter({ query, change }: { query: string; change: (value: string) => void }) {
  return <label className="ds-search"><Search size={17} aria-hidden="true" />
    <input className="ds-input" type="search" placeholder="Filtrar matérias" aria-label="Filtrar matérias" value={query}
      onChange={(event) => change(event.target.value)} />
  </label>;
}

export function Subjects({ open, create }: { open: (id: string) => void; create: () => void }) {
  const { subjects, filtered, query, setQuery } = useSubjectFilter();
  return <Stack className="workspace-page">
    <PageHeading title="Matérias" description="Abra uma matéria para consultar seu caderno, tarefas e revisões."
      action={<CreateButton onClick={create}>Nova matéria</CreateButton>} />
    {!!subjects.length && <SubjectFilter query={query} change={setQuery} />}
    {filtered.length ? <div className="subject-grid">{filtered.map((subject) =>
      <SubjectCard key={subject.id} subject={subject} open={() => open(subject.id)} />
    )}</div> : <Surface><EmptyState icon={<LibraryBig size={23} />} title={query ? 'Nenhuma matéria encontrada' : 'Nenhuma matéria cadastrada'}
      description={query ? 'Tente buscar por outro nome.' : 'Crie uma matéria para organizar suas atividades.'} /></Surface>}
  </Stack>;
}
