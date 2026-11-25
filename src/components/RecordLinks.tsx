import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { relatedRecords, sameRef } from '../lib/capture';
import { routeHref } from '../lib/navigation';
import { useApp } from '../state/AppState';
import type { AppData, RecordRef } from '../types';
import { Button } from './ui';

export function describeRecord(data: AppData, record: RecordRef) {
  if (record.type === 'entry') {
    const entry = data.entries.find(({ id }) => id === record.id);
    if (entry) return { title: entry.title, label: entry.kind === 'task' ? 'Tarefa' : entry.kind === 'event' ? 'Compromisso' : 'Registro',
      href: routeHref({ area: 'planejar', view: entry.kind === 'task' || entry.kind === 'event' ? 'tarefas' : 'entrada', entryId: entry.id }) };
  } else if (record.type === 'note') {
    const note = data.notes.find(({ id }) => id === record.id);
    if (note) return { title: note.title, label: 'Página', href: routeHref({ area: 'materias', view: 'caderno', subjectId: note.subjectId, noteId: note.id }) };
  } else {
    const card = data.flashcards.find(({ id }) => id === record.id);
    if (card) return { title: card.front, label: 'Cartão', href: routeHref({ area: 'materias', view: 'revisao', subjectId: card.subjectId, noteId: card.id }) };
  }
}

export function RecordPicker({ label, omit, onPick }: { label: string; omit: RecordRef[]; onPick: (record: RecordRef) => void }) {
  const { data } = useApp();
  const [value, setValue] = useState('');
  const options: RecordRef[] = [
    ...data.entries.map(({ id }) => ({ type: 'entry' as const, id })),
    ...data.notes.map(({ id }) => ({ type: 'note' as const, id })),
    ...data.flashcards.map(({ id }) => ({ type: 'card' as const, id })),
  ].filter((record) => !omit.some((other) => sameRef(record, other)));
  return <div className="nw-toolbar cognitive-picker">
    <label className="field-label">{label}
      <select className="ds-input" value={value} onChange={(event) => setValue(event.target.value)}>
        <option value="">Selecione um registro</option>
        {options.map((record) => {
          const described = describeRecord(data, record);
          return <option key={record.type + ':' + record.id} value={record.type + ':' + record.id}>{described?.label} · {described?.title.slice(0, 110)}</option>;
        })}
      </select>
    </label>
    <Button size="sm" disabled={!value} onClick={() => {
      const record = options.find((item) => item.type + ':' + item.id === value);
      if (record) onPick(record);
      setValue('');
    }}>Vincular</Button>
  </div>;
}

export function RecordLinks({ record }: { record: RecordRef }) {
  const { data, link } = useApp();
  const related = relatedRecords(data, record);
  return <details className="cognitive-details">
    <summary><Link2 size={15} aria-hidden="true" /> Referências{related.length ? ' (' + related.length + ')' : ''}</summary>
    {related.length > 0 && <ul className="cognitive-links">{related.map((ref) => {
      const described = describeRecord(data, ref);
      return described && <li key={ref.type + ':' + ref.id}><a href={described.href}>{described.title || 'Sem título'}</a> <small>{described.label}</small></li>;
    })}</ul>}
    <RecordPicker label="Vincular a um registro existente" omit={[record, ...related]} onPick={(to) => link(record, to)} />
  </details>;
}
