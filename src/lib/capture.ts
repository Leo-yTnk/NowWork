import { uid, type AppData, type CaptureKind, type Entry, type RecordRef } from '../types';
import { asLocalDate } from './engine';
import { dayOffset, isDay } from './localDates';

export const captureLabels: Record<CaptureKind, string> = {
  task: 'Tarefa', event: 'Compromisso', note: 'Anotação', idea: 'Ideia', question: 'Dúvida',
  link: 'Link', academic: 'Informação acadêmica', review: 'Revisão', other: 'Outro',
};
export const normalizeText = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function suggestCapture(content: string, now = new Date()): { classification?: CaptureKind; suggestedDay?: string } {
  const text = normalizeText(content.trim());
  const explicit = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  const today = asLocalDate(now.toISOString());
  const suggestedDay = isDay(explicit) ? explicit : /\bamanha\b/.test(text) ? dayOffset(today, 1) : /\bhoje\b/.test(text) ? today : undefined;
  const rules: [CaptureKind, RegExp][] = [
    ['question', /^(duvida\b|por que\b|como\b)|\?$/],
    ['link', /^https?:\/\/\S+/], ['review', /^(rever|revisar|revisao|flashcard)\b/],
    ['event', /\b(aula|reuniao|consulta|prova|encontro)\b/], ['idea', /^(ideia|e se|poderia)\b/],
    ['task', /^(fazer|enviar|entregar|resolver|levar|ler|estudar|preparar|comprar|preciso|terminar)\b/],
    ['academic', /^(capitulo|definicao|formula|resumo)\b/], ['note', /^anotacao\b/],
  ];
  return { classification: rules.find(([, pattern]) => pattern.test(text))?.[0], suggestedDay };
}

export function makeCapture(content: string, options: { classification?: CaptureKind; subjectId?: string; noteId?: string }, now = new Date()): Entry {
  const at = now.toISOString();
  return {
    id: uid(), kind: 'capture', title: content.trim().split(/\r?\n/, 1)[0].slice(0, 200), note: '',
    capture: { content, classification: options.classification, suggestedDay: suggestCapture(content, now).suggestedDay },
    subjectId: options.subjectId, status: 'active', importance: 2, effort: 2, minutes: 25,
    dueAt: null, steps: [], postponeCount: 0, source: 'user', createdAt: at, updatedAt: at, completedAt: null,
  };
}

export const sameRef = (a: RecordRef, b: RecordRef) => a.type === b.type && a.id === b.id;
export function recordExists(data: AppData, ref: RecordRef): boolean {
  if (ref.type === 'entry') return data.entries.some(({ id }) => id === ref.id);
  if (ref.type === 'note') return data.notes.some(({ id }) => id === ref.id);
  return data.flashcards.some(({ id }) => id === ref.id);
}

export function linkRecords(data: AppData, from: RecordRef, to: RecordRef): AppData {
  if (sameRef(from, to) || !recordExists(data, from) || !recordExists(data, to) ||
    data.links.some((edge) => (sameRef(edge.from, from) && sameRef(edge.to, to)) ||
      (sameRef(edge.from, to) && sameRef(edge.to, from)))) return data;
  return { ...data, links: [...data.links, { from, to }] };
}

export function relatedRecords(data: AppData, ref: RecordRef): RecordRef[] {
  return data.links.flatMap(({ from, to }) => sameRef(from, ref) ? [to] : sameRef(to, ref) ? [from] : [])
    .filter((item) => recordExists(data, item));
}

export interface Conversion {
  type: 'task' | 'event' | 'note' | 'card';
  subjectId?: string;
  title?: string;
  answer?: string;
  answers?: Record<string, string>;
  dueAt?: string | null;
  eventTime?: boolean;
}

export function convertCapture(data: AppData, id: string, choice: Conversion, targetId: string, now = new Date()): AppData {
  const original = data.entries.find((entry) => entry.id === id);
  if (!original || original.status !== 'active' || !['capture', 'idea', 'worry'].includes(original.kind) || original.capture?.convertedTo) return data;
  const subjectId = choice.subjectId === undefined ? original.subjectId : choice.subjectId || undefined;
  if ((choice.type === 'note' || choice.type === 'card') && !data.subjects.some((subject) => subject.id === subjectId)) return data;
  const content = original.capture?.content ?? [original.title, original.note].filter(Boolean).join('\n');
  const title = choice.title?.trim() || original.title;
  const ref: RecordRef = { type: choice.type === 'note' || choice.type === 'card' ? choice.type : 'entry', id: targetId };
  const at = now.toISOString();
  let next: AppData = { ...data, entries: data.entries.map((entry) => entry.id === id ? {
    ...entry, status: 'archived', updatedAt: at, capture: { ...entry.capture, content, deferredUntil: undefined, convertedTo: ref },
  } : entry) };
  if (choice.type === 'note') next = { ...next, notes: [{
    id: targetId, subjectId: subjectId!, title: title.slice(0, 150), updatedAt: at, blocks: [],
    content: { type: 'doc', content: content.split(/\r\n|\n|\r/).map((line) =>
      ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })) },
  }, ...next.notes] };
  else if (choice.type === 'card') {
    if (!choice.answer?.trim()) return data;
    next = { ...next, flashcards: [{ id: targetId, subjectId: subjectId!, front: title.slice(0, 1000),
      back: choice.answer.trim().slice(0, 5000), due: asLocalDate(at), interval: 0 }, ...next.flashcards] };
  } else next = { ...next, entries: [{ ...original, id: targetId, title: title.slice(0, 200), kind: choice.type,
    note: content.slice(0, 3000), capture: undefined, subjectId, dueAt: choice.dueAt === undefined ? original.dueAt : choice.dueAt,
    eventTime: choice.type === 'event' && choice.eventTime || undefined, createdAt: at, updatedAt: at }, ...next.entries] };
  return linkRecords(next, { type: 'entry', id }, ref);
}
