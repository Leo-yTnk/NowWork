import { describe, expect, it } from 'vitest';
import { emptyData, type Entry, type Flashcard } from '../types';
import { convertCapture, linkRecords, makeCapture, relatedRecords, suggestCapture } from './capture';
import { intentionPrompt, recommendations } from './decision';
import { dateToDeadline } from './engine';
import { adaptiveEstimate, focusSeconds, reviewedOn, scheduleReview } from './learning';
import { canApplyBlocks, cyclicDependency, dayCapacity, rescheduleEntry, suggestBlocks, suggestWeek } from './planning';
import { validateData } from './storage';

const day = '2026-11-24';
const now = new Date(2026, 10, 24, 14);
const task = (id: string, options: Partial<Entry> = {}): Entry => ({
  id, title: id, kind: 'task', status: 'active', note: '', importance: 2, effort: 2, minutes: 25, dueAt: null,
  steps: [], postponeCount: 0, source: 'user', createdAt: now.toISOString(), updatedAt: now.toISOString(), completedAt: null,
  ...options,
});
const card = { id: 'card', subjectId: 'math', front: 'Pergunta', back: 'Resposta', due: day, interval: 5 } satisfies Flashcard;

describe('captura e referências', () => {
  it('preserva conteúdo, destinações e identificação sem fazer duplicatas', () => {
    const raw = '  Revisar amanhã\n' + 'á'.repeat(4500) + '\nDetalhes  ';
    const capture = makeCapture(raw, {}, now);
    const initial = { ...emptyData(), entries: [capture] };
    expect(capture.capture).toEqual({ content: raw, classification: undefined, suggestedDay: '2026-11-25' });
    expect(capture.dueAt).toBeNull();
    expect(recommendations(initial, now)).toEqual([]);
    const converted = convertCapture(initial, capture.id, { type: 'note', subjectId: 'math' }, 'page', now);
    expect(convertCapture(converted, capture.id, { type: 'task' }, 'duplicate', now)).toBe(converted);
    const restored = validateData(JSON.parse(JSON.stringify(converted)));
    expect(restored.entries[0].capture?.content).toBe(raw);
    expect(restored.notes[0].content?.content?.[1].content?.[0].text).toHaveLength(4500);
    const ref = { type: 'entry', id: capture.id } as const;
    const page = { type: 'note', id: 'page' } as const;
    expect(relatedRecords(restored, page)).toEqual([ref]);
    expect(linkRecords(restored, page, ref)).toBe(restored);
  });

  it('sugere datas válidas, permite sobrescrever categorias e exige resposta para um cartão', () => {
    expect(suggestCapture('https://exemplo.com', now).classification).toBe('link');
    expect(suggestCapture('2026-02-31', now).suggestedDay).toBeUndefined();
    const entry = makeCapture('Como usar o gráfico?', { classification: 'idea' }, now);
    const data = { ...emptyData(), entries: [entry] };
    expect(entry.capture?.classification).toBe('idea');
    expect(convertCapture(data, entry.id, { type: 'card', subjectId: 'math' }, 'card', now)).toBe(data);
    const converted = convertCapture(data, entry.id, { type: 'card', subjectId: 'math', answer: 'Veja os eixos' }, 'card', now);
    expect(converted.flashcards[0]).toMatchObject({ id: 'card', back: 'Veja os eixos' });
    expect(converted.entries[0].capture?.convertedTo).toEqual({ type: 'card', id: 'card' });
  });
});

describe('priorização determinística', () => {
  it('exclui dependências abertas e referências ausentes, com desempate estável', () => {
    const data = emptyData();
    data.entries = [
      task('blocked', { dependencies: ['b'] }), task('orphan', { dependencies: ['missing'] }),
      task('b'), task('c'), task('a'),
    ];
    expect(recommendations(data, now).map(({ ref }) => ref.id)).toEqual(['b', 'a', 'c']);
    expect(recommendations(data, now)[0].reason).toBe('É pré-requisito para outra tarefa');
    expect(cyclicDependency(data.entries, 'b', 'blocked')).toBe(true);
    data.entries[2] = { ...data.entries[2], status: 'done' };
    expect(recommendations(data, now).some(({ ref }) => ref.id === 'blocked')).toBe(true);
  });

  it('permite que importância prevaleça sobre urgência com pesos configurados', () => {
    const data = emptyData();
    data.entries = [task('urgente', { dueAt: dateToDeadline(day), importance: 1 }), task('importante', { importance: 3 })];
    data.cognitive.weights = { urgency: 0, importance: 100, fit: 0, dependency: 0, energy: 0, preference: 0, review: 0 };
    const ranked = recommendations(data, now);
    expect(ranked.map(({ score }) => score)).toEqual([1, 0]);
    expect(ranked[0].ref.id).toBe('importante');
  });

  it('usa horários observáveis em planos condicionais', () => {
    const data = emptyData();
    const conditional = task('a', { intention: { type: 'event', value: 'b', action: 'Revisar a aula' } });
    data.entries = [conditional, task('b', { kind: 'event', eventTime: true, dueAt: dateToDeadline(day, '13:45'), minutes: 30 })];
    expect(intentionPrompt(conditional, data, now)).toBeUndefined();
    expect(intentionPrompt(conditional, data, new Date(2026, 10, 24, 14, 15))).toBe('Revisar a aula');
  });
});

describe('capacidade e planejamento', () => {
  it('desconta a união dos compromissos e detecta conflitos', () => {
    const data = emptyData();
    data.cognitive.availability[2] = [{ start: 840, end: 1020 }, { start: 990, end: 1080 }];
    data.entries = [task('A', { kind: 'event', eventTime: true, dueAt: dateToDeadline(day, '14:00'), minutes: 60 }),
      task('B', { kind: 'event', eventTime: true, dueAt: dateToDeadline(day, '14:30'), minutes: 60 }),
      task('C', { minutes: 150, dueAt: dateToDeadline(day) })];
    expect(dayCapacity(data, day, day)).toMatchObject({ available: 240, fixedMinutes: 90, margin: 38, planned: 150, excess: 38, conflicts: [['A', 'B']] });
  });

  it('distribui em dias diferentes e propõe uma única vez cada tarefa', () => {
    const data = emptyData();
    data.cognitive.availability = { 2: [{ start: 840, end: 900 }], 3: [{ start: 840, end: 900 }] };
    const a = task('A', { minutes: 40 });
    const b = task('B', { minutes: 40 });
    data.entries = [a, b];
    const preview = suggestWeek(data, day, [a, b], now);
    expect(preview.map(({ day, entryId }) => [day, entryId])).toEqual([[day, 'A'], ['2026-11-25', 'B']]);
    expect(canApplyBlocks(data, preview)).toBe(true);
    data.days = [{ day: '2026-11-25', rest: true }];
    expect(canApplyBlocks(data, preview)).toBe(false);
  });

  it('propõe blocos sem mutar a agenda, preserva prazos e confere conflitos novos', () => {
    const data = emptyData();
    data.cognitive.availability[2] = [{ start: 840, end: 960 }];
    const a = task('A', { minutes: 40, dueAt: dateToDeadline(day) });
    const b = task('B', { minutes: 25, dependencies: ['A'] });
    data.entries = [a, b];
    const preview = suggestBlocks(data, day, [a, b], now);
    expect(preview).toEqual([{ day, type: 'study', entryId: 'A', start: 840, end: 880 }]);
    expect(data.blocks).toEqual([]);
    expect(canApplyBlocks(data, preview)).toBe(true);
    data.blocks = [{ id: 'break', day, type: 'break', start: 850, end: 855 }];
    expect(canApplyBlocks(data, preview)).toBe(false);
    expect(rescheduleEntry(data, 'A', '2026-11-26').entries[0]).toMatchObject({ dueAt: a.dueAt, plannedOn: '2026-11-26' });
  });
});

describe('continuidade, revisão e migração', () => {
  it('abre um backup v1 com datas de revisão e foco anterior', () => {
    const legacy = { version: 1, profile: { name: 'Leo' }, entries: [task('old')], flashcards: [card],
      activity: [], rewards: [], focus: { entryId: 'old', startedAt: now.toISOString() } };
    const restored = validateData(legacy);
    expect(restored.version).toBe(2);
    expect(restored.entries[0]).toMatchObject(task('old'));
    expect(restored.flashcards).toEqual([card]);
    expect(restored.focus?.entryId).toBe('old');
    expect(restored.cognitive.buffer).toBe(25);
    expect(() => validateData({ ...restored, blocks: [{ start: 1000, end: 900, day }] })).toThrow();
  });

  it('mantém avaliações antigas, ajusta por desempenho e limita pelo prazo acadêmico', () => {
    const previous = scheduleReview(card, 'forgot', now);
    expect(previous.interval).toBe(1);
    const next = scheduleReview({ ...previous, examDay: '2026-11-27' }, 'easy', new Date(2026, 10, 25, 14));
    expect(next.due).toBe('2026-11-26');
    expect(next.history?.map(({ grade }) => grade)).toEqual(['forgot', 'easy']);
    const restored = validateData({ ...emptyData(), flashcards: [next] });
    expect(restored.flashcards[0]).toEqual(next);
    expect(reviewedOn(restored, day)).toBe(1);
  });

  it('desconta pausas e usa só tempos confirmados de tarefas semelhantes concluídas', () => {
    const focus = { entryId: 'A', startedAt: now.toISOString(), accruedSeconds: 120, paused: true };
    expect(focusSeconds(focus, new Date(+now + 1200000))).toBe(120);
    expect(focusSeconds({ ...focus, paused: false, clockStartedAt: new Date(+now + 600000).toISOString() }, new Date(+now + 720000))).toBe(240);
    const data = emptyData();
    data.cognitive.trackFocus = true;
    const query = task('new', { subjectId: 'math' });
    data.entries = ['a', 'b', 'c'].map((id) => task(id, { status: 'done', completedAt: now.toISOString(), subjectId: 'math' }));
    data.activity = data.entries.map((entry, index) => ({ id: entry.id, entryId: entry.id, kind: 'focus', points: 0,
      label: 'Foco', at: now.toISOString(), subjectId: 'math', effectiveSeconds: [1200, 1800, 6000][index] }));
    expect(adaptiveEstimate(data, query)).toEqual({ minutes: 30, samples: 3, range: [20, 100] });
    data.activity[0].effectiveSeconds = undefined;
    expect(adaptiveEstimate(data, query)).toBeNull();
  });
});
