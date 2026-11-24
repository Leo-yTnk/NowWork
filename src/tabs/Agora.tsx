import { useEffect, useState } from 'react';
import { ArrowRight, Check, Clock3, Coffee, Flame, Lightbulb, Moon, Play, RotateCcw, Sparkles, Zap } from 'lucide-react';
import { assistantMessage, dueDays, dueLabel, entryDueLabel, nextCommitment, pointsFor, rankedTasks, reasonFor } from '../lib/engine';
import { useApp } from '../state/AppState';
import { Button, EmptyState, Eyebrow, KindPill, SectionHeader, Stat, Surface } from '../components/ui';
import type { Energy } from '../types';

function countdown(seconds: number): string {
  const min = Math.floor(Math.max(0, seconds) / 60);
  const sec = Math.max(0, seconds) % 60;
  return String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

export function Agora({ onMind, onBreak }: { onMind: () => void; onBreak: () => void }) {
  const app = useApp();
  const { data } = app;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), data.focus || data.break ? 1000 : 30000);
    return () => clearInterval(interval);
  }, [data.focus, data.break]);
  const tasks = rankedTasks(data, now);
  const chosen = tasks.find((task) => task.id === data.focus?.entryId) || tasks[0];
  const active = data.entries.filter((e) => e.status === 'active');
  const soon = active.filter((e) => e.dueAt && (dueDays(e, now) ?? Infinity) <= 2);
  const nextEvent = nextCommitment(data.entries, now);
  const focus = data.focus;
  const focusSeconds = focus ? Math.max(0, Math.floor((now.getTime() - Date.parse(focus.startedAt)) / 1000)) : 0;
  const restSeconds = data.break ? Math.max(0, Math.ceil((Date.parse(data.break.startedAt) + data.break.minutes * 60000 - now.getTime()) / 1000)) : 0;
  const energyOptions: {value: Energy; label: string; icon: typeof Moon}[] = [
    { value: 1, label: 'Baixa', icon: Moon },
    { value: 2, label: 'Regular', icon: Coffee },
    { value: 3, label: 'Alta', icon: Zap },
  ];
  return <div className="screen now-screen">
    <Surface className="assistant-card">
      <div className="assistant-avatar"><Sparkles size={18}/></div>
      <div className="assistant-copy"><div className="assistant-name">NowWork <span>· sugestão de foco</span></div>
        <p>{assistantMessage(data, now)}</p>
      </div>
    </Surface>

    <div className="energy-row"><div><span className="micro-label">Sua disposição agora</span><p>Você escolhe o ritmo.</p></div>
      <div className="energy-segment" aria-label="Disposição declarada">
        {energyOptions.map(({value, label, icon: Icon}) => <button key={value} type="button"
          aria-pressed={data.profile.energy === value}
          className={'energy-option ' + (data.profile.energy === value ? 'selected' : '')}
          onClick={() => app.updateProfile({energy:value})}><Icon size={15}/><span>{label}</span></button>)}
      </div>
    </div>

    <SectionHeader label="Seu próximo passo" trailing={<span className="section-note">Só um de cada vez</span>}/>
    {chosen ? <Surface className="priority-card">
      <div className="priority-top"><KindPill tone="teal">{focus ? 'Em foco' : 'Sugerido para agora'}</KindPill>
        <span className="priority-points"><Flame size={14}/> +{pointsFor(chosen)} pts</span></div>
      <h2>{chosen.title}</h2>
      <div className="priority-meta"><span><Clock3 size={16}/> {chosen.minutes} minutos estimados</span>
        {chosen.dueAt && <span className={(dueDays(chosen, now) ?? 0) < 0 ? 'is-overdue' : ''}>{dueLabel(chosen.dueAt)}</span>}
        {chosen.source === 'demo' && <span className="demo-pill">Exemplo</span>}
      </div>
      <div className="recommendation"><Lightbulb size={17}/><span>{reasonFor(chosen, data.profile.energy, now)}</span></div>
      {focus?.entryId === chosen.id && <div className="focus-meter"><div><span>Foco em andamento</span><strong>{countdown(focusSeconds)}</strong></div>
        <Button size="sm" onClick={app.finishFocus}>Encerrar foco</Button></div>}
      {chosen.steps.length > 0 && <div className="priority-steps"><span className="micro-label">Avançar aos poucos</span>
        {chosen.steps.map((step) => <label key={step.id} className="step-check">
          <input type="checkbox" checked={step.done} onChange={() => app.toggleStep(chosen.id, step.id)} />
          <span>{step.title}</span>
        </label>)}</div>}
      <div className="priority-actions">
        {focus?.entryId !== chosen.id && <Button variant="primary" size="lg" icon={<Play size={17} fill="currentColor"/>}
          onClick={() => app.startFocus(chosen.id)} disabled={!!data.break}>Começar</Button>}
        <Button size="lg" icon={<Check size={17}/>} onClick={() => app.completeEntry(chosen.id)}>Concluir</Button>
      </div>
      <div className="priority-secondary">
        <Button variant="ghost" size="sm" icon={<RotateCcw size={15}/>} onClick={() => app.postponeEntry(chosen.id)}>Adiar um dia</Button>
        <Button variant="ghost" size="sm" icon={<ArrowRight size={15}/>} onClick={() => {app.divideEntry(chosen.id);}}>Dividir em passos</Button>
      </div>
    </Surface> : <Surface><EmptyState icon={<Sparkles size={24}/>} title="Nada exige sua atenção agora."
      description={active.length ? 'Não há tarefas executáveis em aberto. Compromissos, ideias e preocupações continuam guardados na Caixa de entrada.' : 'Seu espaço está livre. Registre uma atividade quando precisar — ou simplesmente aproveite a pausa.'}
      action={<Button variant="primary" icon={<ArrowRight size={16}/>} onClick={onMind}>Abrir caixa de entrada</Button>}/></Surface>}
    {focus && focus.entryId !== chosen?.id && <div className="inline-alert">Uma sessão de foco está em andamento. <Button variant="ghost" size="sm" onClick={app.finishFocus}>Encerrar foco ({countdown(focusSeconds)})</Button></div>}

    <div className="two-panels">
      <Surface className="rest-card">
        <div className="rest-icon"><Coffee size={19}/></div>
        <h3>Descansar também conta.</h3>
        {data.break ? <><p>Você está em pausa. Volte quando quiser.</p>
          <div className="rest-timer">{countdown(restSeconds)}</div>
          <Button size="sm" onClick={app.finishBreak}>Encerrar pausa</Button></>
          : <><p>Você não precisa merecer uma pausa.</p>
          <Button size="sm" icon={<ArrowRight size={15}/>} onClick={onBreak}>Fazer uma pausa</Button></>}
      </Surface>
      <Surface className="overview-card">
        <Eyebrow>VISÃO LEVE</Eyebrow>
        <div className="stats-row"><Stat value={active.length} label="registros abertos"/><Stat value={soon.length} label="prazos até 2 dias"/></div>
        {nextEvent && <p className="event-reminder"><Clock3 size={14}/> Próximo compromisso: {nextEvent.title} · {entryDueLabel(nextEvent, now)}</p>}
        <Button variant="ghost" size="sm" icon={<ArrowRight size={15}/>} onClick={onMind}>Ver caixa de entrada</Button>
      </Surface>
    </div>
  </div>;
}
