import { TaskPlanningFields } from '../study/TaskPlanningFields';
import type { EntryInput } from '../types';
import { asLocalDate, dateToDeadline, localTime } from '../lib/engine';
import { useApp } from '../state/AppState';
import { KINDS } from '../types';
import { Select } from './Select';

const entryKinds = Object.entries(KINDS).filter(([kind]) => kind !== 'capture') as [EntryInput['kind'], string][];
const durations = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180];

export const freshInput = (): EntryInput => ({
  title: '', note: '', kind: 'task', importance: 2, effort: 2, minutes: 25, dueAt: null,
});

export function EntryFields({ value, onChange, showKind = true, entryId }: {
  value: EntryInput;
  onChange: (next: EntryInput) => void;
  showKind?: boolean;
  entryId?: string;
}) {
  const { subjects } = useApp().data;
  const availableDurations = durations.includes(value.minutes) ? durations : [...durations, value.minutes].sort((a, b) => a - b);
  const change = <K extends keyof EntryInput>(field: K, next: EntryInput[K]) => onChange({ ...value, [field]: next });
  return <div className="fields">
    <label className="field-label">Título
      <input required maxLength={200} value={value.title} onChange={(e) => change('title', e.target.value)} placeholder="O que está na sua cabeça?" />
    </label>
    {showKind && <div className="field-label">Tipo
      <Select label="Tipo" value={value.kind} options={entryKinds} onChange={(kind) => onChange({ ...value, kind, eventTime: undefined,
        dueAt: value.eventTime ? dateToDeadline(asLocalDate(value.dueAt)) : value.dueAt })} />
    </div>}
    <label className="field-label">Anotações <span className="subtle">(opcional)</span>
      <textarea rows={2} maxLength={3000} value={value.note} onChange={(e) => change('note', e.target.value)} placeholder="Algum detalhe que ajude depois..." />
    </label>
    <div className="field-grid">
      <div className="field-label">Matéria
        <Select label="Matéria" value={value.subjectId || ''} onChange={(id) => change('subjectId', id || undefined)}
          options={[[ '', 'Sem matéria'], ...subjects.map(({ id, title }) => [id, title] as const)]} />
      </div>
      <label className="field-label"><span>{value.kind === 'event' ? 'Data' : 'Prazo'} <span className="subtle">(opcional)</span></span>
        <input type="date" value={asLocalDate(value.dueAt)} onChange={(event) => {
          const date = event.target.value;
          const time = value.eventTime ? localTime(value.dueAt) : '';
          onChange({ ...value, dueAt: dateToDeadline(date, time), eventTime: !!(date && time) || undefined });
        }} />
      </label>
      {value.kind === 'event' && <label className="field-label"><span>Horário <span className="subtle">(opcional)</span></span>
        <input type="time" disabled={!value.dueAt} value={value.eventTime ? localTime(value.dueAt) : ''}
          onChange={(event) => {
            const time = event.target.value;
            onChange({ ...value, dueAt: dateToDeadline(asLocalDate(value.dueAt), time), eventTime: !!time || undefined });
          }} />
      </label>}
      <div className="field-label">Duração estimada
        <Select label="Duração estimada" value={value.minutes} onChange={(minutes) => change('minutes', minutes)}
          options={availableDurations.map((minutes) => [minutes, minutes + ' min'])} />
      </div>
      <div className="field-label">Importância
        <Select label="Importância" value={value.importance} onChange={(importance) => change('importance', importance)}
          options={[[1, 'Baixa'], [2, 'Média'], [3, 'Alta']]} />
      </div>
      <div className="field-label">Esforço
        <Select label="Esforço" value={value.effort} onChange={(effort) => change('effort', effort)}
          options={[[1, 'Leve'], [2, 'Moderado'], [3, 'Intenso']]} />
      </div>
    </div>
    {value.kind === 'task' && <TaskPlanningFields value={value} change={onChange} entryId={entryId} />}
    {value.kind === 'worry' && <p className="form-footnote">Preocupações não entram automaticamente na lista de tarefas. Você pode apenas registrá-las.</p>}
  </div>;
}
