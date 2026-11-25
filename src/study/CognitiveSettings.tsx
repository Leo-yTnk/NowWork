import { useApp } from '../state/AppState';
import { PRIORITY_FACTORS } from '../types';
import { Button, SettingsGroup, Switch } from '../components/ui';

const factors = { urgency: 'Urgência', importance: 'Importância', fit: 'Tempo disponível', dependency: 'Pré-requisitos',
  energy: 'Disposição', preference: 'Matéria preferida', review: 'Revisão' };

export function CognitiveSettingsPanel() {
  const app = useApp();
  const { cognitive, subjects } = app.data;
  const number = (value: string, max: number) => Math.max(0, Math.min(max, Number(value)));
  return <SettingsGroup title="Captura e estudo">
    <label className="field-label">Atalho de captura<select className="ds-input" value={cognitive.shortcut}
      onChange={(event) => app.updateCognitive({ shortcut: event.target.value })}>
      <option value="Space">Ctrl / ⌘ + Shift + Espaço</option>
      {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').filter((key) => key !== 'K').map((key) =>
        <option key={key} value={key}>{'Ctrl / ⌘ + Shift + ' + key}</option>)}
    </select></label>
    <Switch label="Mostrar recomendações" checked={cognitive.recommendations}
      onChange={(recommendations) => app.updateCognitive({ recommendations })} />
    <details className="cognitive-details"><summary>Preferências de recomendação</summary>
      <p className="nw-muted">Os pesos são parâmetros ajustáveis do aplicativo.</p>
      <div className="cognitive-form-grid">
        {PRIORITY_FACTORS.map((factor) => <label key={factor} className="field-label">{factors[factor]}
          <input className="ds-input" type="number" min={0} max={100} value={cognitive.weights[factor]} onChange={(event) =>
            app.updateCognitive({ weights: { ...cognitive.weights, [factor]: number(event.target.value, 100) } })} /></label>)}
        <label className="field-label">Matéria preferida<select className="ds-input" value={cognitive.preferredSubject ?? ''}
          onChange={(event) => app.updateCognitive({ preferredSubject: event.target.value || undefined })}>
          <option value="">Sem preferência</option>{subjects.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}</select></label>
        <label className="field-label">Tempo disponível agora (min)<input className="ds-input" type="number" min={0} max={600} value={cognitive.availableMinutes ?? ''}
          placeholder="Usar a agenda" onChange={(event) => app.updateCognitive({ availableMinutes: event.target.value === '' ? undefined : number(event.target.value, 600) })} /></label>
        <label className="field-label">Sugestão de pausa após (min)<input className="ds-input" type="number" min={0} max={180} value={cognitive.pauseReminder}
          onChange={(event) => app.updateCognitive({ pauseReminder: number(event.target.value, 180) })} /><small>Use 0 para desativar.</small></label>
        <label className="field-label">Orçamento diário de revisão (min)<input className="ds-input" type="number" min={0} max={600} value={cognitive.reviewMinutes}
          onChange={(event) => app.updateCognitive({ reviewMinutes: number(event.target.value, 600) })} /></label>
      </div>
    </details>
    <Switch label="Registrar estudo efetivo" description="Permite confirmar o tempo de cada sessão e usar o histórico para sugerir estimativas."
      checked={cognitive.trackFocus} onChange={(trackFocus) => app.updateCognitive({ trackFocus })} />
    <div className="nw-toolbar">
      <Button size="sm" onClick={() => { if (window.confirm('Apagar os tempos de foco registrados?')) app.clearFocusMetrics(); }}>Apagar tempos de foco</Button>
      <Button size="sm" onClick={() => { if (window.confirm('Apagar as avaliações anteriores e manter as datas de revisão?')) app.clearReviewMetrics(); }}>Apagar avaliações de revisão</Button>
    </div>
  </SettingsGroup>;
}
