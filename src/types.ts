import type { EditorTypography } from './lib/editorTypography';
import type { RibbonOrder } from './lib/ribbonOrder';
import type { JSONContent } from '@tiptap/core';

export type EntryKind = 'task' | 'event' | 'worry' | 'idea' | 'capture';
export type EntryStatus = 'active' | 'done' | 'archived';
export type Energy = 1 | 2 | 3;
export type Importance = 1 | 2 | 3;
export type Theme = 'system' | 'light' | 'dark';

export interface Step {
  id: string;
  title: string;
  done: boolean;
  awarded: boolean;
}

export const SUBJECT_COLORS = [
  'cherry', 'rose', 'coral', 'peach', 'orange', 'amber', 'gold', 'lemon',
  'lime', 'olive', 'leaf', 'emerald', 'mint', 'teal', 'cyan', 'sky',
  'blue', 'cobalt', 'indigo', 'violet', 'orchid', 'purple', 'magenta', 'berry',
] as const;
export type SubjectColor = typeof SUBJECT_COLORS[number];
export interface Subject { id: string; title: string; color: SubjectColor; icon?: string }
export interface SubjectVisit { subjectId: string; at: string }
export const BLOCK_TYPES = ['text', 'heading', 'check', 'link'] as const;
export interface NoteBlock { id: string; type: typeof BLOCK_TYPES[number]; text: string; checked?: boolean; url?: string }
export interface StudyNote { id: string; subjectId: string; title: string; topic?: string; blocks: NoteBlock[]; content?: JSONContent; updatedAt: string }
export const REVIEW_MODES = ['flashcard', 'open', 'recall', 'cloze', 'explain'] as const;
export type ReviewMode = typeof REVIEW_MODES[number];
export type ReviewGrade = 'forgot' | 'hard' | 'good' | 'easy';
export interface ReviewAttempt { at: string; grade: ReviewGrade; interval: number }
export interface Flashcard {
  id: string; subjectId: string; front: string; back: string; due: string; interval: number;
  mode?: ReviewMode; topic?: string; history?: ReviewAttempt[]; examDay?: string;
}

export const CAPTURE_KINDS = ['task', 'event', 'note', 'idea', 'question', 'link', 'academic', 'review', 'other'] as const;
export type CaptureKind = typeof CAPTURE_KINDS[number];
export type RecordRef = { type: 'entry' | 'note' | 'card'; id: string };
export interface RecordLink { from: RecordRef; to: RecordRef }
export interface Capture {
  content: string; classification?: CaptureKind; suggestedDay?: string; deferredUntil?: string; convertedTo?: RecordRef;
}
export interface Continuity { stoppedAt: string; next: string; context: string; difficulty: string }
export type Intention =
  | { type: 'time' | 'routine'; value: string; action: string }
  | { type: 'event' | 'completion'; value: string; action: string };
export interface TimeRange { start: number; end: number }
export interface TimeBlock extends TimeRange { id: string; day: string; type: 'study' | 'break'; entryId?: string }
export const PRIORITY_FACTORS = ['urgency', 'importance', 'fit', 'dependency', 'energy', 'preference', 'review'] as const;
export type PriorityFactor = typeof PRIORITY_FACTORS[number];
export const DEFAULT_WEIGHTS: Record<PriorityFactor, number> = {
  urgency: 30, importance: 24, fit: 16, dependency: 10, energy: 6, preference: 6, review: 8,
};
export interface CognitiveSettings {
  shortcut: string; recommendations: boolean; weights: Record<PriorityFactor, number>;
  energy?: Energy; preferredSubject?: string; availableMinutes?: number;
  availability: Partial<Record<number, TimeRange[]>>; buffer: number; trackFocus: boolean;
  reviewMinutes: number; pauseReminder: number;
}
export interface DayPlan { day: string; closed?: boolean; rest?: boolean; pinned?: RecordRef; skipped?: RecordRef[]; reflection?: string; weeklyReflection?: string }
export function cognitiveDefaults(): CognitiveSettings {
  return { shortcut: 'Space', recommendations: true, weights: { ...DEFAULT_WEIGHTS }, availability: {}, buffer: 25,
    trackFocus: false, reviewMinutes: 15, pauseReminder: 0 };
}

export interface Entry {
  subjectId?: string;
  capture?: Capture;
  dependencies?: string[];
  plannedOn?: string;
  optional?: boolean;
  activityType?: string;
  intention?: Intention;
  continuity?: Continuity;
  id: string;
  title: string;
  note: string;
  kind: EntryKind;
  status: EntryStatus;
  importance: Importance;
  effort: Energy;
  minutes: number;
  dueAt: string | null;
  eventTime?: boolean;
  steps: Step[];
  postponeCount: number;
  source: 'user' | 'demo';
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type EntryInput = Pick<Entry, 'title' | 'note' | 'kind' | 'importance' | 'effort' | 'minutes' | 'dueAt' | 'eventTime' | 'subjectId' | 'dependencies' | 'plannedOn' | 'optional' | 'activityType' | 'intention'>;

export interface Reward {
  id: string;
  title: string;
  cost: number;
  createdAt: string;
}

export type ActivityKind = 'complete' | 'step' | 'rest' | 'focus' | 'redeem';

export interface Activity {
  id: string;
  kind: ActivityKind;
  label: string;
  points: number;
  minutes?: number;
  entryId?: string;
  effectiveSeconds?: number;
  estimateMinutes?: number;
  interruptions?: number;
  subjectId?: string;
  activityType?: string;
  at: string;
}

export interface AppData {
  version: 2;
  profile: {
    name: string;
    energy: Energy;
    theme: Theme;
    reducedMotion: boolean;
    toolbarMode: 'simple' | 'advanced';
    ribbonOrder?: RibbonOrder;
    editorTypography: EditorTypography;
  };
  cognitive: CognitiveSettings;
  blocks: TimeBlock[];
  days: DayPlan[];
  links: RecordLink[];
  subjects: Subject[];
  subjectVisits: SubjectVisit[];
  notes: StudyNote[];
  flashcards: Flashcard[];
  entries: Entry[];
  rewards: Reward[];
  activity: Activity[];
  focus: {
    entryId: string; startedAt: string; goal?: string; targetMinutes?: number; clockStartedAt?: string;
    accruedSeconds?: number; paused?: boolean; estimateMinutes?: number; interruptions?: number;
    subjectId?: string; activityType?: string;
  } | null;
  break: { startedAt: string; minutes: number } | null;
}

export function emptyData(): AppData {
  return {
    version: 2,
    cognitive: cognitiveDefaults(), blocks: [], days: [], links: [],
    profile: { name: '', energy: 2, theme: 'system', reducedMotion: false, toolbarMode: 'simple', editorTypography: {} },
    subjects: [
      { id: 'math', icon: 'calculator', title: 'Matemática', color: 'mint' },
      { id: 'portuguese', icon: 'pen-nib', title: 'Português', color: 'violet' },
      { id: 'science', icon: 'flask', title: 'Ciências', color: 'blue' },
      { id: 'history', icon: 'landmark', title: 'História', color: 'peach' },
    ],
    subjectVisits: [],
    notes: [],
    flashcards: [],
    entries: [],
    rewards: [],
    activity: [],
    focus: null,
    break: null,
  };
}

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const KINDS: Record<EntryKind, string> = {
  task: 'Tarefa',
  event: 'Compromisso',
  worry: 'Preocupação',
  idea: 'Ideia',
  capture: 'Captura',
};
