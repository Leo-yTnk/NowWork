import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyData, type Activity, type Entry } from '../types';
import { loadData, StorageConflictError, validateData } from './storage';

describe('NowWork backups', () => {
  it('opens Brisa version 1 data without losing records or preferences', () => {
    const { subjects, notes, flashcards, ...legacy } = emptyData();
    const oldTask = { id: 'old', title: 'Revisar geografia', note: 'Capítulo 2', kind: 'task', status: 'active' };
    const restored = validateData({ ...legacy, entries: [oldTask], profile: { ...legacy.profile, name: 'Estudante' } });
    expect(restored.entries[0]).toMatchObject(oldTask);
    expect(restored.profile.name).toBe('Estudante');
    expect(restored.subjects).toEqual(subjects);
    expect(restored.notes).toEqual([]);
    expect(restored.flashcards).toEqual([]);
  });

  it('restores the new subject data, block order, checklist and review date', () => {
    const data = emptyData();
    const note = {
      id: 'note', subjectId: 'math', title: 'Frações', updatedAt: '2026-11-18T10:00:00Z',
      blocks: [
        { id: 'step', type: 'check', text: 'Resolver exercício', checked: true, url: undefined },
        { id: 'link', type: 'link', text: 'Material', checked: false, url: 'https://example.org/' },
      ],
    };
    const card = { id: 'card', subjectId: 'math', front: 'O que é o denominador?', back: 'O número de partes iguais.', due: '2026-11-20', interval: 2 };
    const restored = validateData(JSON.parse(JSON.stringify({ ...data, notes: [note], flashcards: [card] })));
    expect(restored.notes).toEqual([note]);
    expect(restored.flashcards).toEqual([card]);
  });

  it('preserves an explicit font and a saved weight after changing the notebook default font', () => {
    const data = emptyData();
    data.profile.editorTypography = { h1: { font: 'Inter Tight', weight: 900 }, p: { weight: 100 } };

    const restored = validateData(data);

    expect(restored.profile.editorTypography).toEqual(data.profile.editorTypography);
  });
});

describe('Large local workspaces', () => {
  it('round-trips pages, steps, records and history above the old limits', () => {
    const data = emptyData();
    data.notes = Array.from({ length: 2001 }, (_, index) => ({
      id: 'note-' + index, subjectId: 'math', title: 'Página ' + index, blocks: [],
      updatedAt: '2026-11-18T10:00:00Z',
    }));
    data.entries = Array.from({ length: 3001 }, (_, index): Entry => ({
      id: 'task-' + index, title: 'Tarefa ' + index, note: '', kind: 'task', status: 'active',
      importance: 2, effort: 2, minutes: 25, dueAt: null,
      steps: [], postponeCount: 0, source: 'user', createdAt: '2026-11-18T10:00:00Z',
      updatedAt: '2026-11-18T10:00:00Z', completedAt: null,
    }));
    data.entries[0].steps = Array.from({ length: 61 }, (_, index) => ({
      id: 'step-' + index, title: 'Etapa ' + index, done: false, awarded: false,
    }));
    data.activity = Array.from({ length: 20001 }, (_, index): Activity => ({
      id: 'activity-' + index, at: '2026-11-18T10:00:00Z', kind: 'complete', label: 'Tarefa', points: 0,
    }));

    const restored = validateData(JSON.parse(JSON.stringify(data)));

    expect(restored.notes).toHaveLength(2001);
    expect(restored.notes.at(-1)).toEqual(data.notes.at(-1));
    expect(restored.entries).toHaveLength(3001);
    expect(restored.entries[0].steps).toEqual(data.entries[0].steps);
    expect(restored.activity).toHaveLength(20001);
  });
});

describe('Local fallback saves', () => {
  afterEach(() => vi.unstubAllGlobals());

  function useFallback(initial: string | null) {
    const setItem = vi.fn((_key: string, value: string) => { initial = value; });
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', { getItem: () => initial, setItem });
    vi.stubGlobal('navigator', { locks: { request: (_key: string, write: () => void) => Promise.resolve().then(write) } });
    return setItem;
  }

  it('keeps a newer save when another tab still has an older copy', async () => {
    const setItem = useFallback(null);
    const first = await loadData();
    const second = await loadData();
    await first.save({ ...first.data, profile: { ...first.data.profile, name: 'Primeira aba' } });
    await expect(second.save(second.data)).rejects.toBeInstanceOf(StorageConflictError);
    expect(setItem).toHaveBeenCalledTimes(1);
    const reopened = await loadData();
    expect(reopened.data.profile.name).toBe('Primeira aba');
  });

  it('reports malformed data without replacing it with a new workspace', async () => {
    const setItem = useFallback('{');
    await expect(loadData()).rejects.toThrow();
    expect(setItem).not.toHaveBeenCalled();
  });
});
