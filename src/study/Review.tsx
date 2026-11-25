import { useState } from 'react';
import { Layers, Pencil, Trash2 } from 'lucide-react';
import { Button, Card, CreateButton, EmptyState, Surface } from '../components/ui';
import { RecordLinks } from '../components/RecordLinks';
import { useApp } from '../state/AppState';
import { uid, type Flashcard, type ReviewGrade } from '../types';
import { asLocalDate } from '../lib/engine';
import { dueReviews, gradeLabels, reviewModes, reviewedOn, scheduleReview } from '../lib/learning';
import { dayOffset } from '../lib/localDates';
import { FlashcardForm } from './FlashcardForm';
import { dayCapacity } from '../lib/planning';

export function Review({ subjectId, selectedId }: { subjectId: string; selectedId?: string }) {
  const app = useApp();
  const cards = app.data.flashcards.filter((card) => card.subjectId === subjectId);
  const now = asLocalDate(new Date().toISOString());
  const [topic, setTopic] = useState('');
  const [played, setPlayed] = useState(0);
  const [continued, setContinued] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState('');
  const [draft, setDraft] = useState<Flashcard | null>(null);
  const [finishedSelected, setFinishedSelected] = useState(false);
  const due = dueReviews(app.data, now).filter((card) => card.subjectId === subjectId && (!topic || card.topic === topic));
  const capacity = dayCapacity(app.data, now);
  const reviewMinutes = Math.min(app.data.cognitive.reviewMinutes, capacity.configured ? Math.max(0, capacity.free - capacity.margin - capacity.planned) : Infinity);
  const planned = Math.floor(reviewMinutes / 3);
  const reached = !continued && Math.max(played, reviewedOn(app.data, now)) >= planned;
  const direct = !finishedSelected ? cards.find(({ id }) => id === selectedId) : undefined;
  const next = direct ?? (!reached ? due[0] : undefined);
  const grade = (card: Flashcard, result: ReviewGrade) => {
    app.saveFlashcard(scheduleReview(card, result, new Date()));
    setRevealed(null);
    setAttempt('');
    if (card.id === selectedId) setFinishedSelected(true);
    setPlayed((count) => count + 1);
  };
  return <div className="nw-stack">
    <div className="nw-section-heading nw-wrap"><div><h2>Revisão espaçada</h2><span className="nw-muted">{due.length} para revisar hoje{played > 0 && ' · ' + played + ' nesta sessão'}</span></div>
      <CreateButton onClick={() => setDraft({ id: uid(), subjectId, front: '', back: '', due: now, interval: 0 })}>Novo cartão</CreateButton></div>
    {cards.some((card) => card.topic) && <label className="field-label">Revisar por tópico<select className="ds-input" value={topic} onChange={(event) => {
      setTopic(event.target.value); setAttempt(''); setRevealed(null); setFinishedSelected(true);
    }}><option value="">Todos</option>{[...new Set(cards.flatMap((card) => card.topic ? [card.topic] : []))].map((label) => <option key={label}>{label}</option>)}</select></label>}
    {draft && <Surface className="nw-padding"><FlashcardForm key={draft.id} card={draft}
      save={(card) => { app.saveFlashcard(card); setDraft(null); }} close={() => setDraft(null)} /></Surface>}
      {next ? <Card className="nw-review-card" layout>
      <span className="nw-muted">{reviewModes[next.mode ?? 'flashcard']}</span><h3>{next.front}</h3>
      {revealed === next.id ? <div className="nw-stack">{attempt.trim() && <p className="cognitive-content">Sua tentativa: {attempt}</p>}
        <div className="nw-answer">{next.back}</div>
        <p className="nw-muted">{next.mode === 'explain' || next.mode === 'open' ? 'Compare o raciocínio, os exemplos e os pontos que ficaram de fora.' : 'Compare sua tentativa com a resposta e avalie quanto conseguiu recuperar.'}</p>
        <div className="nw-toolbar">{Object.entries(gradeLabels).map(([result, label]) =>
          <Button key={result} onClick={() => grade(next, result as ReviewGrade)}>{label}</Button>)}</div>
      </div> : <form className="nw-stack" onSubmit={(event) => { event.preventDefault(); setRevealed(next.id); }}>
        <label className="field-label">Sua tentativa (opcional)<textarea rows={3} value={attempt} onChange={(event) => setAttempt(event.target.value)} /></label>
        <div className="nw-toolbar"><Button variant="primary" type="submit">{attempt.trim() ? 'Conferir resposta' : 'Mostrar resposta'}</Button>
          <Button onClick={() => { app.saveFlashcard({ ...next, due: dayOffset(now, 1) }); setFinishedSelected(true); setAttempt(''); }}>Reagendar para amanhã</Button></div>
      </form>}
      <RecordLinks record={{ type: 'card', id: next.id }} />
    </Card> : <Surface><EmptyState icon={<Layers size={23} />} title={due.length && reached ? 'Limite sugerido de revisão para hoje' : cards.length ? 'Revisões em dia' : 'Crie seu primeiro cartão'}
      description={due.length && reached ? 'Você pode continuar agora ou retomar as revisões restantes mais tarde.' : 'Os cartões ficam disponíveis de acordo com as datas programadas.'}
      action={due.length && reached ? <Button onClick={() => setContinued(true)}>Continuar revisão</Button> : undefined} /></Surface>}
    {cards.length > 0 && <details className="cognitive-details"><summary>Todos os cartões ({cards.length})</summary>
      <div className="nw-stack">{cards.map((card) => <Card className="nw-list-card" key={card.id}>
        <div><strong>{card.front}</strong><p className="nw-muted">{card.due <= now ? 'Para revisar' : new Date(card.due + 'T12:00:00').toLocaleDateString('pt-BR')}</p></div>
        <div className="nw-toolbar"><button type="button" className="nw-icon" aria-label={'Editar cartão ' + card.front} onClick={() => setDraft(card)}><Pencil size={16} /></button>
        <button type="button" className="nw-icon" aria-label={'Excluir cartão ' + card.front} onClick={() => {
          if (window.confirm('Excluir este cartão de revisão e seu histórico?')) { app.removeFlashcard(card.id); if (draft?.id === card.id) setDraft(null); }
        }}><Trash2 size={16} /></button></div>
      </Card>)}</div>
    </details>}
  </div>;
}
