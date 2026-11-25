import { RecordLinks } from './RecordLinks';
import { intentionPrompt } from '../lib/decision';
import { isExecutable } from '../lib/planning';
import { subjectTone } from '../lib/subjectAppearance';
import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Archive, CalendarDays, Check, ChevronDown, Clock3, Play, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { Entry, EntryInput } from '../types';
import { KINDS } from '../types';
import { entryDueLabel, dueDays } from '../lib/engine';
import { springs } from '../lib/motion';
import { useApp } from '../state/AppState';
import { Button, KindPill } from './ui';
import { EntryFields } from './EntryFields';

function entryInput(entry: Entry): EntryInput {
  const { title, kind, note, importance, effort, minutes, dueAt, eventTime, subjectId, dependencies, plannedOn, optional, activityType, intention } = entry;
  return { title, kind, note, importance, effort, minutes, dueAt, eventTime, subjectId, dependencies, plannedOn, optional, activityType, intention };
}

export function EntryCard({ entry, initiallyExpanded = false }: { entry: Entry; initiallyExpanded?: boolean }) {
  const app = useApp();
  const reduceSystem = useReducedMotion();
  const reduce = !!reduceSystem || app.data.profile.reducedMotion;
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [editing, setEditing] = useState(false);
  const [stepText, setStepText] = useState('');
  const [draft, setDraft] = useState<EntryInput>(() => entryInput(entry));
  useEffect(() => { if (!editing) setDraft(entryInput(entry)); }, [entry, editing]);
  const prompt = intentionPrompt(entry, app.data, new Date());
  const executable = isExecutable(entry, app.data.entries);
  const overdue = entry.status === 'active' && (dueDays(entry) ?? Infinity) < 0;
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    app.editEntry(entry.id, { ...draft, title: draft.title.trim() });
    setEditing(false);
  };
  const addStep = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    app.addStep(entry.id, stepText);
    setStepText('');
  };
  const subject = app.data.subjects.find((item) => item.id === entry.subjectId);
  const tone = entry.kind === 'worry' ? 'amber' : entry.kind === 'idea' ? 'purple' : entry.kind === 'task' ? 'teal' : 'neutral';

  return <motion.article layout={!reduce} transition={springs.layout} className={'surface entry-card ' + (expanded ? 'is-expanded ' : '') + (entry.status !== 'active' ? 'is-dimmed' : '')}>
    <button className="entry-summary" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      <div className="entry-main"><div className="entry-tags"><KindPill tone={tone}>{KINDS[entry.kind]}</KindPill>
        {subject && <span className="nw-tag subject-tone" style={subjectTone(subject.color)}>{subject.title}</span>}
        {entry.importance === 3 && <KindPill tone="amber">Alta prioridade</KindPill>}
        {entry.source === 'demo' && <span className="demo-pill">Exemplo</span>}
        {entry.status === 'done' && <span className="status-label"><Check size={12}/> Concluída</span>}
        {entry.status === 'archived' && <span className="status-label">Arquivada</span>}
      </div>
      <h3>{entry.title}</h3><div className="entry-meta">
        {entry.dueAt && <span className={overdue ? 'is-overdue' : ''}><CalendarDays size={13}/>{overdue ? 'Prazo vencido' : entryDueLabel(entry)}</span>}
        {entry.kind === 'task' && <span><Clock3 size={13}/>{entry.minutes} min</span>}
        {entry.steps.length > 0 && <span>{entry.steps.filter((s) => s.done).length}/{entry.steps.length} passos</span>}
      </div></div>
      <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={reduce ? {duration:0} : springs.press} className="entry-chevron"><ChevronDown size={19}/></motion.span>
    </button>
    <AnimatePresence initial={false}>
      {expanded && <motion.div key="details" initial={reduce ? false : {height:0, opacity:0}} animate={{height:'auto', opacity:1}}
        exit={reduce ? {opacity:0, transition:{duration:0}} : {height:0, opacity:0}}
        transition={reduce ? {duration:0} : {duration:0.22}} className="entry-detail-clip">
        <div className="entry-detail">
          {editing ? <form onSubmit={save}><EntryFields value={draft} onChange={setDraft} entryId={entry.id} />
            <div className="button-row"><Button type="submit" variant="primary" size="sm" icon={<Check size={15}/>}>Salvar</Button>
            <Button size="sm" onClick={() => setEditing(false)}>Cancelar</Button></div>
          </form> : <>
            {entry.note && <p className="entry-note">{entry.note}</p>}
            {entry.kind === 'worry' && <div className="reflection">Nem tudo precisa virar uma ação. Se ajudar, pense no que está ao seu alcance — ou deixe esta preocupação guardada por enquanto.</div>}
            {entry.plannedOn && <p className="nw-muted">Planejada para {new Date(entry.plannedOn + 'T12:00:00').toLocaleDateString('pt-BR')}</p>}
            {prompt && <p>{prompt}</p>}
            {entry.kind === 'task' && entry.status === 'active' && !executable && <p className="nw-muted">Aguarda a conclusão de pré-requisitos.</p>}
            <RecordLinks record={{ type: 'entry', id: entry.id }} />
            {entry.kind === 'task' && entry.status === 'active' && <div className="steps-area">
              <div className="steps-title">Pequenos passos</div>
              {entry.steps.length === 0
                ? <Button size="sm" variant="ghost" onClick={() => app.divideEntry(entry.id)} icon={<Plus size={15}/>}>Dividir em três passos</Button>
                : entry.steps.map((step) => <label className="step-check" key={step.id}>
                    <input type="checkbox" checked={step.done} onChange={() => app.toggleStep(entry.id, step.id)} />
                    <span>{step.title}</span>
                  </label>)}
              <form className="step-add" onSubmit={addStep}>
                <input aria-label="Novo passo" maxLength={160} value={stepText} onChange={(e) => setStepText(e.target.value)} placeholder="Adicionar passo..." />
                <Button size="sm" type="submit" disabled={!stepText.trim()} icon={<Plus size={15}/>}>Adicionar</Button>
              </form>
            </div>}
            <div className="entry-actions">
              {entry.status === 'active' && <Button size="sm" variant="primary" icon={<Check size={15}/>} onClick={() => app.completeEntry(entry.id)}>{entry.kind === 'worry' ? 'Resolvida' : 'Concluir'}</Button>}
              {entry.status === 'active' && entry.kind === 'task' && <Button size="sm" icon={<RotateCcw size={14}/>} onClick={() => app.postponeEntry(entry.id)}>Adiar 1 dia</Button>}
              {entry.status === 'active' && entry.kind === 'task' && executable && !app.data.focus && !app.data.break &&
                <Button size="sm" icon={<Play size={14}/>} onClick={() => { window.location.hash = "#/estudar/foco"; app.startFocus(entry.id); }}>Iniciar foco</Button>}
              {entry.status === 'done' && <Button size="sm" icon={<RotateCcw size={14}/>} onClick={() => app.reopenEntry(entry.id)}>Reabrir</Button>}
              <Button size="sm" variant="ghost" icon={<Pencil size={15}/>} onClick={() => setEditing(true)}>Editar</Button>
              {entry.status !== 'archived' ? <Button size="sm" variant="ghost" icon={<Archive size={15}/>} onClick={() => app.archiveEntry(entry.id)}>Arquivar</Button> : <Button size="sm" variant="ghost" icon={<RotateCcw size={15}/>} onClick={() => app.restoreEntry(entry.id)}>Restaurar</Button>}
              <Button size="sm" variant="danger" icon={<Trash2 size={15}/>} onClick={() => app.deleteEntry(entry.id)}>Excluir</Button>
            </div>
          </>}
        </div>
      </motion.div>}
    </AnimatePresence>
  </motion.article>;
}
