import { useState } from 'react';
import { Button } from '../components/ui';
import { recommendations } from '../lib/decision';
import { asLocalDate } from '../lib/engine';
import { clockLabel, clockMinutes, dayOffset } from '../lib/localDates';
import { dayCapacity, dueOnOrBefore, suggestBlocks, suggestWeek, type BlockProposal } from '../lib/planning';
import { useApp } from '../state/AppState';
import type { AppData } from '../types';

const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const labelRange = (range: { start: number; end: number }) => clockLabel(range.start) + '–' + clockLabel(range.end);

export function CapacitySummary({ capacity }: { capacity: ReturnType<typeof dayCapacity> }) {
  if (!capacity.configured) return <p className="nw-muted">Configure as janelas de disponibilidade na agenda para calcular a capacidade.</p>;
  return <><dl className="cognitive-metrics">
    {[
      ['Disponível', capacity.available], ['Compromissos na janela', capacity.fixedMinutes], ['Estudo em blocos', capacity.study],
      ['Pausas em blocos', capacity.breaks], ['Margem', capacity.margin], ['Atividades sem bloco', capacity.planned], ['Tempo livre', capacity.unallocated],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value} min</dd></div>)}
    </dl>{capacity.excess > 0 && <p role="status">O plano excede a capacidade em {capacity.excess} min.</p>}</>;
}

export function CapacityPlanner({ day }: { day: string }) {
  const app = useApp();
  const { data } = app;
  const [weekday, setWeekday] = useState(new Date(day + 'T12:00:00').getDay());
  const [start, setStart] = useState('16:00');
  const [end, setEnd] = useState('18:00');
  const [kind, setKind] = useState<'study' | 'break'>('study');
  const [taskId, setTaskId] = useState('');
  const [preview, setPreview] = useState<BlockProposal[] | null>(null);
  const [message, setMessage] = useState('');
  const capacity = dayCapacity(data, day);
  const tasks = data.entries.filter((entry) => entry.kind === 'task' && entry.status === 'active');
  const load = tasks.filter((entry) => entry.plannedOn === day || (!entry.plannedOn && dueOnOrBefore(entry, day)));
  const windows = data.cognitive.availability[weekday] ?? [];
  const updateWindows = (ranges: AppData['cognitive']['availability'][number]) =>
    app.updateCognitive({ availability: { ...data.cognitive.availability, [weekday]: ranges } });
  const blockTitle = (block: BlockProposal) => block.type === 'break' ? 'Pausa' :
    data.entries.find((entry) => entry.id === block.entryId)?.title ?? 'Estudo';
  const conflictTitle = (id: string) => capacity.fixed.find((event) => event.id === id)?.title ??
    (capacity.blocks.some((block) => block.id === id) ? blockTitle(capacity.blocks.find((block) => block.id === id)!) : 'Registro');
  const propose = (weekly: boolean) => {
    const candidates = recommendations(data, new Date(day + 'T12:00:00'), day, false)
      .flatMap((item) => item.type === 'task' ? [item.entry] : []);
    setPreview(weekly ? suggestWeek(data, day, candidates) : suggestBlocks(data, day, candidates));
    setMessage('');
  };
  return <div className="nw-stack cognitive-planner">
    <h3>Capacidade do dia</h3><CapacitySummary capacity={capacity} />
    {capacity.conflicts.length > 0 && <ul className="cognitive-list" aria-label="Conflitos do dia">
      {capacity.conflicts.map(([a, b]) => <li key={a + b}>Conflito entre {conflictTitle(a)} e {conflictTitle(b)}</li>)}
    </ul>}
    {capacity.outside.length > 0 && <p>Fora das janelas disponíveis: {capacity.outside.map(blockTitle).join(', ')}.</p>}
    {capacity.fixed.length > 0 && <ul className="cognitive-list">{capacity.fixed.map((event) => <li key={event.id}>{labelRange(event)} · {event.title}</li>)}</ul>}
    {capacity.blocks.length > 0 && <ul className="cognitive-list">{[...capacity.blocks].sort((a, b) => a.start - b.start).map((block) =>
      <li key={block.id} className="cognitive-line"><span>{labelRange(block)} · {blockTitle(block)}</span>
        <Button size="sm" variant="ghost" onClick={() => app.removeBlock(block.id)}>Remover bloco</Button></li>)}</ul>}
    <details className="cognitive-details"><summary>Janelas e margem</summary>
      <div className="cognitive-form-grid">
        <label className="field-label">Dia da semana<select className="ds-input" value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>
          {weekdays.map((label, index) => <option value={index} key={label}>{label}</option>)}</select></label>
        <label className="field-label">Margem para imprevistos (%)<input className="ds-input" type="number" min={0} max={90} value={data.cognitive.buffer}
          onChange={(event) => app.updateCognitive({ buffer: Math.max(0, Math.min(90, Number(event.target.value))) })} /></label>
      </div>
      <p className="nw-muted">A margem inicial é 25% do tempo que sobra após os compromissos fixos. Ajuste-a conforme sua rotina.</p>
      <ul className="cognitive-list">{windows.map((range, index) => <li className="cognitive-line" key={index}>{labelRange(range)}
        <Button size="sm" onClick={() => updateWindows(windows.filter((_, i) => index !== i))}>Remover janela</Button></li>)}</ul>
      <form className="nw-stack" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const first = clockMinutes(String(form.get('start'))), last = clockMinutes(String(form.get('end')));
        if (first < last) { updateWindows([...windows, { start: first, end: last }]); setMessage('Janela adicionada.'); }
        else setMessage('O horário final precisa vir depois do início.');
      }}>
        <div className="cognitive-form-grid">
          <label className="field-label">Início da janela<input className="ds-input" required type="time" name="start" defaultValue="16:00" /></label>
          <label className="field-label">Fim da janela<input className="ds-input" required type="time" name="end" defaultValue="18:00" /></label>
        </div>
        <div className="nw-toolbar"><Button type="submit" size="sm">Adicionar janela</Button>
          <Button size="sm" onClick={() => updateWindows([])}>Definir como indisponível</Button>
          <Button size="sm" variant="ghost" onClick={() => updateWindows(undefined)}>Limpar configuração</Button></div>
      </form>
    </details>
    <details className="cognitive-details"><summary>Adicionar bloco</summary>
      <form className="nw-stack" onSubmit={(event) => {
        event.preventDefault();
        const valid = app.applyBlocks([{ day, type: kind, entryId: kind === 'study' ? taskId || undefined : undefined, start: clockMinutes(start), end: clockMinutes(end) }]);
        setMessage(valid ? 'Bloco adicionado.' : 'Confira o horário e os blocos ou compromissos que se sobrepõem.');
      }}>
        <div className="cognitive-form-grid">
          <label className="field-label">Tipo<select className="ds-input" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
            <option value="study">Estudo</option><option value="break">Pausa</option></select></label>
          {kind === 'study' && <label className="field-label">Atividade ligada ao bloco<select className="ds-input" value={taskId} onChange={(event) => setTaskId(event.target.value)}>
            <option value="">Sem tarefa</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>}
          <label className="field-label">Início do bloco<input className="ds-input" required type="time" value={start} onChange={(event) => setStart(event.target.value)} /></label>
          <label className="field-label">Fim do bloco<input className="ds-input" required type="time" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
        </div>
        <Button type="submit" size="sm">Salvar bloco</Button>
      </form>
    </details>
    <div className="nw-toolbar"><Button size="sm" disabled={!capacity.configured} onClick={() => propose(false)}>Sugerir distribuição</Button>
      <Button size="sm" disabled={!Object.values(data.cognitive.availability).some((windows) => !!windows?.length)} onClick={() => propose(true)}>Distribuir pelos próximos sete dias</Button></div>
    {preview && <div className="nw-stack">
      {preview.length ? <>
        <h4>Prévia de blocos de estudo</h4>
        <ul className="cognitive-list">{preview.map((block) => <li key={block.entryId}>{new Date(block.day + 'T12:00:00').toLocaleDateString('pt-BR')} · {labelRange(block)} · {blockTitle(block)}
          {tasks.some((task) => task.id === block.entryId && !!task.dueAt && asLocalDate(task.dueAt) < block.day) && <small> · após o prazo</small>}</li>)}</ul>
        <div className="nw-toolbar"><Button size="sm" variant="primary" onClick={() => {
          const applied = app.applyBlocks(preview, true);
          setMessage(applied ? 'Blocos adicionados à agenda.' : 'O plano mudou. Gere uma nova prévia.');
          setPreview(null);
        }}>Aprovar blocos</Button><Button size="sm" onClick={() => setPreview(null)}>Descartar prévia</Button></div>
      </> : <p className="nw-muted" role="status">Nenhuma tarefa executável cabe nos intervalos consultados.</p>}
    </div>}
    {load.length > 0 && capacity.excess > 0 && <details className="cognitive-details">
      <summary>Ajustar carga do dia</summary>
      <p className="nw-muted">Divida a tarefa, reduza a estimativa ao revisar o escopo ou escolha outro dia. O prazo original fica visível na agenda.</p>
      <ul className="cognitive-list">{load.map((task) => <li key={task.id} className="cognitive-line">
        <a href={'#/planejar/tarefas/' + encodeURIComponent(task.id)}>{task.title}</a>
        <div className="nw-toolbar">
          <Button size="sm" onClick={() => app.divideEntry(task.id)}>Dividir</Button>
          <Button size="sm" onClick={() => app.planEntry(task.id, dayOffset(day, 1))}>Mover para o dia seguinte</Button>
          {task.optional && <Button size="sm" onClick={() => app.archiveEntry(task.id)}>Arquivar opcional</Button>}
        </div>
      </li>)}</ul>
    </details>}
    {message && <p role="status">{message}</p>}
  </div>;
}
