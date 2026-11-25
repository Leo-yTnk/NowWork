import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Clock3, LayoutGrid } from 'lucide-react';
import { Button, Surface } from '../components/ui';
import { asLocalDate, entryDueLabel, weekActivity } from '../lib/engine';
import { recommendations, intentionPrompt } from '../lib/decision';
import { dayCapacity, dueOnOrBefore } from '../lib/planning';
import { dayOffset } from '../lib/localDates';
import { dueReviews } from '../lib/learning';
import { sameRef } from '../lib/capture';
import { areas, routeHref, subjectViews, type SubjectView } from '../lib/navigation';
import { subjectShortcuts } from '../lib/subjectShortcuts';
import { useApp } from '../state/AppState';
import { describeRecord } from '../components/RecordLinks';
import { CapacitySummary } from './CapacityPlanner';
import { SubjectMark } from './Subjects';
import morningIllustration from '../assets/hero/morning.webp';
import afternoonIllustration from '../assets/hero/afternoon.webp';
import eveningIllustration from '../assets/hero/evening.webp';
import nightIllustration from '../assets/hero/night.webp';

const heroPeriods = [
  { start: 19, image: nightIllustration, greeting: 'Boa noite' },
  { start: 17, image: eveningIllustration, greeting: 'Bom fim de tarde' },
  { start: 12, image: afternoonIllustration, greeting: 'Boa tarde' },
  { start: 5, image: morningIllustration, greeting: 'Bom dia' },
] as const;
const agenda = routeHref({ area: 'planejar', view: 'agenda' });
const inbox = routeHref({ area: 'planejar', view: 'entrada' });

export function Dashboard({ subject, focus, capture, openTask }: {
  subject: (id: string, view: SubjectView) => void; focus: () => void; capture: () => void; openTask: (id: string) => void;
}) {
  const app = useApp();
  const { data } = app;
  const [now, setNow] = useState(() => new Date());
  const [expanded, setExpanded] = useState(false);
  const [choose, setChoose] = useState(false);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 20_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const today = asLocalDate(now.toISOString());
  const tomorrow = dayOffset(today, 1);
  const plan = data.days.find((day) => day.day === today);
  const hero = heroPeriods.find(({ start }) => now.getHours() >= start) ?? heroPeriods[0];
  const capacity = dayCapacity(data, today);
  const events = data.entries.filter((entry) => entry.kind === 'event' && entry.status === 'active' && entry.dueAt &&
    Date.parse(entry.dueAt) >= +now && asLocalDate(entry.dueAt) <= dayOffset(today, 7)).sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
  const due = dueReviews(data, today);
  const candidates = recommendations(data, now);
  const accepted = candidates.filter(({ ref }) => !plan?.skipped?.some((skipped) => sameRef(skipped, ref)));
  const recommendation = data.cognitive.recommendations && !plan?.closed && !plan?.rest
    ? accepted.find(({ ref }) => plan?.pinned && sameRef(plan.pinned, ref)) ?? accepted[0] : undefined;
  const priorities = accepted.flatMap((item) => item.type === 'task' && item.entry.id !== recommendation?.ref.id ? [item.entry] : []);
  const tasks = data.entries.filter((entry) => entry.kind === 'task' && entry.status === 'active');
  const relevant = tasks.filter((entry) => dueOnOrBefore(entry, today) || !!entry.intention);
  const pendingInbox = data.entries.filter((entry) => entry.status === 'active' && ['capture', 'idea', 'worry'].includes(entry.kind));
  const progress = weekActivity(data, now).at(-1)!;
  const confirmedMinutes = Math.floor(data.activity.filter((item) => asLocalDate(item.at) === today).reduce((sum, item) => sum + (item.effectiveSeconds ?? 0), 0) / 60);
  const shortcuts = subjectShortcuts(data.subjects, data.subjectVisits, now);
  const status = plan?.rest ? 'Dia de descanso' : plan?.closed || (progress.completed > 0 && !tasks.length && !events.some((item) => asLocalDate(item.dueAt) === today) && !due.length)
    ? 'Dia concluído' : capacity.excess > 0 ? 'Dia com excesso de atividades' : data.focus || progress.completed > 0 ? 'Dia em andamento'
      : capacity.blocks.length || capacity.planned || due.length || events.some((item) => asLocalDate(item.dueAt) === today) ? 'Dia planejado' : 'Dia sem atividades planejadas';
  const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const nextDisplay = recommendation && describeRecord(data, recommendation.ref);
  const completed = data.entries.filter((entry) => entry.kind === 'task' && asLocalDate(entry.completedAt) === today);
  const reviewSubjects = [...new Set(due.map(({ subjectId }) => subjectId))];
  return <div className="nw-stack nw-dashboard">
    <header className="surface nw-welcome" data-variant="editorial">
      <div className="nw-welcome-media">
        <img className="nw-welcome-image" src={hero.image} alt="" fetchPriority="high" decoding="async" />
      </div>
      <div className="nw-welcome-copy"><time className="nw-date" dateTime={today}><CalendarDays size={15} aria-hidden="true" />{date}</time>
        <h1>{hero.greeting}{data.profile.name.trim() ? ', ' + data.profile.name.trim() : ''}!</h1><p>{status}</p></div>
    </header>
    <div className="today-lead">
      <Surface className="nw-focus-card today-next" variant="grouped">
        <div className="nw-focus-content nw-stack">
          <span className="nw-focus-label"><Clock3 size={16} /> Próxima ação</span>
          {data.focus || data.break ? <><h2>{data.focus ? 'Retomar a sessão de foco' : 'Pausa em andamento'}</h2>
            <Button variant="primary" onClick={focus}>Abrir sessão</Button></> : nextDisplay && recommendation ?
            <><h2>{nextDisplay.title}</h2><p>{recommendation.reason} · {recommendation.minutes} min</p>
              <div className="nw-toolbar"><Button variant="primary" icon={<ArrowRight size={16} />} onClick={() => { window.location.hash = nextDisplay.href; }}>Abrir {nextDisplay.label.toLowerCase()}</Button>
              <Button size="sm" onClick={() => app.updateDay(today, { pinned: undefined, skipped: [...(plan?.skipped ?? []), recommendation.ref] })}>Ignorar hoje</Button>
              <Button size="sm" onClick={() => setChoose(!choose)} aria-expanded={choose}>Escolher outra</Button></div></>
            : <><h2>{plan?.rest ? 'Tempo reservado para descansar' : plan?.closed ? 'Planejamento encerrado' : 'Escolha seu próximo passo'}</h2>
              {plan?.closed ? <p>As informações do dia estão guardadas e podem ser retomadas quando você quiser.</p> : <Button onClick={capture}>Capturar algo</Button>}</>}
          {choose && <label className="field-label">Escolher próxima ação<select className="ds-input" value={plan?.pinned ? plan.pinned.type + ':' + plan.pinned.id : ''}
            onChange={(event) => {
              const choice = candidates.find(({ ref }) => ref.type + ':' + ref.id === event.target.value);
              app.updateDay(today, { pinned: choice?.ref, skipped: plan?.skipped?.filter((ref) => !choice || !sameRef(ref, choice.ref)) });
              setChoose(false);
            }}><option value="">Usar recomendação</option>{candidates.map(({ ref }) =>
              <option key={ref.type + ref.id} value={ref.type + ':' + ref.id}>{describeRecord(data, ref)?.title}</option>)}</select></label>}
          <details className="cognitive-details"><summary>Opções do dia</summary><div className="nw-toolbar">
            <Button size="sm" onClick={() => app.updateCognitive({ recommendations: !data.cognitive.recommendations })}>{data.cognitive.recommendations ? 'Desativar' : 'Ativar'} recomendações</Button>
            <Button size="sm" onClick={() => app.updateDay(today, { rest: !plan?.rest })}>{plan?.rest ? 'Retomar planejamento' : 'Marcar dia de descanso'}</Button>
            {!!plan?.skipped?.length && <Button size="sm" onClick={() => app.updateDay(today, { skipped: [] })}>Reconsiderar ações</Button>}
          </div></details>
        </div>
      </Surface>
      <Surface className="today-checklist" variant="grouped"><h2 className="nw-small-heading">Prioridades do dia</h2>
        {priorities.length ? <ul>{priorities.slice(0, expanded ? undefined : 3).map((task) => <li key={task.id}>
          <input type="checkbox" aria-label={'Concluir ' + task.title} checked={false} onChange={() => app.completeEntry(task.id)} />
          <button type="button" onClick={() => openTask(task.id)}>{task.title}<small>{intentionPrompt(task, data, now) ?? entryDueLabel(task, now)}</small></button>
        </li>)}</ul> : <p className="nw-muted">Nenhuma outra prioridade disponível.</p>}
        {priorities.length > 3 && <Button size="sm" variant="ghost" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Mostrar menos' : 'Mostrar todas'}</Button>}
      </Surface>
    </div>
    <Surface className="today-overview" variant="grouped">
      <section><h2 className="nw-small-heading">Compromissos próximos</h2>
        {events.length ? <ul className="cognitive-list">{events.slice(0, 4).map((entry) => <li key={entry.id}><a href={routeHref({ area: 'planejar', view: 'tarefas', entryId: entry.id })}>{entry.title}</a> · {entryDueLabel(entry, now)}</li>)}</ul>
          : <p className="nw-muted">Nenhum compromisso nos próximos sete dias.</p>}
        <a href={agenda}>Abrir agenda</a>
      </section>
      <section><h2 className="nw-small-heading">Revisões programadas</h2>
        {due.length ? <><p>{due.length} {due.length === 1 ? 'cartão disponível' : 'cartões disponíveis'} para revisar hoje.</p>
          <ul className="cognitive-list">{reviewSubjects.slice(0, 4).map((id) => <li key={id}><a href={routeHref({ area: 'materias', subjectId: id, view: 'revisao' })}>{data.subjects.find((item) => item.id === id)?.title}</a></li>)}</ul></>
          : <p className="nw-muted">Nenhuma revisão prevista para hoje.</p>}
      </section>
      <section><h2 className="nw-small-heading">Capacidade diária</h2><CapacitySummary capacity={capacity} /><a href={agenda}>Ajustar na agenda</a></section>
      <section><h2 className="nw-small-heading">Pendências relevantes</h2>
        <ul className="cognitive-list">{relevant.slice(0, 4).map((entry) => <li key={entry.id}><a href={routeHref({ area: 'planejar', view: 'tarefas', entryId: entry.id })}>{entry.title}</a></li>)}</ul>
        <a href={inbox}>Caixa de entrada · {pendingInbox.length} a processar</a>
      </section>
      <section><h2 className="nw-small-heading">Resumo de progresso</h2>
        <p>{progress.completed} {progress.completed === 1 ? 'tarefa concluída' : 'tarefas concluídas'} hoje{confirmedMinutes > 0 ? ' · ' + confirmedMinutes + ' min de estudo efetivo confirmado' : ''}</p>
        <a href={routeHref({ area: 'estudar', view: 'progresso' })}>Ver progresso e revisão semanal</a>
      </section>
      <details className="cognitive-details">
        <summary>Revisar e encerrar o dia</summary>
        <p>Concluídas: {completed.length ? completed.map(({ title }) => title).join(', ') : 'nenhuma hoje'}.</p>
        <p>Amanhã: {data.entries.filter((entry) => entry.kind === 'event' && entry.status === 'active' && asLocalDate(entry.dueAt) === tomorrow)
          .map(({ title }) => title).join(', ') || 'sem compromissos registrados'}. {dueReviews(data, tomorrow).length} revisões disponíveis até amanhã.</p>
        <p><a href={inbox}>{pendingInbox.length} capturas a processar</a></p>
        <ul className="cognitive-list">{relevant.slice(0, 6).map((task) => <li key={task.id} className="cognitive-line">
          <a href={routeHref({ area: 'planejar', view: 'tarefas', entryId: task.id })}>{task.title}</a>
          <Button size="sm" onClick={() => app.planEntry(task.id, tomorrow)}>Planejar para amanhã</Button></li>)}</ul>
        <label className="field-label">Próxima ação ou nota para amanhã<textarea className="ds-input" rows={2} value={plan?.reflection ?? ''}
          onChange={(event) => app.updateDay(today, { reflection: event.target.value })} /></label>
        <Button size="sm" onClick={() => app.updateDay(today, { closed: !plan?.closed })}>{plan?.closed ? 'Reabrir o dia' : 'Encerrar planejamento'}</Button>
      </details>
    </Surface>
    {shortcuts.length > 0 && <details className="cognitive-details"><summary><LayoutGrid size={16} /> Atalhos de matérias</summary>
      <div className="subject-grid today-shortcuts">{shortcuts.map((item) => <Surface key={item.id} className="today-subject">
        <div className="today-subject-heading"><SubjectMark subject={item} /><strong>{item.title}</strong></div>
        <div className="today-subject-actions">{subjectViews.map(({ id, label }) => <Button key={id} size="sm" variant="ghost"
          onClick={() => subject(item.id, id)}>{label}</Button>)}</div></Surface>)}</div>
      <a href={routeHref(areas.materias)}>Ver todas as matérias</a>
    </details>}
  </div>;
}
