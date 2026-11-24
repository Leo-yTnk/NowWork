import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { emptyData, uid } from '../types';
import type { AppData, Entry, EntryInput, Reward, Step, Subject, StudyNote, Flashcard } from '../types';
import { pointsBalance, pointsFor } from '../lib/engine';
import { withDemo } from '../lib/demo';
import { loadData, StorageConflictError } from '../lib/storage';

interface ToastState { id: string; message: string; undo?: boolean }
interface AppContextValue {
  data: AppData;
  ready: boolean;
  loadFailed: boolean;
  saveError: string | null;
  toast: ToastState | null;
  dismissToast: () => void;
  notify: (message: string) => void;
  visitSubject: (id: string) => void;
  saveSubject: (subject: Subject) => void;
  removeSubject: (id: string) => void;
  saveNote: (note: StudyNote) => void;
  updateNote: (id: string, patch: Partial<Pick<StudyNote, 'title' | 'content'>>) => void;
  removeNote: (id: string) => void;
  saveFlashcard: (card: Flashcard) => void;
  removeFlashcard: (id: string) => void;
  updateProfile: (patch: Partial<AppData['profile']>) => void;
  addEntry: (entry: EntryInput) => void;
  editEntry: (id: string, patch: EntryInput) => void;
  completeEntry: (id: string) => void;
  reopenEntry: (id: string) => void;
  postponeEntry: (id: string) => void;
  archiveEntry: (id: string) => void;
  restoreEntry: (id: string) => void;
  deleteEntry: (id: string) => void;
  undoDelete: () => void;
  divideEntry: (id: string) => void;
  addStep: (id: string, title: string) => void;
  toggleStep: (id: string, stepId: string) => void;
  startFocus: (id: string) => void;
  finishFocus: () => void;
  startBreak: (minutes: number) => void;
  finishBreak: () => void;
  addReward: (title: string, cost: number) => void;
  deleteReward: (id: string) => void;
  redeemReward: (id: string) => void;
  addDemo: () => void;
  removeDemo: () => void;
  restore: (next: AppData) => void;
  clearAll: () => void;
}

const Context = createContext<AppContextValue | null>(null);
const stamped = () => new Date().toISOString();

function focusEvent(focus: AppData['focus']) {
  if (!focus) return null;
  const minutes = Math.floor(Math.max(0, Date.now() - Date.parse(focus.startedAt)) / 60000);
  return minutes > 0 ? { id: uid(), at: stamped(), kind: 'focus' as const, label: 'Tempo de concentração', points: 0, minutes, entryId: focus.entryId } : null;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const workspace = useRef<Awaited<ReturnType<typeof loadData>> | null>(null);
  const lastScheduled = useRef<AppData | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const deletedRef = useRef<{ entry: Entry; index: number } | null>(null);

  const notify = (message: string, undo = false) => setToast({ id: uid(), message, undo });
  const dismissToast = () => setToast(null);

  useEffect(() => {
    let alive = true;
    loadData().then((stored) => {
      if (!alive) return;
      workspace.current = stored;
      lastScheduled.current = stored.data;
      setData(stored.data);
      setSaveError(stored.warning ?? null);
      setReady(true);
    }).catch(() => { if (alive) setLoadFailed(true); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const local = workspace.current;
    if (!ready || !local || data === lastScheduled.current) return;
    lastScheduled.current = data;
    local.save(data).then(() => setSaveError(null)).catch((error: unknown) => {
      setSaveError(error instanceof StorageConflictError ? error.message : local.warning ?? 'O salvamento local falhou. Exporte um backup para guardar suas mudanças.');
    });
  }, [data, ready]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast((current) => current?.id === toast.id ? null : current), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const update = () => {
      const dark = data.profile.theme === 'dark' ||
        (data.profile.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.documentElement.dataset.reduceMotion = data.profile.reducedMotion ? 'true' : 'false';
    };
    update();
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [data.profile.theme, data.profile.reducedMotion]);

  const upsert = <T extends { id: string },>(items: T[], item: T) => items.some(({ id }) => id === item.id)
    ? items.map((current) => current.id === item.id ? item : current) : [item, ...items];
  const visitSubject = useCallback((id: string) => {
    const at = stamped();
    setData((data) => {
      const last = data.subjectVisits.filter((visit) => visit.subjectId === id).at(-1);
      if (last && Date.parse(at) - Date.parse(last.at) < 60_000) return data;
      return { ...data, subjectVisits: [...data.subjectVisits.slice(-1999), { subjectId: id, at }] };
    });
  }, []);
  const saveSubject = (subject: Subject) => setData((d) => ({ ...d, subjects: upsert(d.subjects, subject) }));
  const removeSubject = (id: string) => setData((d) => ({
    ...d, subjects: d.subjects.filter((item) => item.id !== id),
    entries: d.entries.map((entry) => entry.subjectId === id ? { ...entry, subjectId: undefined } : entry),
    notes: d.notes.filter((note) => note.subjectId !== id),
    subjectVisits: d.subjectVisits.filter((visit) => visit.subjectId !== id),
    flashcards: d.flashcards.filter((card) => card.subjectId !== id),
  }));
  const saveNote = (note: StudyNote) => setData((d) => ({ ...d, notes: upsert(d.notes, { ...note, updatedAt: stamped() }) }));
  const updateNote = (id: string, patch: Partial<Pick<StudyNote, 'title' | 'content'>>) => setData((d) => ({
    ...d, notes: d.notes.map((note) => note.id === id ? { ...note, ...patch, updatedAt: stamped() } : note),
  }));
  const removeNote = (id: string) => setData((d) => ({ ...d, notes: d.notes.filter((note) => note.id !== id) }));
  const saveFlashcard = (card: Flashcard) => setData((d) => ({ ...d, flashcards: upsert(d.flashcards, card) }));
  const removeFlashcard = (id: string) => setData((d) => ({ ...d, flashcards: d.flashcards.filter((card) => card.id !== id) }));

  const updateProfile = (patch: Partial<AppData['profile']>) => setData((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
  const addEntry = (input: EntryInput) => {
    const now = stamped();
    const entry: Entry = {
      ...input, id: uid(), status: 'active', steps: [], postponeCount: 0,
      source: 'user', createdAt: now, updatedAt: now, completedAt: null,
    };
    setData((d) => ({ ...d, entries: [entry, ...d.entries] }));
    notify(input.kind === 'worry' ? 'Preocupação acolhida. Você não precisa resolvê-la agora.' : 'Registrado. Pode tirar isso da cabeça.');
  };
  const editEntry = (id: string, patch: EntryInput) => {
    setData((d) => ({ ...d, entries: d.entries.map((e) => e.id === id ? { ...e, ...patch, updatedAt: stamped() } : e) }));
    notify('Alterações salvas.');
  };
  const completeEntry = (id: string) => {
    setData((d) => {
      const entry = d.entries.find((e) => e.id === id);
      if (!entry || entry.status !== 'active') return d;
      const points = entry.kind === 'task' && !d.activity.some((item) => item.kind === 'complete' && item.entryId === id) ? pointsFor(entry) : 0;
      const focus = d.focus?.entryId === id ? focusEvent(d.focus) : null;
      return {
        ...d,
        entries: d.entries.map((e) => e.id === id ? { ...e, status: 'done', completedAt: stamped(), updatedAt: stamped() } : e),
        focus: d.focus?.entryId === id ? null : d.focus,
        activity: [
          { id: uid(), at: stamped(), kind: 'complete', label: entry.title, points, entryId: id },
          ...(focus ? [focus] : []), ...d.activity,
        ],
      };
    });
    notify('Concluído. Um passo a menos na cabeça.');
  };
  const reopenEntry = (id: string) => setData((d) => ({ ...d, entries: d.entries.map((entry) =>
    entry.id === id && entry.status === 'done' ? { ...entry, status: 'active', completedAt: null, updatedAt: stamped() } : entry) }));
  const postponeEntry = (id: string) => {
    setData((d) => ({ ...d, entries: d.entries.map((entry) => {
      if (entry.id !== id || entry.status !== 'active') return entry;
      const base = new Date(Math.max(Date.now(), entry.dueAt ? Date.parse(entry.dueAt) || 0 : 0));
      base.setDate(base.getDate() + 1);
      base.setHours(23, 59, 0, 0);
      return { ...entry, dueAt: base.toISOString(), postponeCount: entry.postponeCount + 1, updatedAt: stamped() };
    }) }));
    notify('Adiada em um dia. Sem culpa.');
  };
  const archiveEntry = (id: string) => {
    setData((d) => {
      const activeFocus = d.focus?.entryId === id;
      const focus = activeFocus ? focusEvent(d.focus) : null;
      return { ...d, entries: d.entries.map((e) => e.id === id ? { ...e, status: 'archived', updatedAt: stamped() } : e),
        focus: activeFocus ? null : d.focus, activity: focus ? [focus, ...d.activity] : d.activity };
    });
    notify('Registro arquivado.');
  };
  const restoreEntry = (id: string) => {
    setData((d) => ({ ...d, entries: d.entries.map((e) => e.id === id && e.status === 'archived' ? { ...e, status: e.completedAt ? 'done' : 'active', updatedAt: stamped() } : e) }));
    notify('Registro restaurado.');
  };
  const deleteEntry = (id: string) => {
    setData((d) => {
      const index = d.entries.findIndex((e) => e.id === id);
      if (index < 0) return d;
      deletedRef.current = { entry: d.entries[index], index };
      return { ...d, entries: d.entries.filter((e) => e.id !== id), focus: d.focus?.entryId === id ? null : d.focus };
    });
    notify('Registro excluído.', true);
  };
  const undoDelete = () => {
    const snapshot = deletedRef.current;
    if (!snapshot) return;
    deletedRef.current = null;
    setData((d) => {
      if (d.entries.some((e) => e.id === snapshot.entry.id)) return d;
      const entries = [...d.entries];
      entries.splice(Math.min(snapshot.index, entries.length), 0, snapshot.entry);
      return { ...d, entries };
    });
    notify('Exclusão desfeita.');
  };
  const divideEntry = (id: string) => {
    setData((d) => ({ ...d, entries: d.entries.map((e) => {
      if (e.id !== id || e.kind !== 'task' || e.steps.length) return e;
      const steps: Step[] = ['Preparar o primeiro passo', 'Executar a parte principal', 'Revisar e finalizar']
        .map((title) => ({ id: uid(), title, done: false, awarded: false }));
      return { ...e, steps, updatedAt: stamped() };
    }) }));
    notify('Dividida em três passos. Você pode acrescentar outros.');
  };
  const addStep = (id: string, title: string) => {
    const clean = title.trim().slice(0, 160);
    if (!clean) return;
    setData((d) => ({ ...d, entries: d.entries.map((e) => e.id === id ?
      { ...e, steps: [...e.steps, { id: uid(), title: clean, done: false, awarded: false }], updatedAt: stamped() } : e) }));
    notify('Passo adicionado.');
  };
  const toggleStep = (id: string, stepId: string) => {
    setData((d) => {
      const entry = d.entries.find((e) => e.id === id);
      if (!entry || entry.status !== 'active') return d;
      const step = entry.steps.find((s) => s.id === stepId);
      if (!step) return d;
      const award = !step.done && !step.awarded;
      return {
        ...d,
        entries: d.entries.map((e) => e.id === id ? { ...e, steps: e.steps.map((s) => s.id === stepId ? { ...s, done: !s.done, awarded: s.awarded || award } : s) } : e),
        activity: award ? [{ id: uid(), at: stamped(), kind: 'step', label: step.title, points: 3, entryId: id }, ...d.activity] : d.activity,
      };
    });
  };
  const startFocus = (id: string) => {
    if (data.focus || data.break) { notify('Encerre a sessão atual antes de começar outra.'); return; }
    setData((d) => d.focus || d.break || !d.entries.some((entry) => entry.id === id && entry.status === 'active' && entry.kind === 'task')
      ? d : { ...d, focus: { entryId: id, startedAt: stamped() } });
    notify('Foco iniciado. Uma coisa por vez.');
  };
  const finishFocus = () => {
    setData((d) => {
      const event = focusEvent(d.focus);
      return { ...d, focus: null, activity: event ? [event, ...d.activity] : d.activity };
    });
    notify('Foco encerrado. O tempo dedicado conta.');
  };
  const startBreak = (minutes: number) => {
    const planned = Math.max(1, Math.min(60, minutes));
    setData((d) => {
      const focus = focusEvent(d.focus);
      return { ...d, focus: null, break: { startedAt: stamped(), minutes: planned },
        activity: focus ? [focus, ...d.activity] : d.activity };
    });
    notify('Pausa iniciada. Descansar é necessário.');
  };
  const finishBreak = () => {
    setData((d) => {
      if (!d.break) return d;
      const elapsed = Math.floor(Math.max(0, Date.now() - Date.parse(d.break.startedAt)) / 60000);
      const minutes = Math.min(d.break.minutes, elapsed);
      return { ...d, break: null, activity: minutes > 0
        ? [{ id: uid(), at: stamped(), kind: 'rest', label: 'Pausa consciente', minutes, points: 0 }, ...d.activity]
        : d.activity };
    });
    notify('Pausa encerrada. Bem-vindo de volta.');
  };
  useEffect(() => {
    if (!data.break) return;
    const elapsed = Date.now() - Date.parse(data.break.startedAt);
    const timer = window.setTimeout(finishBreak, Math.max(0, data.break.minutes * 60000 - elapsed));
    return () => window.clearTimeout(timer);
  }, [data.break]);
  const addReward = (title: string, cost: number) => {
    const clean = title.trim().slice(0, 120);
    if (!clean || !Number.isFinite(cost) || cost < 1) return;
    setData((d) => ({ ...d, rewards: [{ id: uid(), title: clean, cost: Math.floor(cost), createdAt: stamped() }, ...d.rewards] }));
    notify('Recompensa criada.');
  };
  const deleteReward = (id: string) => {
    setData((d) => ({ ...d, rewards: d.rewards.filter((r) => r.id !== id) }));
    notify('Recompensa removida.');
  };
  const redeemReward = (id: string) => {
    const reward = data.rewards.find((r) => r.id === id);
    if (!reward) return;
    if (pointsBalance(data.activity) < reward.cost) { notify('Ainda faltam pontos para esse resgate.'); return; }
    setData((d) => {
      const current = d.rewards.find((r) => r.id === id);
      if (!current || pointsBalance(d.activity) < current.cost) return d;
      return { ...d, activity: [{ id: uid(), at: stamped(), kind: 'redeem', label: current.title, points: -current.cost }, ...d.activity] };
    });
    notify('Recompensa resgatada. Aproveite sem pressa!');
  };
  const addDemo = () => { setData((d) => withDemo(d)); notify('Exemplos adicionados e identificados.'); };
  const removeDemo = () => { setData((d) => ({ ...d, entries: d.entries.filter((e) => e.source !== 'demo'), focus: d.focus && d.entries.some((e) => e.id === d.focus?.entryId && e.source === 'demo') ? null : d.focus })); notify('Registros de demonstração removidos.'); };
  const restore = (next: AppData) => { setData(next); notify('Backup carregado nesta aba.'); };
  const clearAll = () => { setData(emptyData()); deletedRef.current = null; notify('Espaço reiniciado nesta aba.'); };

  return <Context.Provider value={{ data, ready, loadFailed, saveError, toast, dismissToast, notify, visitSubject, saveSubject, removeSubject, saveNote, updateNote, removeNote, saveFlashcard, removeFlashcard, updateProfile, addEntry, editEntry,
    completeEntry, reopenEntry, postponeEntry, archiveEntry, restoreEntry, deleteEntry, undoDelete, divideEntry, addStep, toggleStep,
    startFocus, finishFocus, startBreak, finishBreak, addReward, deleteReward, redeemReward, addDemo,
    removeDemo, restore, clearAll }}>
    {children}
  </Context.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(Context);
  if (!context) throw new Error('useApp exige AppProvider');
  return context;
}
