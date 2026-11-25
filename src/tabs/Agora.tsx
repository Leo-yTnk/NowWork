import { useEffect, useState } from 'react';
import { Coffee, Play, Timer } from 'lucide-react';
import { recommendations, intentionPrompt } from '../lib/decision';
import { adaptiveEstimate, focusSeconds } from '../lib/learning';
import { executableTasks } from '../lib/planning';
import { useApp } from '../state/AppState';
import { Button, EmptyState, Surface } from '../components/ui';
import type { Continuity, Energy } from '../types';

const continuityFields = { stoppedAt: 'Onde parei', next: 'Próxima ação', context: 'Informações para retomar', difficulty: 'Dificuldades' };
const blank = { stoppedAt: '', next: '', context: '', difficulty: '' };
const displayTimer = (seconds: number) => [Math.floor(seconds / 60), seconds % 60].map((value) => String(value).padStart(2, '0')).join(':');

export function Agora({ capture, onBreak, exit }: { capture: () => void; onBreak: () => void; exit: () => void }) {
  const app = useApp();
  const { data } = app;
  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState('');
  const [goal, setGoal] = useState('');
  const [target, setTarget] = useState('');
  const [end, setEnd] = useState(false);
  const [handoff, setHandoff] = useState<Continuity>(blank);
  const [effective, setEffective] = useState('');
  const [pauseDismissed, setPauseDismissed] = useState(false);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    refresh();
    const timer = window.setInterval(refresh, data.focus || data.break ? 1000 : 30000);
    return () => clearInterval(timer);
  }, [data.focus?.entryId, data.break?.startedAt]);
  const tasks = data.focus || data.break ? [] : executableTasks(data.entries);
  const suggested = tasks.length && data.cognitive.recommendations ? recommendations(data, now, undefined, false).find((item) => item.type === 'task')?.entry : undefined;
  const current = data.focus ? data.entries.find((task) => task.id === data.focus?.entryId) :
    tasks.find((entry) => entry.id === selected) ?? suggested;
  const prior = current?.continuity;
  const seconds = data.focus ? focusSeconds(data.focus, now) : 0;
  const pause = data.cognitive.pauseReminder > 0 && seconds >= data.cognitive.pauseReminder * 60 && !pauseDismissed;
  const finish = (complete: boolean) => {
    const verified = effective !== '' && Number(effective) > 0;
    app.finishFocus(handoff, verified, verified ? Number(effective) : undefined);
    if (complete && current) app.completeEntry(current.id);
    setEnd(false);
  };
  if (data.focus) return <div className="nw-stack">
    <Surface className="priority-card nw-stack">
      <div className="cognitive-line"><h2>{current?.title ?? 'Sessão de foco'}</h2><Button size="sm" onClick={exit}>Sair da tela de foco</Button></div>
      {data.focus.goal && <p>{data.focus.goal}</p>}
      <p className="cognitive-timer"><Timer size={21} aria-hidden="true" /> <span role="timer" aria-label="Tempo ativo">{displayTimer(seconds)}</span>
        <small>{data.focus.paused ? 'Em pausa' : data.focus.targetMinutes ? 'Meta de ' + data.focus.targetMinutes + ' min' : 'Duração livre'}</small></p>
      {!end && <>
        {prior && Object.values(prior).some(Boolean) && <details className="cognitive-details" open><summary>Para retomar</summary>
          <dl className="cognitive-metrics">{Object.entries(continuityFields).map(([key, label]) => prior[key as keyof Continuity] && <div key={key}>
            <dt>{label}</dt><dd>{prior[key as keyof Continuity]}</dd></div>)}</dl>
        </details>}
        {current?.steps.map((step) => <label className="step-check" key={step.id}>
          <input type="checkbox" checked={step.done} onChange={() => app.toggleStep(current.id, step.id)} />{step.title}</label>)}
        {pause && !data.focus.paused && <div className="cognitive-line"><p>Se quiser, faça uma pausa breve.</p>
          <Button size="sm" onClick={() => setPauseDismissed(true)}>Dispensar sugestão</Button></div>}
        <div className="nw-toolbar">
          <Button variant="primary" onClick={app.toggleFocusPause}>{data.focus.paused ? 'Retomar' : 'Pausar'}</Button>
          <Button onClick={capture}>Capturar</Button>
          {data.cognitive.trackFocus && <Button onClick={app.recordInterruption}>Marcar interrupção{data.focus.interruptions ? ' (' + data.focus.interruptions + ')' : ''}</Button>}
          <Button onClick={() => {
            if (!data.focus?.paused) app.toggleFocusPause();
            setHandoff(prior ?? blank);
            setEffective('');
            setEnd(true);
          }}>Encerrar sessão</Button>
        </div>
      </>}
      {end && <form className="nw-stack" onSubmit={(event) => { event.preventDefault(); finish(false); }}>
        <h3>Contexto para a próxima sessão</h3>
        <div className="cognitive-form-grid">{Object.entries(continuityFields).map(([key, label]) => <label key={key} className="field-label">
          {label}<textarea className="ds-input" rows={2} maxLength={2000} value={handoff[key as keyof Continuity]}
            onChange={(event) => {
              const next = { ...handoff, [key]: event.target.value };
              setHandoff(next);
              if (current) app.saveContinuity(current.id, next);
            }} /></label>)}</div>
        {data.cognitive.trackFocus && <label className="field-label">Minutos efetivos nesta tarefa (opcional)
          <input className="ds-input" type="number" min={0} max={Math.floor(seconds / 60 * 10) / 10} step={0.1} value={effective} onChange={(event) => setEffective(event.target.value)} />
          <small>Desconte interrupções e atividades alheias. O cronômetro já desconta as pausas registradas.</small>
        </label>}
        <div className="nw-toolbar"><Button variant="primary" type="submit">Salvar e encerrar</Button>
          {current && <Button type="submit" onClick={(event) => {
            if (event.currentTarget.form?.reportValidity()) { event.preventDefault(); finish(true); }
          }}>Salvar e concluir tarefa</Button>}
          <Button onClick={() => setEnd(false)}>Voltar à sessão</Button>
        </div>
      </form>}
    </Surface>
  </div>;
  if (data.break) return <Surface className="rest-card nw-stack"><h2>Pausa em andamento</h2><p className="cognitive-timer">
    {displayTimer(Math.max(0, Math.ceil((Date.parse(data.break.startedAt) + data.break.minutes * 60000 - +now) / 1000)))}</p>
    <Button onClick={app.finishBreak}>Encerrar pausa</Button></Surface>;
  const estimate = current && adaptiveEstimate(data, current);
  const prompt = current && intentionPrompt(current, data, now);
  return <div className="nw-stack">
    <Surface className="nw-padding nw-stack">
      {tasks.length ? <>
        <label className="field-label">Atividade<select className="ds-input" value={current?.id ?? ''} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Escolha uma tarefa</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
        </select></label>
        {prompt && <p>{prompt}</p>}
        {prior?.next && <p className="nw-muted">Próxima ação registrada: {prior.next}</p>}
        <label className="field-label">Objetivo da sessão (opcional)<input className="ds-input" value={goal} onChange={(event) => setGoal(event.target.value)} /></label>
        <label className="field-label">Duração-alvo em minutos (opcional)<input className="ds-input" type="number" min={1} max={600} value={target}
          onChange={(event) => setTarget(event.target.value)} /><small>{estimate ? 'Mediana em ' + estimate.samples + ' tarefas semelhantes: ' + estimate.minutes + ' min.' : 'Deixe em branco para duração livre.'}</small></label>
        <Button variant="primary" disabled={!current} icon={<Play size={16} />} onClick={() => {
          if (!current) return;
          app.startFocus(current.id, goal, target ? Math.max(1, Math.min(600, Number(target))) : undefined);
          setPauseDismissed(false);
        }}>Iniciar sessão</Button>
      </> : <EmptyState title="Nenhuma tarefa disponível para foco" description="Crie uma tarefa ou conclua os pré-requisitos de uma atividade existente." />}
    </Surface>
    <div className="nw-toolbar"><Button icon={<Coffee size={16} />} onClick={onBreak}>Fazer uma pausa</Button></div>
    <label className="field-label">Disposição agora (opcional)<select className="ds-input" value={data.cognitive.energy ?? ''}
      onChange={(event) => app.updateCognitive({ energy: event.target.value ? Number(event.target.value) as Energy : undefined })}>
      <option value="">Prefiro não informar</option><option value={1}>Baixa</option><option value={2}>Regular</option><option value={3}>Alta</option>
    </select></label>
  </div>;
}
