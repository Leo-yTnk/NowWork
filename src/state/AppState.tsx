import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { emptyData, uid } from '../types';
import type { AppData, CaptureKind, CognitiveSettings, Continuity, DayPlan, Entry, EntryInput, Flashcard, RecordRef, Reward, Step, Subject, StudyNote } from '../types';
import { pointsBalance, pointsFor } from '../lib/engine';
import { withDemo } from '../lib/demo';
import { convertCapture, linkRecords, makeCapture, type Conversion } from '../lib/capture';
import { canApplyBlocks, cyclicDependency, isExecutable, rescheduleEntry, type BlockProposal } from '../lib/planning';
import { focusSeconds } from '../lib/learning';
import { asLocalDate } from '../lib/engine';
import { dayOffset } from '../lib/localDates';
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
  updateNote: (id: string, patch: Partial<Pick<StudyNote, 'title' | 'content' | 'topic'>>) => void;
  removeNote: (id: string) => void;
  saveFlashcard: (card: Flashcard) => void;
  removeFlashcard: (id: string) => void;
  updateProfile: (patch: Partial<AppData['profile']>) => void;
  addEntry: (entry: EntryInput) => void;
  capture: (content: string, options?: { classification?: CaptureKind; subjectId?: string; noteId?: string }) => void;
  editCapture: (id: string, content: string, classification?: CaptureKind) => void;
  processInbox: (ids: string[], action: 'archive' | 'delete' | 'defer' | 'restore' | 'subject', value?: string) => void;
  convertInbox: (ids: string[], conversion: Conversion) => void;
  link: (from: RecordRef, to: RecordRef) => void;
  updateCognitive: (patch: Partial<CognitiveSettings>) => void;
  updateDay: (day: string, patch: Omit<DayPlan, 'day'>) => void;
  applyBlocks: (proposals: BlockProposal[], suggested?: boolean) => boolean;
  removeBlock: (id: string) => void;
  planEntry: (id: string, day: string) => void;
  clearFocusMetrics: () => void;
  clearReviewMetrics: () => void;
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
  startFocus: (id: string, goal?: string, targetMinutes?: number) => void;
  toggleFocusPause: () => void;
  recordInterruption: () => void;
  saveContinuity: (id: string, continuity: Continuity) => void;
  finishFocus: (continuity?: Continuity, effective?: boolean, effectiveMinutes?: number) => void;
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

function focusEvent(focus: AppData['focus'], effective = false, effectiveMinutes?: number) {
  if (!focus) return null;
  const now = new Date();
  const seconds = Math.min(focusSeconds(focus, now), effectiveMinutes === undefined ? Infinity : Math.max(0, Math.floor(effectiveMinutes * 60)));
  if (!effective || seconds <= 0) return null;
  return { id: uid(), at: now.toISOString(), kind: 'focus' as const, label: 'Estudo efetivo confirmado', points: 0,
    minutes: Math.floor(seconds / 60), effectiveSeconds: seconds, entryId: focus.entryId, estimateMinutes: focus.estimateMinutes,
    interruptions: focus.interruptions, subjectId: focus.subjectId, activityType: focus.activityType };
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
  const undoAction = useRef<(() => void) | null>(null);
  const capturePending = useRef(new Set<string>());
  const queuedMessage = useRef<string | null>(null);
  const announce = (message: string, undo?: () => void) => {
    undoAction.current = undo ?? null;
    setToast({ id: uid(), message, undo: !!undo });
  };

  const notify = (message: string) => {
    if (data.focus) { queuedMessage.current = message; return; }
    if (undoAction.current) return;
    announce(message);
  };
  const dismissToast = () => { undoAction.current = null; setToast(null); };

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
  useLayoutEffect(() => {
    const local = workspace.current;
    if (!ready || !local || data === lastScheduled.current) return;
    lastScheduled.current = data;
    const captures = [...capturePending.current].filter((id) => data.entries.some((entry) => entry.id === id));
    for (const id of captures) capturePending.current.delete(id);
    local.save(data).then(() => {
      setSaveError(null);
      if (captures.length) announce('Captura guardada.', () => setData((current) => ({
        ...current, entries: current.entries.filter((entry) => !captures.includes(entry.id) || entry.capture?.convertedTo),
        links: current.links.filter((edge) => ![edge.from, edge.to].some((ref) => ref.type === 'entry' && captures.includes(ref.id) &&
          !current.entries.find((entry) => entry.id === ref.id)?.capture?.convertedTo)),
      })));
    }).catch((error: unknown) => {
      setSaveError(error instanceof StorageConflictError ? error.message : local.warning ?? 'O salvamento local falhou. Exporte um backup para guardar suas mudanças.');
    });
  }, [data, ready]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismissToast, toast.undo ? 10000 : 4500);
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
  const updateNote = (id: string, patch: Partial<Pick<StudyNote, 'title' | 'content' | 'topic'>>) => setData((d) => ({
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
  const capture: AppContextValue['capture'] = (content, options = {}) => {
    if (!content.trim() || !ready) return;
    const entry = makeCapture(content, options);
    capturePending.current.add(entry.id);
    setData((d) => {
      const next = { ...d, entries: [entry, ...d.entries] };
      return options.noteId ? linkRecords(next, { type: 'note', id: options.noteId }, { type: 'entry', id: entry.id }) : next;
    });
  };
  const editCapture: AppContextValue['editCapture'] = (id, content, classification) => {
    if (!content.trim()) return;
    const title = content.trim().split(/\r?\n/, 1)[0].slice(0, 200);
    setData((d) => ({ ...d, entries: d.entries.map((entry) => entry.id === id && entry.status === 'active'
      ? { ...entry, title, capture: { ...entry.capture, content, classification }, updatedAt: stamped() } : entry) }));
    notify('Captura atualizada.');
  };
  const processInbox: AppContextValue['processInbox'] = (ids, action, value) => {
    const selected = new Set(ids);
    const previous = data.entries.flatMap((entry, index) => selected.has(entry.id) ? [{ entry, index }] : []);
    const at = stamped();
    setData((d) => ({ ...d, entries: d.entries.flatMap((entry) => {
      if (!selected.has(entry.id)) return [entry];
      if (action === 'delete') return [];
      if (action === 'subject') return [{ ...entry, subjectId: value || undefined, updatedAt: at }];
      if (action === 'defer') return [{ ...entry, updatedAt: at, capture: {
        content: entry.capture?.content ?? [entry.title, entry.note].filter(Boolean).join('\n'), ...entry.capture, deferredUntil: value,
      } }];
      if (action === 'restore' && entry.capture?.convertedTo) return [entry];
      return [{ ...entry, updatedAt: at, status: action === 'archive' ? 'archived' as const : 'active' as const,
        capture: entry.capture ? { ...entry.capture, deferredUntil: undefined } : undefined }];
    }) }));
    if (action === 'delete') announce('Registros excluídos.', () => setData((d) => {
      const entries = [...d.entries];
      for (const { entry, index } of previous) if (!entries.some(({ id }) => id === entry.id)) entries.splice(index, 0, entry);
      return { ...d, entries };
    }));
    else notify(action === 'defer' ? 'Classificação adiada.' : 'Caixa de entrada atualizada.');
  };
  const convertInbox: AppContextValue['convertInbox'] = (ids, conversion) => {
    const targets = ids.map((id) => [id, uid()] as const);
    setData((d) => targets.reduce((next, [id, target]) => convertCapture(next, id, { ...conversion, answer: conversion.answers?.[id] ?? conversion.answer }, target), d));
    notify('Registros processados. O conteúdo original está no arquivo.');
  };
  const link: AppContextValue['link'] = (from, to) => setData((d) => linkRecords(d, from, to));
  const updateCognitive: AppContextValue['updateCognitive'] = (patch) => setData((d) => ({ ...d, cognitive: { ...d.cognitive, ...patch } }));
  const updateDay: AppContextValue['updateDay'] = (day, patch) => setData((d) => ({
    ...d, days: [...d.days.filter((item) => item.day !== day), { ...d.days.find((item) => item.day === day), ...patch, day }],
  }));
  const applyBlocks: AppContextValue['applyBlocks'] = (proposals, suggested = false) => {
    if (!proposals.length || !canApplyBlocks(data, proposals, suggested)) return false;
    const blocks = proposals.map((proposal) => ({ ...proposal, id: uid() }));
    setData((d) => {
      if (!canApplyBlocks(d, proposals, suggested)) return d;
      return { ...d, blocks: [...d.blocks, ...blocks] };
    });
    return true;
  };
  const removeBlock = (id: string) => {
    const removed = data.blocks.find((block) => block.id === id);
    if (!removed) return;
    setData((d) => ({ ...d, blocks: d.blocks.filter((block) => block.id !== id) }));
    announce('Bloco removido.', () => setData((d) => ({ ...d, blocks: [...d.blocks, removed] })));
  };
  const planEntry: AppContextValue['planEntry'] = (id, day) => setData((d) => rescheduleEntry(d, id, day));
  const clearFocusMetrics = () => setData((d) => ({ ...d, activity: d.activity.filter(({ kind }) => kind !== 'focus') }));
  const clearReviewMetrics = () => setData((d) => ({ ...d, flashcards: d.flashcards.map((card) => ({ ...card, history: undefined })) }));
  const editEntry = (id: string, patch: EntryInput) => {
    if (patch.dependencies?.some((dependency) => cyclicDependency(data.entries, id, dependency))) {
      notify('Escolha pré-requisitos que não dependam desta tarefa.');
      return;
    }
    setData((d) => ({ ...d, entries: d.entries.map((e) => e.id === id ? { ...e, ...patch, updatedAt: stamped() } : e) }));
    notify('Alterações salvas.');
  };
  const completeEntry = (id: string) => {
    setData((d) => {
      const entry = d.entries.find((e) => e.id === id);
      if (!entry || entry.status !== 'active') return d;
      const points = entry.kind === 'task' && !d.activity.some((item) => item.kind === 'complete' && item.entryId === id) ? pointsFor(entry) : 0;

      return {
        ...d,
        entries: d.entries.map((e) => e.id === id ? { ...e, status: 'done', completedAt: stamped(), updatedAt: stamped() } : e),
        focus: d.focus?.entryId === id ? null : d.focus,
        activity: [
          { id: uid(), at: stamped(), kind: 'complete', label: entry.title, points, entryId: id },
          ...d.activity,
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
      if (entry.kind !== 'task') return entry;
      const day = asLocalDate(stamped());
      const base = entry.plannedOn && entry.plannedOn > day ? entry.plannedOn : day;
      return { ...entry, plannedOn: dayOffset(base, 1), postponeCount: entry.postponeCount + 1, updatedAt: stamped() };
    }) }));
    notify('Atividade planejada para um dia depois.');
  };
  const archiveEntry = (id: string) => {
    setData((d) => {
      const activeFocus = d.focus?.entryId === id;

      return { ...d, entries: d.entries.map((e) => e.id === id ? { ...e, status: 'archived', updatedAt: stamped() } : e),
        focus: activeFocus ? null : d.focus };
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
    announce('Registro excluído.', () => {
      const snapshot = deletedRef.current;
      if (!snapshot) return;
      deletedRef.current = null;
      setData((d) => {
        if (d.entries.some((e) => e.id === snapshot.entry.id)) return d;
        const entries = [...d.entries];
        entries.splice(Math.min(snapshot.index, entries.length), 0, snapshot.entry);
        return { ...d, entries };
      });
    });
  };
  const undoDelete = () => {
    const undo = undoAction.current;
    if (!undo) return;
    undoAction.current = null;
    undo();
    announce('Ação desfeita.');
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
  const startFocus: AppContextValue['startFocus'] = (id, goal, targetMinutes) => {
    const at = stamped();
    setData((d) => {
      const task = d.entries.find((entry) => entry.id === id);
      if (d.focus || d.break || !task || !isExecutable(task, d.entries)) return d;
      return { ...d, focus: { entryId: id, startedAt: at, clockStartedAt: at, goal: goal?.trim(), targetMinutes,
        estimateMinutes: task.minutes, subjectId: task.subjectId, activityType: task.activityType } };
    });
  };
  const toggleFocusPause = () => {
    const now = new Date();
    setData((d) => d.focus ? { ...d, focus: d.focus.paused
      ? { ...d.focus, paused: false, clockStartedAt: now.toISOString() }
      : { ...d.focus, accruedSeconds: focusSeconds(d.focus, now), paused: true } } : d);
  };
  const recordInterruption = () => setData((d) => d.focus ? { ...d,
    focus: { ...d.focus, interruptions: (d.focus.interruptions ?? 0) + 1 } } : d);
  const saveContinuity: AppContextValue['saveContinuity'] = (id, continuity) => setData((d) => ({
    ...d, entries: d.entries.map((entry) => entry.id === id ? { ...entry, continuity } : entry),
  }));
  const finishFocus: AppContextValue['finishFocus'] = (continuity, effective, effectiveMinutes) => {
    setData((d) => {
      if (!d.focus) return d;
      const event = focusEvent(d.focus, d.cognitive.trackFocus && effective, effectiveMinutes);
      return { ...d, focus: null, activity: event ? [event, ...d.activity] : d.activity,
        entries: continuity ? d.entries.map((entry) => entry.id === d.focus?.entryId ? { ...entry, continuity } : entry) : d.entries };
    });
    const queued = queuedMessage.current;
    queuedMessage.current = null;
    if (!undoAction.current) announce(queued ? 'Sessão encerrada. ' + queued : 'Sessão encerrada.');
  };
  const startBreak = (minutes: number) => {
    const planned = Math.max(1, Math.min(60, minutes));
    setData((d) => {
      if (d.focus || d.break) return d;
      return { ...d, break: { startedAt: stamped(), minutes: planned } };
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
  const restore = (next: AppData) => {
    capturePending.current.clear();
    deletedRef.current = null;
    setData(next);
    announce('Backup carregado nesta aba.');
  };
  const clearAll = () => {
    capturePending.current.clear();
    setData(emptyData());
    deletedRef.current = null;
    announce('Espaço reiniciado nesta aba.');
  };

  return <Context.Provider value={{ data, ready, loadFailed, saveError, toast, dismissToast, notify, visitSubject, saveSubject, removeSubject, saveNote, updateNote, removeNote, saveFlashcard, removeFlashcard, updateProfile, addEntry, editEntry,
    capture, editCapture, processInbox, convertInbox, link, updateCognitive, updateDay, applyBlocks, removeBlock, planEntry, clearFocusMetrics, clearReviewMetrics,
    completeEntry, reopenEntry, postponeEntry, archiveEntry, restoreEntry, deleteEntry, undoDelete, divideEntry, addStep, toggleStep,
    startFocus, toggleFocusPause, recordInterruption, saveContinuity, finishFocus, startBreak, finishBreak, addReward, deleteReward, redeemReward, addDemo,
    removeDemo, restore, clearAll }}>
    {children}
  </Context.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(Context);
  if (!context) throw new Error('useApp exige AppProvider');
  return context;
}
