import { useState } from 'react';
import { Button } from '../components/ui';
import { pointsBalance } from '../lib/engine';
import { useApp } from '../state/AppState';

export function LegacyRewards() {
  const app = useApp();
  const [name, setName] = useState('');
  const [cost, setCost] = useState(30);
  if (!app.data.rewards.length && !app.data.activity.some((item) => item.kind === 'redeem')) return null;
  const balance = pointsBalance(app.data.activity);
  return <details className="settings-group cognitive-details">
    <summary>Recompensas de versões anteriores</summary>
    <p className="nw-muted">Saldo histórico: {balance} pontos.</p>
    <ul className="cognitive-list">{app.data.rewards.map((reward) => <li className="cognitive-line" key={reward.id}>
      <span>{reward.title} · {reward.cost} pontos</span><div className="nw-toolbar">
        <Button size="sm" disabled={balance < reward.cost} onClick={() => app.redeemReward(reward.id)}>Resgatar</Button>
        <Button size="sm" onClick={() => { if (window.confirm('Excluir esta recompensa?')) app.deleteReward(reward.id); }}>Excluir</Button>
      </div></li>)}</ul>
    <form className="nw-stack" onSubmit={(event) => {
      event.preventDefault();
      if (!name.trim()) return;
      app.addReward(name, cost);
      setName('');
    }}>
      <div className="cognitive-form-grid">
        <label className="field-label">Recompensa<input className="ds-input" value={name} required maxLength={120} onChange={(event) => setName(event.target.value)} /></label>
        <label className="field-label">Custo em pontos<input className="ds-input" required type="number" min={1} max={100000} value={cost} onChange={(event) => setCost(Number(event.target.value))} /></label>
      </div>
      <Button size="sm" type="submit">Adicionar recompensa</Button>
    </form>
  </details>;
}
