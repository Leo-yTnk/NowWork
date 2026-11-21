import { useState, type FormEvent } from 'react';
import { Layers, Pencil, Trash2 } from 'lucide-react';
import { Button, CreateButton, EmptyState, Surface } from '../components/ui';
import { useApp } from '../state/AppState';
import { uid, type Flashcard } from '../types';
import { asLocalDate } from '../lib/engine';

export function Review({ subjectId }: { subjectId: string }) {
  const app = useApp();
  const cards = app.data.flashcards.filter((card) => card.subjectId === subjectId);
  const now = asLocalDate(new Date().toISOString());
  const due = cards.filter((card) => card.due <= now).sort((a, b) => a.due.localeCompare(b.due));
  const next = due[0];
  const [revealed, setRevealed] = useState<string | null>(null);
  const [draft, setDraft] = useState<Flashcard | null>(null);
  const [graded, setGraded] = useState(0);
  const grade = (card: Flashcard, remembered: boolean) => {
    const interval = remembered ? Math.min(60, Math.max(2, card.interval * 2)) : 1;
    const date = new Date();
    date.setDate(date.getDate() + interval);
    app.saveFlashcard({ ...card, interval, due: asLocalDate(date.toISOString()) });
    setRevealed(null);
    setGraded((count) => count + 1);
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!draft?.front.trim() || !draft.back.trim()) return;
    app.saveFlashcard({ ...draft, front: draft.front.trim(), back: draft.back.trim() });
    setDraft(null);
  };
  return <div className="nw-stack">
    <div className="nw-section-heading"><div><h2>Revisão espaçada</h2><span className="nw-muted">{due.length} para revisar hoje{graded > 0 && ` · ${graded} nesta sessão`}</span></div>
      <CreateButton onClick={() => setDraft({ id: uid(), subjectId, front: '', back: '', due: now, interval: 0 })}>Novo cartão</CreateButton></div>
    {draft && <Surface className="nw-padding"><form className="nw-stack" onSubmit={save}>
      <label className="field-label">Pergunta<textarea required rows={2} maxLength={1000} value={draft.front} onChange={(event) => setDraft({ ...draft, front: event.target.value })} /></label>
      <label className="field-label">Resposta<textarea required rows={3} maxLength={5000} value={draft.back} onChange={(event) => setDraft({ ...draft, back: event.target.value })} /></label>
      <div className="nw-toolbar"><Button type="submit" variant="primary">Salvar cartão</Button><Button onClick={() => setDraft(null)}>Cancelar</Button></div>
    </form></Surface>}
    {next ? <Surface className="nw-review-card" layout>
      <span className="nw-muted">Pergunta</span><h3>{next.front}</h3>
      {revealed === next.id ? <div className="nw-stack"><div className="nw-answer">{next.back}</div><div className="nw-toolbar">
        <Button onClick={() => grade(next, false)}>Rever amanhã</Button>
        <Button variant="primary" onClick={() => grade(next, true)}>Lembrei · {Math.min(60, Math.max(2, next.interval * 2))} dias</Button>
      </div></div> : <Button onClick={() => setRevealed(next.id)}>Mostrar resposta</Button>}
    </Surface> : <Surface><EmptyState icon={<Layers size={23} />} title={cards.length ? 'Revisões em dia' : 'Crie seu primeiro cartão'}
      description={cards.length ? 'Os próximos cartões aparecem aqui na data programada.' : 'Transforme um conceito em uma pergunta e tente responder antes de conferir.'} /></Surface>}
    {cards.length > 0 && <div className="nw-stack"><h2 className="nw-small-heading">Todos os cartões</h2>{cards.map((card) => <Surface className="nw-list-card" key={card.id}>
      <div><strong>{card.front}</strong><span className="nw-muted"> {card.due <= now ? 'Para revisar' : new Date(card.due + 'T12:00:00').toLocaleDateString('pt-BR')}</span></div>
      <button type="button" className="nw-icon" aria-label="Editar cartão" onClick={() => setDraft(card)}><Pencil size={16} /></button>
      <button type="button" className="nw-icon" aria-label="Excluir cartão" onClick={() => {
        if (window.confirm('Excluir este cartão de revisão?')) { app.removeFlashcard(card.id); if (draft?.id === card.id) setDraft(null); }
      }}><Trash2 size={16} /></button>
    </Surface>)}</div>}
  </div>;
}
