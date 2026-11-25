import type { AppData, Entry, Flashcard, ReviewGrade } from '../types';
import { asLocalDate } from './engine';
import { dayOffset } from './localDates';

export const gradeLabels: Record<ReviewGrade, string> = { forgot: 'Esqueci', hard: 'Difícil', good: 'Bom', easy: 'Fácil' };
export const reviewModes = { flashcard: 'Flashcard', open: 'Resposta aberta', recall: 'Evocação livre', cloze: 'Lacuna', explain: 'Explicar conceito' };

export function scheduleReview(card: Flashcard, grade: ReviewGrade, now: Date): Flashcard {
  const today = asLocalDate(now.toISOString());
  const history = card.history ?? [];
  const hardRecently = history.slice(-3).filter((attempt) => attempt.grade === 'forgot' || attempt.grade === 'hard').length;
  const last = history.at(-1);
  const elapsed = last ? Math.round((Date.parse(today) - Date.parse(asLocalDate(last.at))) / 86400000) : 0;
  const lateDays = Math.max(0, last ? elapsed - last.interval : Math.floor((Date.parse(today) - Date.parse(card.due)) / 86400000) || 0);
  const base = Math.max(1, card.interval);
  const successfulDelay = grade === 'good' || grade === 'easy' ? Math.min(base / 2, lateDays / 3) : 0;
  const multiplier = { forgot: 0, hard: 1.2, good: 2, easy: 3 }[grade];
  const raw = grade === 'forgot' ? 1 : Math.max(grade === 'hard' ? 1 : 2,
    Math.round((base + successfulDelay) * multiplier / (1 + hardRecently * .2)));
  const examIn = card.examDay ? Math.round((Date.parse(card.examDay) - Date.parse(today)) / 86400000) : 0;
  const interval = Math.min(60, raw, examIn > 0 ? Math.max(1, examIn - 1) : 60);
  return { ...card, due: dayOffset(today, interval), interval, history: [...history, { at: now.toISOString(), grade, interval }] };
}

export function reviewedOn(data: AppData, day: string) {
  return data.flashcards.reduce((sum, card) =>
    sum + (card.history ?? []).filter(({ at }) => asLocalDate(at) === day).length, 0);
}

export function dueReviews(data: AppData, day: string) {
  return data.flashcards.filter((card) => !card.due || card.due <= day).sort((a, b) =>
    a.due.localeCompare(b.due) || a.id.localeCompare(b.id));
}

export function focusSeconds(focus: NonNullable<AppData['focus']>, now: Date) {
  const running = focus.paused ? 0 : Math.max(0, Math.floor((now.getTime() - Date.parse(focus.clockStartedAt ?? focus.startedAt)) / 1000));
  return (focus.accruedSeconds ?? 0) + running;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const center = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[center] : (sorted[center - 1] + sorted[center]) / 2;
};

export function adaptiveEstimate(data: AppData, task: Entry) {
  if (!data.cognitive.trackFocus || (!task.subjectId && !task.activityType)) return null;
  const sessions = data.activity.filter((item) => item.kind === 'focus' && item.effectiveSeconds && item.entryId !== task.id &&
    (!task.activityType || item.activityType === task.activityType) && (!task.subjectId || item.subjectId === task.subjectId));
  // One observation per completed task. Sum confirmed segments instead of confusing sessions with task duration.
  const samples = new Map<string, number>();
  const completed = new Set(data.entries.filter((entry) => !!entry.completedAt).map((entry) => entry.id));
  for (const session of sessions) if (session.entryId && completed.has(session.entryId)) {
    samples.set(session.entryId, (samples.get(session.entryId) ?? 0) + session.effectiveSeconds! / 60);
  }
  const values = [...samples.values()];
  if (values.length < 3) return null;
  return { minutes: Math.max(1, Math.round(median(values))), samples: values.length,
    range: [Math.max(1, Math.round(Math.min(...values))), Math.max(1, Math.round(Math.max(...values)))] as const };
}
