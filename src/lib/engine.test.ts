import { describe, it, expect } from 'vitest';
import { emptyData, uid } from '../types';
import type { Entry } from '../types';
import { assistantMessage, dateToDeadline, pointsBalance, pointsFor, priorityScore, rankedTasks, entryDueLabel, nextCommitment, weekActivity } from './engine';
import { rubberBand } from './motion';

function task(overrides: Partial<Entry> = {}): Entry {
  return {
    id: uid(), title: 'Uma tarefa', note: '', kind: 'task', status: 'active',
    importance: 2, effort: 2, minutes: 25, dueAt: null,
    steps: [], postponeCount: 0, source: 'user',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    completedAt: null, ...overrides,
  };
}

describe('regras transparentes', () => {
  it('não coloca ideias nem preocupações na fila de tarefas', () => {
    const data = emptyData();
    data.entries = [task({kind:'idea'}), task({kind:'worry'}), task({title:'Executável'})];
    expect(rankedTasks(data)).toHaveLength(1);
    expect(rankedTasks(data)[0].title).toBe('Executável');
  });
  it('prioriza um prazo muito próximo quando as demais condições são iguais', () => {
    const urgent = task({dueAt: new Date(Date.now() + 3600000).toISOString()});
    const later = task();
    expect(priorityScore(urgent, 2)).toBeGreaterThan(priorityScore(later, 2));
  });
  it('leva a disposição em conta sem esconder itens difíceis', () => {
    const intense = task({effort:3});
    expect(priorityScore(intense, 3)).toBeGreaterThan(priorityScore(intense, 1));
  });
  it('soma os pontos sem penalizar inatividade', () => {
    const entry = task();
    expect(pointsFor(entry)).toBeGreaterThan(0);
    expect(pointsBalance([
      {id:'a',at:'2026-01-01',label:'A',kind:'complete',points:18},
      {id:'b',at:'2026-01-02',label:'B',kind:'rest',points:0},
      {id:'c',at:'2026-01-03',label:'C',kind:'redeem',points:-10},
    ])).toBe(8);
  });
  it('mantém elasticidade limitada e ímpar', () => {
    expect(rubberBand(0)).toBe(0);
    expect(rubberBand(10000)).toBeLessThan(72.01);
    expect(rubberBand(-100)).toBeCloseTo(-rubberBand(100));
  });
  it('não finge conhecer tarefas quando não há registros', () => {
    expect(assistantMessage(emptyData())).toContain('Registre algo');
  });
  it('converte data de calendário em prazo válido', () => {
    expect(new Date(dateToDeadline('2026-11-17') || '').getFullYear()).toBe(2026);
  });
});

it('mantém compromissos sem horário e descarta horários que já passaram', () => {
  const now = new Date(2026, 10, 23, 13);
  const event = (time?: string) => task({
    kind: 'event', dueAt: dateToDeadline('2026-11-23', time), eventTime: time ? true : undefined,
  });
  const future = event('14:30');
  expect(nextCommitment([event('12:00'), event(), future], now)).toBe(future);
  expect(entryDueLabel(future, now)).toBe('Hoje às 14:30');
  expect(entryDueLabel(event(), now)).toBe('Hoje');
});

it('conta somente tarefas concluídas, uma vez por tarefa', () => {
  const now = new Date(2026, 10, 23, 13);
  const data = emptyData();
  const done = task({ status: 'done', completedAt: now.toISOString() });
  data.entries = [done, task({ status: 'done', kind: 'event', completedAt: now.toISOString() }), task()];
  data.activity = ['first', 'last'].map((id) => ({
    id, kind: 'complete', at: now.toISOString(), label: done.title, points: 0, entryId: done.id,
  }));
  expect(weekActivity(data, now).at(-1)?.completed).toBe(1);
});
