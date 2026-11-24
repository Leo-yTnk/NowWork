import { useState, type FormEvent } from 'react';
import { Award, Check, Clock3, Coffee, Gift, Heart, Plus, Sparkles, Trash2, TrendingUp } from 'lucide-react';
import { pointsBalance, weekActivity } from '../lib/engine';
import { useApp } from '../state/AppState';
import { Button, EmptyState, SectionHeader, Stat, Surface } from '../components/ui';

const units = (count: number) => count === 1 ? 'ponto' : 'pontos';

export function Evolucao() {
  const app = useApp();
  const { data } = app;
  const [rewardName, setRewardName] = useState('');
  const [rewardCost, setRewardCost] = useState(30);
  const points = pointsBalance(data.activity);
  const series = weekActivity(data);
  const weekCompletions = series.reduce((sum, d) => sum + d.completed, 0);
  const weekSteps = series.reduce((sum, d) => sum + d.steps, 0);
  const weekRest = series.reduce((sum, d) => sum + d.breaks, 0);
  const weekFocus = series.reduce((sum, d) => sum + d.focusMinutes, 0);
  const max = Math.max(1, ...series.map((d) => d.completed + d.steps));
  const recent = data.activity.slice(0, 7);
  const createReward = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rewardName.trim() || rewardCost < 1) return;
    app.addReward(rewardName, rewardCost);
    setRewardName('');
    setRewardCost(30);
  };
  return <div className="screen evolution-screen">


    <Surface className="evolution-hero">
      <div><div className="points-label"><Sparkles size={16}/> PONTOS DE EVOLUÇÃO</div>
        <div className="points-number">{points}<span> pts</span></div>
        <p>Seus pontos são conquistados, nunca retirados por descansar ou adiar algo.</p>
      </div>
      <div className="points-medallion"><Award size={42} strokeWidth={1.45}/></div>
    </Surface>

    <SectionHeader label="Últimos 7 dias" trailing={<span className="section-note">Sem metas obrigatórias</span>}/>
    <Surface className="weekly-card">
      <div className="week-stats"><Stat value={weekCompletions} label="tarefas concluídas" symbol={<Check size={15}/>} />
        <Stat value={weekSteps} label="pequenos avanços" symbol={<TrendingUp size={15}/>} /></div>
      <div className="week-chart" role="img" aria-label="Tarefas concluídas e pequenos avanços em cada um dos últimos sete dias">
        {series.map((day) => {
          const n = day.completed + day.steps;
          return <div className="day-col" key={day.key} title={day.label + ': ' + n + ' avanços'}>
            <div className="bar-track"><div className={'bar-fill ' + (!n ? 'bar-empty' : '')} style={{height:n ? (n/max*100)+'%' : '5%'}} /></div>
            <span>{day.label}</span></div>;
        })}
      </div>
      <p className="chart-caption">Concluir e avançar contam. Não existe sequência obrigatória.</p>
    </Surface>

    <Surface className="balance-card"><div className="balance-heading"><Heart size={19}/><div><h3>Equilíbrio também é evolução</h3><p>Sem notas para o seu descanso.</p></div></div>
      <div className="balance-stats"><Stat value={weekFocus + ' min'} label="concentração registrada" symbol={<Clock3 size={15}/>} />
        <Stat value={weekRest} label="pausas registradas" symbol={<Coffee size={15}/>} /></div>
      <p>Descansar não custa pontos e nunca depende de produtividade prévia.</p>
    </Surface>

    <SectionHeader label="Suas recompensas" trailing={<span className="section-note">Escolha o que faz sentido para você</span>}/>
    <Surface className="rewards-card">
      <form className="reward-form" onSubmit={createReward}>
        <label className="field-label">Uma recompensa para você
          <input required maxLength={120} placeholder="Ex.: uma noite de cinema" value={rewardName} onChange={(e) => setRewardName(e.target.value)}/>
        </label>
        <label className="field-label reward-cost">Custo em pontos
          <input type="number" required min={1} max={100000} value={rewardCost} onChange={(e) => setRewardCost(Number(e.target.value))}/>
        </label>
        <Button type="submit" variant="primary" icon={<Plus size={16}/>}>Criar</Button>
      </form>
      {data.rewards.length > 0 ? <div className="reward-list">
        {data.rewards.map((reward) => <div className="reward-row" key={reward.id}>
          <div className="reward-icon"><Gift size={18}/></div>
          <div className="reward-copy"><strong>{reward.title}</strong><span>{reward.cost} {units(reward.cost)}</span></div>
          <Button size="sm" variant={points >= reward.cost ? 'primary' : 'secondary'} disabled={points < reward.cost}
            onClick={() => app.redeemReward(reward.id)}>Resgatar</Button>
          <button type="button" className="bare-icon" title="Excluir recompensa" aria-label={'Excluir ' + reward.title} onClick={() => app.deleteReward(reward.id)}><Trash2 size={16}/></button>
        </div>)}
      </div> : <div className="small-empty"><Gift size={18}/> Suas recompensas personalizadas aparecem aqui.</div>}
    </Surface>

    <SectionHeader label="Conquistas recentes" />
    <Surface className="history-card">
      {recent.length ? <div className="history-list">{recent.map((event) => <div className="history-row" key={event.id}>
        <div className={'history-icon ' + (event.kind === 'rest' ? 'history-rest' : '')}>{event.kind === 'rest' ? <Coffee size={16}/> :
          event.kind === 'redeem' ? <Gift size={16}/> : event.kind === 'focus' ? <Clock3 size={16}/> : <Check size={16}/>}</div>
        <div><strong>{event.label}</strong><span>{new Intl.DateTimeFormat('pt-BR', {day:'2-digit',month:'short'}).format(new Date(event.at))}</span></div>
        <span className={'history-points ' + (event.points < 0 ? 'redeemed' : '')}>
          {event.points > 0 ? '+' + event.points + ' pts' : event.points < 0 ? event.points + ' pts' : event.minutes ? event.minutes + ' min' : '✓'}
        </span>
      </div>)}</div> : <EmptyState icon={<Award size={24}/>} title="Cada pequena vitória tem lugar aqui."
        description="Conclua tarefas ou avance em etapas para construir seu histórico, sem pressão."/>}
    </Surface>
  </div>;
}
