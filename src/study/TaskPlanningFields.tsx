import { useApp } from '../state/AppState';
import { adaptiveEstimate } from '../lib/learning';
import { cyclicDependency } from '../lib/planning';
import { Button } from '../components/ui';
import type { Entry, EntryInput, Intention } from '../types';

export function TaskPlanningFields({ value, change, entryId }: { value: EntryInput; change: (next: EntryInput) => void; entryId?: string }) {
  const { data } = useApp();
  const dependencies = data.entries.filter((item) => item.kind === 'task' && item.id !== entryId &&
    (value.dependencies?.includes(item.id) || (item.status !== 'archived' && (!entryId || !cyclicDependency(data.entries, entryId, item.id)))));
  const estimate = adaptiveEstimate(data, { ...value, id: entryId ?? '' } as Entry);
  const intention = value.intention;
  return <details className="cognitive-details">
    <summary>Planejamento, pré-requisitos e plano SE–ENTÃO</summary>
    <div className="cognitive-form-grid">
      <label className="field-label">Dia planejado<input className="ds-input" type="date" value={value.plannedOn ?? ''}
        onChange={(event) => change({ ...value, plannedOn: event.target.value || undefined })} /></label>
      <label className="field-label">Tipo de atividade (opcional)<input className="ds-input" maxLength={100} value={value.activityType ?? ''}
        placeholder="Ex.: lista de exercícios" onChange={(event) => change({ ...value, activityType: event.target.value || undefined })} /></label>
    </div>
    <label className="step-check"><input type="checkbox" checked={!!value.optional}
      onChange={(event) => change({ ...value, optional: event.target.checked })} /> Atividade opcional</label>
    {estimate && <div className="nw-stack">
      <p className="nw-muted">Mediana de {estimate.samples} tarefas semelhantes: {estimate.minutes} min. Tempos observados: {estimate.range.join('–')} min.</p>
      <Button size="sm" onClick={() => change({ ...value, minutes: Math.max(5, Math.min(600, estimate.minutes)) })}>Usar estimativa sugerida</Button>
    </div>}
    <details className="cognitive-details"><summary>Pré-requisitos{value.dependencies?.length ? ' (' + value.dependencies.length + ')' : ''}</summary>
      {dependencies.length ? dependencies.map((task) => <label className="step-check" key={task.id}>
        <input type="checkbox" checked={value.dependencies?.includes(task.id) ?? false} onChange={(event) => change({ ...value,
          dependencies: event.target.checked ? [...(value.dependencies ?? []), task.id] : value.dependencies?.filter((id) => id !== task.id),
        })} />{task.title}</label>) : <p className="nw-muted">Crie outra tarefa para vinculá-la como pré-requisito.</p>}
      {value.dependencies?.filter((id) => !dependencies.some((entry) => entry.id === id)).map((id) =>
        <Button size="sm" key={id} onClick={() => change({ ...value, dependencies: value.dependencies?.filter((key) => key !== id) })}>Remover pré-requisito indisponível</Button>)}
    </details>
    <label className="field-label">Plano SE–ENTÃO<select className="ds-input" value={intention?.type ?? ''}
      onChange={(event) => {
        const type = event.target.value as Intention['type'] | '';
        change({ ...value, intention: type ? { type, value: '', action: intention?.action ?? '' } : undefined });
      }}>
      <option value="">Sem plano condicional</option><option value="time">Horário local</option><option value="event">Após compromisso agendado</option>
      <option value="routine">Rotina pessoal</option><option value="completion">Ao concluir outra tarefa</option>
    </select></label>
    {intention && <div className="cognitive-form-grid">
      <label className="field-label">Se…
        {intention.type === 'event' || intention.type === 'completion' ? <select className="ds-input" required value={intention.value}
          onChange={(event) => change({ ...value, intention: { ...intention, value: event.target.value } })}>
          <option value="">Selecione um registro</option>{data.entries.filter((item) => item.id !== entryId &&
            (intention.type === 'event' ? item.kind === 'event' && item.eventTime : item.kind === 'task'))
            .map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select> : <input className="ds-input" type={intention.type === 'time' ? 'time' : 'text'} required maxLength={160} value={intention.value}
          onChange={(event) => change({ ...value, intention: { ...intention, value: event.target.value } })} />}
      </label>
      <label className="field-label">Então eu vou…<input className="ds-input" required maxLength={300} value={intention.action}
        onChange={(event) => change({ ...value, intention: { ...intention, action: event.target.value } })} /></label>
    </div>}
    {intention && <p className="nw-muted">Os planos aparecem no NowWork. Use rotinas como lembretes que você mesmo reconhece.</p>}
  </details>;
}
