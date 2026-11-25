import { useApp } from '../state/AppState';
import { Button, Surface } from '../components/ui';
import { asLocalDate, weekActivity } from '../lib/engine';
import { dueReviews } from '../lib/learning';
import { dayOffset } from '../lib/localDates';
import { dayCapacity } from '../lib/planning';
import { routeHref } from '../lib/navigation';

const planningLink = routeHref({ area: 'planejar', view: 'agenda' });
const inboxLink = routeHref({ area: 'planejar', view: 'entrada' });

export function Evolucao() {
  const app = useApp();
  const { data } = app;
  const today = asLocalDate(new Date().toISOString());
  const from = dayOffset(today, -6);
  const end = dayOffset(today, 7);
  const weekday = new Date(today + 'T12:00:00').getDay();
  const weekStart = dayOffset(today, -((weekday + 6) % 7));
  const plan = data.days.find((item) => item.day === weekStart);
  const series = weekActivity(data);
  const events = data.activity.filter((event) => asLocalDate(event.at) >= from);
  const focus = events.filter((event) => event.effectiveSeconds && event.entryId);
  const completed = data.entries.filter((entry) => entry.kind === 'task' && asLocalDate(entry.completedAt) >= from);
  const reviews = data.flashcards.flatMap((card) => (card.history ?? []).map((attempt) => ({ ...attempt, subjectId: card.subjectId })))
    .filter((attempt) => asLocalDate(attempt.at) >= from);
  const attemptsDays = new Set(reviews.map(({ at }) => asLocalDate(at)));
  const difficulties = data.flashcards.filter((card) => (card.history ?? []).slice(-4).filter(({ grade }) => grade === 'forgot' || grade === 'hard').length >= 2);
  const nextReviews = dueReviews(data, end);
  const effective = Math.floor(focus.reduce((sum, item) => sum + (item.effectiveSeconds ?? 0), 0) / 60);
  const comparative = completed.flatMap((entry) => {
    const sessions = data.activity.filter((event) => event.entryId === entry.id && event.effectiveSeconds);
    const estimate = sessions.at(-1)?.estimateMinutes;
    return estimate ? [{ title: entry.title, estimate, actual: Math.round(sessions.reduce((sum, event) => sum + event.effectiveSeconds!, 0) / 60) }] : [];
  });
  const recurring = new Map<string, number>();
  for (const task of completed) {
    const label = task.activityType?.trim() || task.title;
    recurring.set(label, (recurring.get(label) ?? 0) + 1);
  }
  const repeated = [...recurring].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]);
  const load = Array.from({ length: 7 }, (_, index) => {
    const day = dayOffset(today, index);
    const capacity = dayCapacity(data, day);
    return { day, minutes: capacity.study + capacity.planned };
  }).filter(({ minutes }) => minutes > 0);
  return <div className="nw-stack">
    <Surface className="nw-padding nw-stack"><h2>Últimos sete dias</h2>
      <dl className="cognitive-metrics">
        <div><dt>Tarefas concluídas</dt><dd>{completed.length}</dd></div>
        {focus.length > 0 && <div><dt>Estudo efetivo confirmado</dt><dd>{effective} min</dd></div>}
        {reviews.length > 0 && <><div><dt>Dias com revisão</dt><dd>{attemptsDays.size}</dd></div>
          <div><dt>Recuperações boas ou fáceis</dt><dd>{reviews.filter(({ grade }) => grade === 'good' || grade === 'easy').length} de {reviews.length}</dd></div></>}
      </dl>
      {completed.length > 0 && <dl className="cognitive-metrics">{series.map((day) =>
        <div key={day.key}><dt>{day.label}</dt><dd>{day.completed}</dd></div>)}</dl>}
      {reviews.length > 0 && <p className="nw-muted">As avaliações são autorrelatos sobre os conteúdos revisados. Use-as com exercícios e explicações ao avaliar o que aprendeu.</p>}
    </Surface>
    {comparative.length > 0 && <Surface className="nw-padding nw-stack"><h2>Estimativas e tempos registrados</h2>
      <ul className="cognitive-list">{comparative.map(({ title, estimate, actual }, index) => <li key={index}>{title} · {estimate} min previstos · {actual} min confirmados</li>)}</ul>
      <p className="nw-muted">A comparação considera os trechos de trabalho que você registrou.</p>
    </Surface>}
    {data.subjects.some(({ id }) => completed.some((task) => task.subjectId === id) || reviews.some((item) => item.subjectId === id)) &&
      <Surface className="nw-padding nw-stack"><h2>Por matéria</h2>
        <ul className="cognitive-list">{data.subjects.map(({ id, title }) => {
          const done = completed.filter(({ subjectId }) => subjectId === id).length;
          const recall = reviews.filter(({ subjectId }) => subjectId === id).length;
          return done || recall ? <li key={id}>{title} · {done} tarefas concluídas · {recall} revisões avaliadas</li> : null;
        })}</ul>
      </Surface>}
    {difficulties.length > 0 && <Surface className="nw-padding nw-stack"><h2>Conteúdos para retomar</h2>
      <ul className="cognitive-list">{difficulties.slice(0, 8).map((card) => <li key={card.id}>
        <a href={routeHref({ area: 'materias', subjectId: card.subjectId, view: 'revisao', noteId: card.id })}>{card.front}</a></li>)}</ul>
    </Surface>}
    <Surface className="nw-padding"><details className="cognitive-details">
      <summary>Revisão semanal</summary>
      {comparative.length > 0 && <p>{comparative.length} atividades concluídas têm uma comparação entre estimativa e tempo confirmado.</p>}
      {repeated.length > 0 && <p>Atividades recorrentes: {repeated.map(([label, count]) => label + ' (' + count + ')').join(', ')}.</p>}
      <p>{nextReviews.length} cartões disponíveis até {new Date(end + 'T12:00:00').toLocaleDateString('pt-BR')}.</p>
      {load.length > 0 && <ul className="cognitive-list">{load.map(({ day, minutes }) =>
        <li key={day}>{new Date(day + 'T12:00:00').toLocaleDateString('pt-BR')} · {minutes} min de atividades</li>)}</ul>}
      <div className="nw-toolbar"><a href={planningLink}>Preparar agenda</a><a href={inboxLink}>Processar ou arquivar capturas</a>
        <a href={routeHref({ area: 'planejar', view: 'tarefas' })}>Reavaliar prioridades</a></div>
      <label className="field-label">Reflexão opcional<textarea className="ds-input" rows={4} value={plan?.weeklyReflection ?? ''}
        placeholder="O que funcionou? O que atrapalhou? O que posso simplificar?"
        onChange={(event) => app.updateDay(weekStart, { weeklyReflection: event.target.value })} /></label>
      <Button size="sm" onClick={() => app.notify('Reflexão guardada.')}>Concluir revisão semanal</Button>
    </details></Surface>
  </div>;
}
