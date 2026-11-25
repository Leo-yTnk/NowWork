import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, Inbox, Plus, Timer } from 'lucide-react';
import { Button, ButtonLink, Card, Surface } from '../components/ui';
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
const progressPage = routeHref({ area: 'estudar', view: 'progresso' });
const tasksPage = routeHref(areas.planejar);
const entryHref = (entryId: string) => routeHref({ area: 'planejar', view: 'tarefas', entryId });

export function Dashboard({ subject, focus, capture, createTask, openTask }: {
  subject: (id: string, view: SubjectView) => void; focus: () => void; capture: () => void;
  createTask: () => void; openTask: (id: string) => void;
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
  const horizon = dayOffset(today, 7);
  const events = data.entries.filter((entry) => entry.kind === 'event' && entry.status === 'active' && entry.dueAt &&
    asLocalDate(entry.dueAt) >= today && asLocalDate(entry.dueAt) <= horizon)
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!));
  const due = dueReviews(data, today);
  const candidates = recommendations(data, now);
  const accepted = candidates.filter(({ ref }) => !plan?.skipped?.some((skipped) => sameRef(skipped, ref)));
  const recommendation = data.cognitive.recommendations && !plan?.closed && !plan?.rest
    ? accepted.find(({ ref }) => plan?.pinned && sameRef(plan.pinned, ref)) ?? accepted[0] : undefined;
  const priorities = accepted.flatMap((item) => item.type === 'task' && item.entry.id !== recommendation?.ref.id ? [item.entry] : []);
  const tasks = data.entries.filter((entry) => entry.kind === 'task' && entry.status === 'active');
  const belongsToToday = (entry: (typeof tasks)[number]) => dueOnOrBefore(entry, today) || entry.plannedOn === today;
  const todayTasks = tasks.filter(belongsToToday);
  const relevant = tasks.filter((entry) => belongsToToday(entry) || !!entry.intention);
  const deadlines = tasks.filter((entry) => entry.dueAt && asLocalDate(entry.dueAt) && asLocalDate(entry.dueAt) <= horizon)
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!));
  const overdue = deadlines.filter((entry) => asLocalDate(entry.dueAt) < today).length;
  const todayEvents = events.filter((entry) => asLocalDate(entry.dueAt) === today);
  const upcoming = events.filter((entry) => !entry.eventTime || Date.parse(entry.dueAt!) + entry.minutes * 60_000 > +now);
  const pendingInbox = data.entries.filter((entry) => entry.status === 'active' && ['capture', 'idea', 'worry'].includes(entry.kind));
  const week = weekActivity(data, now);
  const progress = week.at(-1)!;
  const maxCompleted = Math.max(1, ...week.map((day) => day.completed));
  const confirmedMinutes = Math.floor(data.activity.filter((item) => asLocalDate(item.at) === today).reduce((sum, item) => sum + (item.effectiveSeconds ?? 0), 0) / 60);
  const shortcuts = subjectShortcuts(data.subjects, data.subjectVisits, now);
  const latestNote = data.notes.reduce<(typeof data.notes)[number] | undefined>((latest, note) =>
    !latest || note.updatedAt > latest.updatedAt ? note : latest, undefined);
  const status = plan?.rest ? 'Dia de descanso' : plan?.closed || (progress.completed > 0 && !todayTasks.length && !todayEvents.length && !due.length)
    ? 'Dia concluído' : capacity.excess > 0 ? 'Dia com excesso de atividades' : data.focus || progress.completed > 0 ? 'Dia em andamento'
      : capacity.blocks.length || todayTasks.length || due.length || todayEvents.length ? 'Dia planejado' : 'Dia sem atividades planejadas';
  const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const nextDisplay = recommendation && describeRecord(data, recommendation.ref);
  const completed = data.entries.filter((entry) => entry.kind === 'task' && asLocalDate(entry.completedAt) === today);
  const reviewsBySubject = new Map<string, number>();
  for (const { subjectId } of due) reviewsBySubject.set(subjectId, (reviewsBySubject.get(subjectId) ?? 0) + 1);
  return <div className="nw-stack nw-dashboard">
    <Surface as="header" className="nw-welcome" variant="editorial">
      <div className="nw-welcome-media">
        <img className="nw-welcome-image" src={hero.image} alt="" fetchPriority="high" decoding="async" />
      </div>
      <div className="nw-welcome-copy"><time className="nw-date" dateTime={today}><CalendarDays size={15} aria-hidden="true" />{date}</time>
        <h1>{hero.greeting}{data.profile.name.trim() ? ', ' + data.profile.name.trim() : ''}!</h1><p>{status}</p></div>
    </Surface>
    <div className="today-actions" role="group" aria-label="Ações rápidas">
      <Button variant="primary" icon={<Plus size={17} aria-hidden="true" />} onClick={createTask}>Nova tarefa</Button>
      <Button icon={<Inbox size={17} aria-hidden="true" />} onClick={capture}>Captura rápida</Button>
      <Button icon={<Timer size={17} aria-hidden="true" />} onClick={focus}>{data.focus || data.break ? 'Abrir sessão' : 'Estudar com foco'}</Button>
    </div>
    <div className="today-lead">
      <Card className="nw-focus-card today-next" variant="grouped">
        <div className="nw-focus-content nw-stack">
          <span className="nw-focus-label"><Clock3 size={16} /> Próxima ação</span>
          {data.focus || data.break ? <><h2>{data.focus ? 'Retomar a sessão de foco' : 'Pausa em andamento'}</h2>
            <Button variant="primary" onClick={focus}>Abrir sessão</Button></> : nextDisplay && recommendation ?
            <><h2>{nextDisplay.title}</h2><p>{recommendation.reason} · {recommendation.minutes} min</p>
              <div className="nw-toolbar"><ButtonLink variant="primary" href={nextDisplay.href} icon={<ArrowRight size={16} aria-hidden="true" />}>{'Abrir ' + nextDisplay.label.toLowerCase()}</ButtonLink>
              <Button size="sm" onClick={() => app.updateDay(today, { pinned: undefined, skipped: [...(plan?.skipped ?? []), recommendation.ref] })}>Ignorar hoje</Button>
              <Button size="sm" onClick={() => setChoose(!choose)} aria-expanded={choose}>Escolher outra</Button></div></>
            : <><h2>{plan?.rest ? 'Tempo reservado para descansar' : plan?.closed ? 'Planejamento encerrado' : 'Escolha seu próximo passo'}</h2>
              {!plan?.rest && !plan?.closed && <a href={tasksPage}>Ver minhas tarefas</a>}</>}
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
      </Card>
      <Card className="today-checklist" variant="grouped"><h2 className="nw-small-heading">Prioridades do dia</h2>
        <p className="nw-muted">{todayTasks.length} {todayTasks.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'} para hoje</p>
        {priorities.length ? <ul>{priorities.slice(0, expanded ? undefined : 4).map((task) => <li key={task.id}>
          <label className="today-check"><input type="checkbox" aria-label={'Concluir ' + task.title} checked={false} onChange={() => app.completeEntry(task.id)} /></label>
          <button type="button" onClick={() => openTask(task.id)}>{task.title}<small>{intentionPrompt(task, data, now) ?? entryDueLabel(task, now)}</small></button>
        </li>)}</ul> : <p className="nw-muted">Nenhuma outra prioridade disponível.</p>}
        {priorities.length > 4 && <Button size="sm" variant="ghost" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Mostrar menos' : 'Mostrar todas'}</Button>}
      </Card>
    </div>
    <div className="today-overview">
      <Card className="today-panel" variant="outlined"><h2 className="nw-small-heading">Prazos próximos</h2>
        {overdue > 0 && <p className="today-overdue">{overdue} {overdue === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}</p>}
        {deadlines.length ? <ul className="today-records">{deadlines.slice(0, 4).map((entry) => <li key={entry.id}>
          <a href={entryHref(entry.id)}><strong>{entry.title}</strong><small>{entryDueLabel(entry, now)}</small></a></li>)}</ul>
          : <p className="nw-muted">Nenhum prazo de tarefa nos próximos sete dias.</p>}
        <a className="today-panel-link" href={tasksPage}>Abrir tarefas <ArrowRight size={14} aria-hidden="true" /></a>
      </Card>
      <Card className="today-panel" variant="outlined"><h2 className="nw-small-heading">Compromissos próximos</h2>
        {upcoming.length ? <ul className="today-records">{upcoming.slice(0, 4).map((entry) => <li key={entry.id}>
          <a href={entryHref(entry.id)}><strong>{entry.title}</strong><small>{entryDueLabel(entry, now)}</small></a></li>)}</ul>
          : <p className="nw-muted">Nenhum compromisso nos próximos sete dias.</p>}
        <a className="today-panel-link" href={agenda}>Abrir agenda <ArrowRight size={14} aria-hidden="true" /></a>
      </Card>
      <Card className="today-panel" variant="outlined"><h2 className="nw-small-heading">Revisões programadas</h2>
        {due.length ? <><p>{due.length} {due.length === 1 ? 'cartão disponível' : 'cartões disponíveis'} para revisar hoje.</p>
          <ul className="today-records">{data.subjects.filter(({ id }) => reviewsBySubject.has(id)).map(({ id, title }) => {
            const count = reviewsBySubject.get(id)!;
            return <li key={id}><a href={routeHref({ area: 'materias', subjectId: id, view: 'revisao' })}>
              <strong>{title}</strong><small>{count} {count === 1 ? 'cartão' : 'cartões'}</small></a></li>;
          })}</ul></> : <p className="nw-muted">Nenhuma revisão prevista para hoje.</p>}
      </Card>
      <Card className="today-panel" variant="outlined"><h2 className="nw-small-heading">Capacidade diária</h2>
        <CapacitySummary capacity={capacity} />
        <a className="today-panel-link" href={agenda}>Ajustar na agenda <ArrowRight size={14} aria-hidden="true" /></a>
      </Card>
      <Card className="today-panel" variant="outlined"><h2 className="nw-small-heading">Atividade nos últimos 7 dias</h2>
        <ul className="today-chart" aria-label="Tarefas concluídas por dia">{week.map((day) => <li key={day.key}>
          <strong>{day.completed}</strong><span className="today-bar" aria-hidden="true"><i style={{ height: (day.completed / maxCompleted) * 100 + '%' }} /></span>
          <time dateTime={asLocalDate(day.key)}>{day.label}</time>
        </li>)}</ul>
        <div className="today-activity-totals">
          <span><CheckCircle2 size={16} aria-hidden="true" />{progress.completed} {progress.completed === 1 ? 'tarefa concluída' : 'tarefas concluídas'} hoje</span>
          <span><Clock3 size={16} aria-hidden="true" />{confirmedMinutes} min de estudo confirmado hoje</span>
        </div>
        <a className="today-panel-link" href={progressPage}>Ver progresso <ArrowRight size={14} aria-hidden="true" /></a>
      </Card>
      <Card className="today-panel" variant="outlined"><h2 className="nw-small-heading">Continue de onde parou</h2>
        {latestNote ? <ul className="today-records"><li><a href={routeHref({ area: 'materias', subjectId: latestNote.subjectId, view: 'caderno', noteId: latestNote.id })}>
          <strong><BookOpen size={16} aria-hidden="true" />{latestNote.title}</strong>
          <small>{data.subjects.find(({ id }) => id === latestNote.subjectId)?.title}</small>
        </a></li></ul> : <p className="nw-muted">Suas anotações recentes aparecem aqui.</p>}
        <a className="today-panel-link" href={inbox}>Caixa de entrada · {pendingInbox.length} a processar <ArrowRight size={14} aria-hidden="true" /></a>
      </Card>
    </div>
    {shortcuts.length > 0 && <section className="today-subjects">
      <div className="today-section-heading"><h2 className="nw-small-heading">Atalhos de matérias</h2><a className="today-panel-link" href={routeHref(areas.materias)}>Ver todas <ArrowRight size={14} aria-hidden="true" /></a></div>
      <div className="subject-grid today-shortcuts">{shortcuts.map((item) => <Card key={item.id} className="today-subject" variant="outlined">
        <div className="today-subject-heading"><SubjectMark subject={item} /><strong>{item.title}</strong></div>
        <div className="today-subject-actions">{subjectViews.map(({ id, label }) => <Button key={id} size="sm" variant="ghost"
          onClick={() => subject(item.id, id)}>{label}</Button>)}</div></Card>)}</div>
    </section>}
    <Surface className="today-close" variant="outlined">
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
  </div>;
}
