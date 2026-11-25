import { DEFAULT_WEIGHTS, PRIORITY_FACTORS, type AppData, type Energy, type Entry, type Flashcard, type PriorityFactor, type RecordRef } from '../types';
import { asLocalDate, dueDays } from './engine';
import { dueReviews, reviewedOn } from './learning';
import { dayCapacity, executableTasks } from './planning';

const factorReasons: Record<PriorityFactor, string> = {
  urgency: 'Prazo próximo ou já passado',
  importance: 'Importância que você atribuiu',
  fit: 'Duração compatível com o tempo disponível',
  dependency: 'É pré-requisito para outra tarefa',
  energy: 'Esforço compatível com a disposição informada',
  preference: 'Matéria que você escolheu priorizar',
  review: 'Revisão programada',
};

function evaluate(factors: Record<PriorityFactor, number>, weights: Record<PriorityFactor, number>) {
  const weighted = PRIORITY_FACTORS.map((key) => ({ contribution: weights[key] * factors[key], key }));
  const total = PRIORITY_FACTORS.reduce((sum, key) => sum + weights[key], 0);
  const strongest = weighted.sort((a, b) => b.contribution - a.contribution)[0];
  return { score: total ? weighted.reduce((sum, item) => sum + item.contribution, 0) / total : 0,
    reason: strongest.contribution ? factorReasons[strongest.key] : 'Atividade disponível para começar' };
}

function taskFactors(entry: Entry, now: Date, available?: number, energy?: Energy, preference?: string, prerequisite = false) {
  const days = dueDays(entry, now);
  return {
    urgency: days === null ? 0 : Math.max(0, 1 - Math.max(0, days) / 8),
    importance: entry.importance === 3 ? 1 : entry.importance === 2 ? .4 : 0,
    fit: available === undefined || entry.minutes > available ? 0 : 1,
    dependency: prerequisite ? 1 : 0,
    energy: energy !== undefined && entry.effort <= energy ? 1 : 0,
    preference: preference && entry.subjectId === preference ? 1 : 0,
    review: 0,
  };
}

export function taskPriority(entry: Entry, energy: Energy, now: Date) {
  if (entry.kind !== 'task' || entry.status !== 'active') return -Infinity;
  return evaluate(taskFactors(entry, now, undefined, energy), DEFAULT_WEIGHTS).score;
}

export type Recommendation = ({ ref: RecordRef; score: number; reason: string; minutes: number } &
  ({ type: 'task'; entry: Entry } | { type: 'review'; card: Flashcard }));

export function recommendations(data: AppData, now = new Date(), planningDay?: string, includeReviews = true) {
  const day = planningDay ?? asLocalDate(now.toISOString());
  const capacity = dayCapacity(data, day);
  const settings = data.cognitive;
  const currentMinute = planningDay ? 0 : now.getHours() * 60 + now.getMinutes();
  const remaining = capacity.gaps.map((gap) => Math.max(0, gap.end - Math.max(currentMinute, gap.start)));
  const blocksNow = capacity.blocks.find((block) => block.start <= currentMinute && currentMinute < block.end);
  const available = settings.availableMinutes ?? (capacity.configured ?
    Math.max(0, Math.min(Math.max(0, ...remaining), remaining.reduce((sum, value) => sum + value, 0) - capacity.margin)) : undefined);
  const candidates: Recommendation[] = [];
  const prerequisites = new Set(data.entries.filter((entry) => entry.status === 'active').flatMap((entry) => entry.dependencies ?? []));
  for (const entry of executableTasks(data.entries)) {
    if (!planningDay && entry.plannedOn && entry.plannedOn > day) continue;
    const limit = blocksNow?.type === 'study' && blocksNow.entryId === entry.id ?
      Math.max(available ?? 0, blocksNow.end - currentMinute) : available;
    const prerequisite = prerequisites.has(entry.id);
    const factors = taskFactors(entry, now, limit, settings.energy, settings.preferredSubject, prerequisite);
    candidates.push({ type: 'task', entry, ref: { type: 'entry', id: entry.id }, minutes: entry.minutes, ...evaluate(factors, settings.weights) });
  }
  const reviewBudget = settings.reviewMinutes - (includeReviews ? reviewedOn(data, day) * 3 : 0);
  if (includeReviews && reviewBudget >= 3 && (available === undefined || available >= 3)) {
    const card = dueReviews(data, day)[0];
    if (card) candidates.push({
      type: 'review', card, ref: { type: 'card', id: card.id }, minutes: Math.min(reviewBudget, available ?? Infinity),
      ...evaluate({ urgency: 0, importance: .5, fit: available !== undefined ? 1 : 0, dependency: 0,
        energy: 0, preference: settings.preferredSubject === card.subjectId ? 1 : 0, review: 1 }, settings.weights),
      reason: factorReasons.review,
    });
  }
  return candidates.sort((a, b) => b.score - a.score ||
    (a.type === 'task' ? a.entry.dueAt ?? '~' : a.card.due).localeCompare(b.type === 'task' ? b.entry.dueAt ?? '~' : b.card.due) ||
    (a.type === 'task' ? a.entry.createdAt : '').localeCompare(b.type === 'task' ? b.entry.createdAt : '') ||
    (a.ref.id < b.ref.id ? -1 : a.ref.id > b.ref.id ? 1 : 0));
}

export function intentionPrompt(entry: Entry, data: AppData, now: Date) {
  const intention = entry.intention;
  if (!intention) return undefined;
  if (intention.type === 'routine') return 'Depois de ' + intention.value + ', ' + intention.action;
  if (intention.type === 'time') return now.toTimeString().slice(0, 5) >= intention.value ? intention.action : undefined;
  const trigger = data.entries.find((item) => item.id === intention.value);
  if (!trigger) return undefined;
  if (intention.type === 'completion') return trigger.status === 'done' ? intention.action : undefined;
  return trigger.status !== 'archived' && trigger.eventTime && trigger.dueAt &&
    now.getTime() >= Date.parse(trigger.dueAt) + trigger.minutes * 60000 ? intention.action : undefined;
}
