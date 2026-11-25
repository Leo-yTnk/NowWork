import { CAPTURE_KINDS, cognitiveDefaults, PRIORITY_FACTORS, REVIEW_MODES, type AppData, type Capture, type CognitiveSettings,
  type Continuity, type DayPlan, type Energy, type Intention, type RecordLink, type RecordRef, type ReviewAttempt, type TimeBlock, type TimeRange } from '../types';
import { clockMinutes, isDay } from './localDates';

const string = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined;
export const finite = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
export const timestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : undefined;
export const dateField = (value: unknown) => isDay(value) ? value : undefined;

export function reference(value?: RecordRef): RecordRef | undefined {
  if (value && ['entry', 'note', 'card'].includes(value.type) && typeof value.id === 'string' && value.id) {
    return { type: value.type, id: value.id };
  }
}

function timeRange(value?: TimeRange): TimeRange | undefined {
  if (!value || !Number.isInteger(value.start) || !Number.isInteger(value.end) || value.start < 0 || value.end > 1440 || value.start >= value.end) return undefined;
  return { start: value.start, end: value.end };
}

function validatedList<T, R>(value: T[] | undefined, decode: (item: T) => R | undefined): R[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('O backup tem uma lista de dados inválida.');
  return value.map((item) => {
    const decoded = decode(item);
    if (decoded === undefined) throw new Error('O backup tem um registro inválido. Os dados locais foram preservados.');
    return decoded;
  });
}

export function cognitiveSettings(input?: Partial<CognitiveSettings>): CognitiveSettings {
  const defaults = cognitiveDefaults();
  if (!input) return defaults;
  const availability: CognitiveSettings['availability'] = {};
  for (let weekday = 0; weekday < 7; weekday++) {
    const windows = input.availability?.[weekday];
    if (windows !== undefined) availability[weekday] = validatedList(windows, timeRange);
  }
  const weights = { ...defaults.weights };
  for (const factor of PRIORITY_FACTORS) weights[factor] = finite(input.weights?.[factor], 0, 100) ?? weights[factor];
  return { ...defaults, availability, weights,
    shortcut: input.shortcut === 'Space' || (/^[A-Z]$/.test(input.shortcut ?? '') && input.shortcut !== 'K') ? input.shortcut! : defaults.shortcut,
    recommendations: input.recommendations !== false, trackFocus: input.trackFocus === true,
    energy: finite(input.energy, 1, 3) as Energy | undefined,
    preferredSubject: string(input.preferredSubject), availableMinutes: finite(input.availableMinutes, 0, 600),
    buffer: finite(input.buffer, 0, 90) ?? defaults.buffer,
    reviewMinutes: finite(input.reviewMinutes, 0, 600) ?? defaults.reviewMinutes,
    pauseReminder: finite(input.pauseReminder, 0, 180) ?? defaults.pauseReminder,
  };
}

export function cognitiveCollections(input: Omit<Partial<AppData>, 'version'>) {
  return {
    cognitive: cognitiveSettings(input.cognitive),
    blocks: validatedList(input.blocks, (block): TimeBlock | undefined => {
      const range = timeRange(block);
      if (range && isDay(block.day) && typeof block.id === 'string' && ['study', 'break'].includes(block.type)) {
        return { ...range, day: block.day, id: block.id, type: block.type, entryId: string(block.entryId) };
      }
    }),
    days: validatedList(input.days, (plan): DayPlan | undefined => {
      if (plan && isDay(plan.day)) return { day: plan.day, closed: plan.closed === true, rest: plan.rest === true,
        pinned: reference(plan.pinned), skipped: validatedList(plan.skipped, reference), reflection: string(plan.reflection), weeklyReflection: string(plan.weeklyReflection) };
    }),
    links: validatedList(input.links, (edge): RecordLink | undefined => {
      const from = reference(edge?.from), to = reference(edge?.to);
      if (from && to) return { from, to };
    }),
  };
}

export function captureFields(input?: Capture): Capture | undefined {
  if (input === undefined) return undefined;
  if (!input || typeof input.content !== 'string' || !input.content.trim()) throw new Error('O backup tem uma captura inválida.');
  return { content: input.content, classification: input.classification && CAPTURE_KINDS.includes(input.classification) ? input.classification : undefined,
    suggestedDay: dateField(input.suggestedDay), deferredUntil: dateField(input.deferredUntil), convertedTo: reference(input.convertedTo) };
}

export function intentionFields(input?: Intention): Intention | undefined {
  if (!input || !['time', 'routine', 'event', 'completion'].includes(input.type) || typeof input.value !== 'string' ||
    typeof input.action !== 'string' || !input.action.trim() || !input.value.trim() ||
    (input.type === 'time' && !Number.isFinite(clockMinutes(input.value)))) return undefined;
  return { type: input.type, value: input.value, action: input.action };
}

export function continuityFields(input?: Continuity): Continuity | undefined {
  if (!input || Object.values(input).some((field) => typeof field !== 'string')) return undefined;
  return { stoppedAt: input.stoppedAt ?? '', next: input.next ?? '', context: input.context ?? '', difficulty: input.difficulty ?? '' };
}

export function cardFields(card: AppData['flashcards'][number]) {
  return {
    ...(card.mode && REVIEW_MODES.includes(card.mode) ? { mode: card.mode } : {}),
    ...(typeof card.topic === 'string' ? { topic: card.topic } : {}),
    ...(isDay(card.examDay) ? { examDay: card.examDay } : {}),
    ...(card.history === undefined ? {} : { history: validatedList(card.history, (attempt): ReviewAttempt | undefined => {
      if (attempt && timestamp(attempt.at) && ['forgot', 'hard', 'good', 'easy'].includes(attempt.grade) && finite(attempt.interval, 0, 36500) !== undefined) {
        return { at: attempt.at, grade: attempt.grade, interval: attempt.interval };
      }
    }) }),
  };
}

export function focusFields(focus: AppData['focus'] | undefined): AppData['focus'] {
  if (!focus || typeof focus.entryId !== 'string' || !timestamp(focus.startedAt)) return null;
  return { entryId: focus.entryId, startedAt: focus.startedAt, goal: string(focus.goal),
    targetMinutes: finite(focus.targetMinutes, 1, 600), clockStartedAt: timestamp(focus.clockStartedAt),
    accruedSeconds: finite(focus.accruedSeconds, 0, Number.MAX_SAFE_INTEGER), paused: focus.paused === true,
    estimateMinutes: finite(focus.estimateMinutes, 1, 600), interruptions: finite(focus.interruptions, 0, Number.MAX_SAFE_INTEGER),
    subjectId: string(focus.subjectId), activityType: string(focus.activityType) };
}
