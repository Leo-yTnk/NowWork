import { useState } from 'react';
import { Button } from '../components/ui';
import { reviewModes } from '../lib/learning';
import { REVIEW_MODES, type Flashcard } from '../types';

export function FlashcardForm({ card, save, close }: { card: Flashcard; save: (card: Flashcard) => void; close: () => void }) {
  const [draft, setDraft] = useState(card);
  return <form className="nw-stack" onSubmit={(event) => {
    event.preventDefault();
    if (!draft.front.trim() || !draft.back.trim()) return;
    save({ ...draft, front: draft.front.trim(), back: draft.back.trim(), topic: draft.topic?.trim() || undefined });
  }}>
    <details className="cognitive-details"><summary>Formato, tópico e prazo acadêmico</summary>
      <div className="cognitive-form-grid">
        <label className="field-label">Formato<select className="ds-input" value={draft.mode ?? 'flashcard'}
          onChange={(event) => setDraft({ ...draft, mode: event.target.value as Flashcard['mode'] })}>
          {REVIEW_MODES.map((mode) => <option key={mode} value={mode}>{reviewModes[mode]}</option>)}
        </select></label>
        <label className="field-label">Tópico (opcional)<input className="ds-input" maxLength={100} value={draft.topic ?? ''} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} /></label>
        <label className="field-label">Prazo acadêmico (opcional)<input className="ds-input" type="date" value={draft.examDay ?? ''} onChange={(event) => setDraft({ ...draft, examDay: event.target.value || undefined })} /></label>
      </div>
    </details>
    <label className="field-label">{draft.mode === 'cloze' ? 'Frase com a lacuna indicada por ___' : 'Pergunta ou instrução'}
      <textarea className="ds-input" required rows={2} maxLength={1000} value={draft.front} onChange={(event) => setDraft({ ...draft, front: event.target.value })} /></label>
    <label className="field-label">Resposta ou referência para correção<textarea className="ds-input" required rows={3} maxLength={5000}
      value={draft.back} onChange={(event) => setDraft({ ...draft, back: event.target.value })} /></label>
    <div className="nw-toolbar"><Button type="submit" variant="primary" disabled={!draft.front.trim() || !draft.back.trim()}>Salvar cartão</Button><Button onClick={close}>Cancelar</Button></div>
  </form>;
}
