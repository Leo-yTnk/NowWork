import { useState } from 'react';
import { Inbox, Plus } from 'lucide-react';
import { useApp } from '../state/AppState';
import { asLocalDate, dateToDeadline } from '../lib/engine';
import { captureLabels, normalizeText } from '../lib/capture';
import { dayOffset } from '../lib/localDates';
import { Button, EmptyState, Surface } from '../components/ui';
import { EntryCard } from '../components/EntryCard';
import { RecordLinks, RecordPicker } from '../components/RecordLinks';
import { CAPTURE_KINDS, type CaptureKind, type Entry } from '../types';

type ConversionType = 'task' | 'event' | 'note' | 'card';
const conversionLabels: Record<ConversionType, string> = { task: 'Tarefa', event: 'Compromisso', note: 'Página de caderno', card: 'Flashcard' };

function InboxActions({ entries, onDone }: { entries: Entry[]; onDone?: () => void }) {
  const app = useApp();
  const ids = entries.map(({ id }) => id);
  const first = entries[0];
  const [conversion, setConversion] = useState<ConversionType | ''>('');
  const [subjectId, setSubjectId] = useState(first.subjectId ?? '');
  const [day, setDay] = useState(first.capture?.suggestedDay ?? '');
  const [time, setTime] = useState('');
  const [title, setTitle] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [content, setContent] = useState(first.capture?.content ?? [first.title, first.note].filter(Boolean).join('\n'));
  const [classification, setClassification] = useState<CaptureKind | ''>(first.capture?.classification ?? '');
  const needsSubject = conversion === 'note' || conversion === 'card';
  const archived = entries.every((entry) => entry.status === 'archived');
  const action = (type: 'archive' | 'delete' | 'defer' | 'restore' | 'subject', value?: string) => {
    app.processInbox(ids, type, value);
    onDone?.();
  };
  return <div className="nw-stack">
    <div className="nw-toolbar">
      {!archived && <><Button size="sm" onClick={() => action('archive')}>Arquivar</Button>
        <Button size="sm" onClick={() => action('defer', dayOffset(asLocalDate(new Date().toISOString()), 1))}>Classificar amanhã</Button></>}
      {archived && entries.some((entry) => !entry.capture?.convertedTo) && <Button size="sm" onClick={() => action('restore')}>Tratar novamente</Button>}
      <Button size="sm" variant="danger" onClick={() => action('delete')}>Excluir</Button>
    </div>
    {!archived && <details className="cognitive-details">
      <summary>Classificar ou converter</summary>
      <div className="cognitive-form-grid">
        <label className="field-label">Matéria
          <select className="ds-input" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            <option value="">Sem matéria</option>{app.data.subjects.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
          </select>
        </label>
        <label className="field-label">Converter em
          <select className="ds-input" value={conversion} onChange={(event) => setConversion(event.target.value as ConversionType | '')}>
            <option value="">Escolha um formato</option>{Object.entries(conversionLabels)
              .map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
          </select>
        </label>
      </div>
      {conversion ? <form className="nw-stack" onSubmit={(event) => {
        event.preventDefault();
        app.convertInbox(ids, { type: conversion, title, answers, subjectId,
          dueAt: conversion === 'task' || conversion === 'event' ? dateToDeadline(day, time) : undefined, eventTime: !!(day && time) });
        onDone?.();
      }}>
        {entries.length === 1 && <label className="field-label">{conversion === 'card' ? 'Pergunta' : 'Título personalizado (opcional)'}
          <input className="ds-input" value={title} placeholder={first.title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
        </label>}
        {(conversion === 'event' || conversion === 'task') && <div className="cognitive-form-grid">
          <label className="field-label">{conversion === 'event' ? 'Data' : 'Prazo'}<input className="ds-input" type="date" value={day} onChange={(event) => setDay(event.target.value)} /></label>
          {conversion === 'event' && <label className="field-label">Horário<input className="ds-input" type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>}
        </div>}
        {conversion === 'card' && entries.map((entry) => <label key={entry.id} className="field-label">
          {entries.length === 1 ? 'Resposta' : 'Resposta para ' + entry.title}
          <textarea className="ds-input" required maxLength={5000} value={answers[entry.id] ?? ''}
            onChange={(event) => setAnswers({ ...answers, [entry.id]: event.target.value })} />
        </label>)}
        <Button size="sm" type="submit" variant="primary" disabled={needsSubject && !subjectId}>Converter</Button>
      </form> : <Button size="sm" onClick={() => action('subject', subjectId)}>Salvar matéria</Button>}
      {entries.length > 1 && <RecordPicker label="Vincular seleção a um registro" omit={ids.map((id) => ({ type: 'entry', id }))}
        onPick={(target) => { ids.forEach((id) => app.link({ type: 'entry', id }, target)); onDone?.(); }} />}
    </details>}
    {!archived && entries.length === 1 && <details className="cognitive-details">
      <summary>Editar captura</summary>
      <form className="nw-stack" onSubmit={(event) => {
        event.preventDefault();
        app.editCapture(first.id, content, classification || undefined);
      }}>
        <label className="field-label">Conteúdo<textarea className="ds-input" required rows={3} value={content} onChange={(event) => setContent(event.target.value)} /></label>
        <label className="field-label">Classificação<select className="ds-input" value={classification} onChange={(event) => setClassification(event.target.value as CaptureKind | '')}>
          <option value="">Sem classificação</option>{CAPTURE_KINDS.map((kind) => <option key={kind} value={kind}>{captureLabels[kind]}</option>)}
        </select></label>
        <Button type="submit" size="sm" disabled={!content.trim()}>Salvar captura</Button>
      </form>
    </details>}
  </div>;
}

export function Mente({ selectedId, openCapture }: { selectedId?: string; openCapture: () => void }) {
  const { data } = useApp();
  const [filter, setFilter] = useState(selectedId ? 'all' : 'pending');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const today = asLocalDate(new Date().toISOString());
  const entries = data.entries.filter((entry) => {
    if (entry.id === selectedId && filter === 'all') return true;
    if (!['capture', 'idea', 'worry'].includes(entry.kind)) return false;
    const deferred = entry.capture?.deferredUntil && entry.capture.deferredUntil > today;
    return filter === 'all' || (filter === 'archived' ? entry.status === 'archived' :
      entry.status === 'active' && (filter === 'deferred' ? deferred : !deferred));
  }).filter((entry) => normalizeText(entry.title + ' ' + (entry.capture?.content ?? entry.note)).includes(normalizeText(query.trim())))
    .sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId) || b.createdAt.localeCompare(a.createdAt));
  const batch = entries.filter((entry) => selected.includes(entry.id));
  return <div className="nw-stack">
    <div className="nw-section-heading nw-wrap">
      <label className="field-label">Buscar na caixa de entrada<input className="ds-input" type="search" value={query}
        onChange={(event) => { setQuery(event.target.value); setSelected([]); }} /></label>
      <label className="field-label">Mostrar<select className="ds-input" value={filter} onChange={(event) => { setFilter(event.target.value); setSelected([]); }}>
        <option value="pending">A processar</option><option value="deferred">Adiados</option><option value="archived">Arquivo</option><option value="all">Todos</option>
      </select></label>
      <Button variant="primary" icon={<Plus size={16} />} onClick={openCapture}>Capturar</Button>
    </div>
    {batch.length > 0 && <Surface className="nw-padding nw-stack">
      <strong>{batch.length} selecionados</strong><InboxActions key={selected.join(',')} entries={batch} onDone={() => setSelected([])} />
    </Surface>}
    {entries.length ? entries.map((entry) => ['capture', 'idea', 'worry'].includes(entry.kind)
      ? <Surface key={entry.id} className="nw-padding nw-stack">
        <div className="cognitive-inbox-heading">
          <label className="cognitive-check"><input type="checkbox" checked={selected.includes(entry.id)} aria-label={'Selecionar ' + entry.title}
            onChange={(event) => setSelected(event.target.checked ? [...selected, entry.id] : selected.filter((id) => id !== entry.id))} /></label>
          <details className="cognitive-details" open={entry.id === selectedId || undefined}>
            <summary>{entry.title}</summary>
            <p className="cognitive-content">{entry.capture?.content ?? entry.note}</p>
            <p className="nw-muted">{[entry.capture?.classification && captureLabels[entry.capture.classification],
              data.subjects.find(({ id }) => id === entry.subjectId)?.title, entry.capture?.convertedTo ? 'Convertido' : undefined].filter(Boolean).join(' · ')}</p>
            <InboxActions entries={[entry]} />
            <RecordLinks record={{ type: 'entry', id: entry.id }} />
          </details>
        </div>
      </Surface> : <EntryCard key={entry.id} entry={entry} initiallyExpanded={entry.id === selectedId} />)
      : <Surface><EmptyState icon={<Inbox size={23} />} title="Nenhum registro nesta lista" description="Capture uma ideia ou um lembrete para processar quando quiser." /></Surface>}
  </div>;
}
