import { describe, expect, it } from 'vitest';
import { emptyData } from '../types';
import { validateData } from './storage';

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
