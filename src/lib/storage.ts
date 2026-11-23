import { validateEditorTypography } from './editorTypography';
import { validateRibbonOrder } from './ribbonOrder';
import { validateDocument } from './documents';
import { BLOCK_TYPES, SUBJECT_COLORS, emptyData, uid } from '../types';
import type { AppData, Entry, Activity, Reward } from '../types';

// Preserve the original keys for data already saved under the same GitHub Pages origin.
const DB_NAME = 'brisa-app';
const STORE = 'snapshots';
const KEY = 'current';
const FALLBACK = 'brisa-fallback-v1';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponível'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    let blocked = false;
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error('O armazenamento local está ocupado.'));
    };
  });
}

export function validateData(value: unknown): AppData {
  if (!value || typeof value !== 'object') throw new Error('O arquivo não contém um backup válido.');
  const obj = value as Partial<AppData>;
  if (obj.version !== 1 || !obj.profile || !Array.isArray(obj.entries) || !Array.isArray(obj.activity) || !Array.isArray(obj.rewards)) {
    throw new Error('Formato de backup não reconhecido (versão 1).');
  }
  const subjects = Array.isArray(obj.subjects) ? obj.subjects.filter(
    (item) => item && typeof item.id === 'string' && typeof item.title === 'string' && SUBJECT_COLORS.includes(item.color),
  ).map((item) => ({ id: item.id, title: item.title.slice(0, 60), color: item.color,
    ...(typeof item.icon === 'string' && /^[a-z0-9-]{1,60}$/.test(item.icon) ? { icon: item.icon } : {}) })) : emptyData().subjects;
  const hasSubject = (id: string) => subjects.some((item) => item.id === id);
  const subjectVisits = Array.isArray(obj.subjectVisits) ? obj.subjectVisits.slice(-2000).filter((visit) =>
    visit && typeof visit.subjectId === 'string' && hasSubject(visit.subjectId) &&
    typeof visit.at === 'string' && Number.isFinite(Date.parse(visit.at))) : [];
  const notes = Array.isArray(obj.notes) ? obj.notes.filter(
    (note) => note && hasSubject(note.subjectId) && typeof note.title === 'string' && Array.isArray(note.blocks),
  ).map((note) => ({
    id: String(note.id || uid()), subjectId: note.subjectId, title: note.title.slice(0, 150),
    updatedAt: String(note.updatedAt || new Date().toISOString()),
    ...(note.content === undefined ? {} : { content: validateDocument(note.content) }),
    blocks: note.blocks.filter(
      (block) => block && BLOCK_TYPES.includes(block.type) && typeof block.text === 'string',
    ).map((block) => ({
      id: String(block.id || uid()), type: block.type, text: block.text.slice(0, 12000),
      checked: !!block.checked, url: typeof block.url === 'string' ? block.url.slice(0, 2000) : undefined,
    })),
  })) : [];
  const flashcards = Array.isArray(obj.flashcards) ? obj.flashcards.filter(
    (card) => card && hasSubject(card.subjectId) && typeof card.front === 'string' && typeof card.back === 'string',
  ).map((card) => ({
    id: String(card.id || uid()), subjectId: card.subjectId, front: card.front.slice(0, 1000),
    back: card.back.slice(0, 5000), due: typeof card.due === 'string' && Number.isFinite(Date.parse(card.due)) ? card.due : '',
    interval: Math.max(0, Math.min(60, Math.floor(Number(card.interval) || 0))),
  })) : [];
  const validKinds = ['task', 'event', 'worry', 'idea'];
  const validStatuses = ['active', 'done', 'archived'];
  const entries: Entry[] = obj.entries.map((entry) => {
    if (!entry || typeof entry.title !== 'string' || !validKinds.includes(entry.kind) || !validStatuses.includes(entry.status)) throw new Error('Há registros inválidos no backup.');
    return {
      id: String(entry.id || crypto.randomUUID()), title: entry.title.slice(0, 200),
      subjectId: entry.subjectId && hasSubject(entry.subjectId) ? entry.subjectId : undefined,
      note: String(entry.note || '').slice(0, 3000), kind: entry.kind,
      status: entry.status, importance: [1,2,3].includes(entry.importance) ? entry.importance : 2,
      effort: [1,2,3].includes(entry.effort) ? entry.effort : 2,
      minutes: Math.max(5, Math.min(600, Number(entry.minutes) || 25)),
      dueAt: typeof entry.dueAt === 'string' && Number.isFinite(Date.parse(entry.dueAt)) ? entry.dueAt : null,
      steps: Array.isArray(entry.steps) ? entry.steps.filter((s) => s && typeof s.title === 'string').map((s) => ({ id: String(s.id || crypto.randomUUID()), title: s.title.slice(0, 200), done: !!s.done, awarded: !!s.awarded })) : [],
      postponeCount: Math.max(0, Number(entry.postponeCount) || 0),
      source: entry.source === 'demo' ? 'demo' : 'user',
      createdAt: String(entry.createdAt || new Date().toISOString()),
      updatedAt: String(entry.updatedAt || new Date().toISOString()),
      completedAt: typeof entry.completedAt === 'string' ? entry.completedAt : null,
    };
  });
  const activity: Activity[] = obj.activity.map((item) => {
    if (!item || typeof item.label !== 'string' || !['complete','step','rest','focus','redeem'].includes(item.kind)) throw new Error('Há eventos inválidos no backup.');
    return {
      id: String(item.id || crypto.randomUUID()),
      label: item.label.slice(0, 250),
      kind: item.kind,
      at: typeof item.at === 'string' && Number.isFinite(Date.parse(item.at)) ? item.at : new Date().toISOString(),
      points: Math.max(-100000, Math.min(100000, Math.trunc(Number(item.points) || 0))),
      minutes: item.minutes === undefined ? undefined : Math.max(0, Number(item.minutes) || 0),
      entryId: typeof item.entryId === 'string' ? item.entryId : undefined,
    };
  });
  const rewards: Reward[] = obj.rewards.map((item) => {
    if (!item || typeof item.title !== 'string') throw new Error('Há recompensas inválidas no backup.');
    return { id: String(item.id || crypto.randomUUID()), title: item.title.slice(0, 150),
      cost: Math.max(1, Math.min(100000, Math.trunc(Number(item.cost) || 1))),
      createdAt: String(item.createdAt || new Date().toISOString()) };
  });
  const profile = obj.profile;
  return {
    version: 1,
    profile: {
      name: String(profile.name || '').slice(0, 50),
      energy: [1,2,3].includes(profile.energy) ? profile.energy : 2,
      theme: ['light','dark','system'].includes(profile.theme) ? profile.theme : 'system',
      reducedMotion: !!profile.reducedMotion,
      toolbarMode: profile.toolbarMode === 'advanced' ? 'advanced' : 'simple',
      ribbonOrder: validateRibbonOrder(profile.ribbonOrder),
      editorTypography: validateEditorTypography(profile.editorTypography),
    },
    subjects, subjectVisits, notes, flashcards, entries, rewards, activity,
    focus: obj.focus && typeof obj.focus.entryId === 'string' && typeof obj.focus.startedAt === 'string' ? obj.focus : null,
    break: obj.break && typeof obj.break.startedAt === 'string' && Number.isFinite(obj.break.minutes)
      ? { startedAt: obj.break.startedAt, minutes: Math.max(1, Math.min(60, obj.break.minutes)) } : null,
  };
}

export class StorageConflictError extends Error {
  constructor() {
    super('Outra aba salvou uma versão mais recente. Exporte as mudanças desta aba antes de recarregar.');
  }
}

interface LocalWorkspace {
  data: AppData;
  warning?: string;
  save: (next: AppData) => Promise<void>;
}

function openSession(data: AppData, write: LocalWorkspace['save']): LocalWorkspace {
  let pending = Promise.resolve();
  return {
    data,
    save(next) {
      const result = pending.then(() => write(next));
      pending = result.catch(() => {});
      return result;
    },
  };
}

async function inSnapshotTransaction<T>(
  mode: IDBTransactionMode,
  snapshot: (store: IDBObjectStore, raw: unknown) => T,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const request = store.get(KEY);
      let result: T;
      request.onsuccess = () => {
        try {
          result = snapshot(store, request.result);
        } catch (error) {
          tx.abort();
          reject(error);
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error || new Error('Operação local interrompida.'));
    });
  } finally {
    db.close();
  }
}

function readFallback(): string | null {
  return localStorage.getItem(FALLBACK);
}

function openFallback(): LocalWorkspace {
  let saved = readFallback();
  const data = saved === null ? emptyData() : validateData(JSON.parse(saved));
  return openSession(data, async (next) => {
    // A single lock covers both the comparison and the write across tabs.
    if (!navigator.locks) throw new Error('O navegador não permite salvar esta cópia com segurança.');
    await navigator.locks.request(FALLBACK, () => {
      if (readFallback() !== saved) throw new StorageConflictError();
      const serialized = JSON.stringify(next);
      localStorage.setItem(FALLBACK, serialized);
      saved = serialized;
    });
  });
}

async function openIndexedWorkspace(): Promise<LocalWorkspace> {
  const raw = await inSnapshotTransaction('readonly', (_store, snapshot) => snapshot);
  let saved = JSON.stringify(raw);
  let fallbackSource: string | null = null;
  let data: AppData;
  if (raw === undefined) {
    fallbackSource = readFallback();
    data = fallbackSource === null ? emptyData() : validateData(JSON.parse(fallbackSource));
  } else {
    data = validateData(raw);
  }

  return openSession(data, async (next) => {
    const serialized = JSON.stringify(next);
    await inSnapshotTransaction('readwrite', (store, current) => {
      // IndexedDB holds the write lock until the comparison and the put commit.
      if (JSON.stringify(current) !== saved ||
          (saved === undefined && readFallback() !== fallbackSource)) {
        throw new StorageConflictError();
      }
      store.put(next, KEY);
    });
    saved = serialized;
    try {
      localStorage.setItem(FALLBACK, serialized);
    } catch {
      // IndexedDB has already committed the current snapshot.
    }
  });
}

export async function loadData(): Promise<LocalWorkspace> {
  if (!window.indexedDB) return openFallback();
  try {
    return await openIndexedWorkspace();
  } catch (error) {
    const fallback = readFallback();
    if (fallback === null) throw error;
    const data = validateData(JSON.parse(fallback));
    return {
      data,
      warning: 'O armazenamento principal não abriu. A cópia de contingência pode estar desatualizada. Exporte um backup.',
      async save() {
        throw new Error('O armazenamento principal está indisponível.');
      },
    };
  }
}
