import type { EditorTypography } from './lib/editorTypography';
import type { RibbonOrder } from './lib/ribbonOrder';
import type { JSONContent } from '@tiptap/core';

export type EntryKind = 'task' | 'event' | 'worry' | 'idea';
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
export interface StudyNote { id: string; subjectId: string; title: string; blocks: NoteBlock[]; content?: JSONContent; updatedAt: string }
export interface Flashcard { id: string; subjectId: string; front: string; back: string; due: string; interval: number }

export interface Entry {
  subjectId?: string;
  id: string;
  title: string;
  note: string;
  kind: EntryKind;
  status: EntryStatus;
  importance: Importance;
  effort: Energy;
  minutes: number;
  dueAt: string | null;
  steps: Step[];
  postponeCount: number;
  source: 'user' | 'demo';
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type EntryInput = Pick<Entry, 'title' | 'note' | 'kind' | 'importance' | 'effort' | 'minutes' | 'dueAt' | 'subjectId'>;

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
  at: string;
}

export interface AppData {
  version: 1;
  profile: {
    name: string;
    energy: Energy;
    theme: Theme;
    reducedMotion: boolean;
    toolbarMode: 'simple' | 'advanced';
    ribbonOrder?: RibbonOrder;
    editorTypography: EditorTypography;
  };
  subjects: Subject[];
  subjectVisits: SubjectVisit[];
  notes: StudyNote[];
  flashcards: Flashcard[];
  entries: Entry[];
  rewards: Reward[];
  activity: Activity[];
  focus: { entryId: string; startedAt: string } | null;
  break: { startedAt: string; minutes: number } | null;
}

export function emptyData(): AppData {
  return {
    version: 1,
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
};
