import { useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Archive, Brain, ChevronDown, Inbox, Plus, Search, Sparkles } from 'lucide-react';
import { useApp } from '../state/AppState';
import { dueDays } from '../lib/engine';
import { KINDS, type EntryKind } from '../types';
import { Button, EmptyState, SectionHeader, Surface } from '../components/ui';
import { EntryFields, freshInput } from '../components/EntryFields';
import { Select } from '../components/Select';
import { EntryCard } from '../components/EntryCard';

type Filter = 'active' | 'all' | 'task' | 'event' | 'worry' | 'idea' | 'done' | 'archived';

export function Mente({ selectedId }: { selectedId?: string }) {
  const app = useApp();
  const { data } = app;
  const [draft, setDraft] = useState(freshInput);
  const [details, setDetails] = useState(false);
  const [filter, setFilter] = useState<Filter>(selectedId ? 'all' : 'active');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(12);
  const reduceSystem = useReducedMotion();
  const reduce = !!reduceSystem || data.profile.reducedMotion;

  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    app.addEntry({ ...draft, title: draft.title.trim() });
    setDraft(freshInput());
    setDetails(false);
    setFilter('active');
    setSearch('');
    setLimit(12);
  };
  const entries = useMemo(() => {
    return data.entries
      .filter((item) => filter === 'all' ? true : filter === 'active' ? item.status === 'active'
        : filter === 'done' || filter === 'archived' ? item.status === filter : item.kind === filter && item.status !== 'archived')
      .filter((item) => (item.title + ' ' + item.note).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
      .sort((a, b) => {
        if (a.id === selectedId || b.id === selectedId) return a.id === selectedId ? -1 : 1;
        const status = ({active:0,done:1,archived:2} as const);
        return status[a.status] - status[b.status] ||
          (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity) ||
          b.createdAt.localeCompare(a.createdAt);
      });
  }, [data.entries, filter, search, selectedId]);
  const expiring = data.entries.filter((item) => item.status === 'active' && item.dueAt &&
    (dueDays(item) ?? Infinity) <= 2).length;
  const kindIcons: {kind: EntryKind; label: string}[] = [
    {kind:'task',label:'Tarefa'}, {kind:'event',label:'Compromisso'},
    {kind:'worry',label:'Preocupação'}, {kind:'idea',label:'Ideia'},
  ];
  return <div className="screen mind-screen">
    <Surface className="capture-card">
      <form onSubmit={create}>
        <div className="capture-label"><Sparkles size={16}/> Captura rápida</div>
        <div className="capture-main">
          <input value={draft.title} onChange={(e) => setDraft({...draft,title:e.target.value})}
            placeholder="O que está ocupando sua mente?" required maxLength={200} aria-label="Novo registro"/>
          <Button variant="primary" size="lg" type="submit" icon={<Plus size={18}/>}>Guardar</Button>
        </div>
        <div className="kind-choices" role="group" aria-label="Classificação do registro">
          {kindIcons.map(({kind,label}) => <button type="button" key={kind} className={'kind-choice ' + (draft.kind === kind ? 'chosen' : '')}
            aria-pressed={draft.kind === kind} onClick={() => setDraft({...draft,kind})}>{label}</button>)}
        </div>
        <button className="capture-more" type="button" aria-expanded={details} onClick={() => setDetails(!details)}>
          {details ? 'Ocultar detalhes' : 'Adicionar detalhes opcionais'}
          <motion.span animate={{rotate:details ? 180 : 0}} transition={reduce ? {duration:0} : {duration:.18}}><ChevronDown size={16}/></motion.span>
        </button>
        <AnimatePresence initial={false}>
          {details && <motion.div initial={reduce ? false : {height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={reduce ? {opacity:0,transition:{duration:0}} : {height:0,opacity:0}} transition={{duration:reduce ? 0 : .23}} className="detail-clip">
            <div className="capture-details"><EntryFields value={draft} onChange={setDraft} showKind={false}/></div>
          </motion.div>}
        </AnimatePresence>
        {draft.kind === 'worry' && !details && <p className="worry-hint">Pode ser só um desabafo. Não vamos transformá-lo em tarefa.</p>}
      </form>
    </Surface>

    <div className="list-tools">
      <div><SectionHeader label="Seus registros" />{expiring > 0 && <p className="list-alert">{expiring} registro{expiring > 1 ? 's' : ''} com prazo próximo ou vencido</p>}</div>
      <div className="list-controls"><label className="search-control"><Search size={15}/><input aria-label="Pesquisar registros" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."/></label>
      <Select label="Filtrar registros" value={filter} onChange={(value) => { setFilter(value); setLimit(12); }}
        options={[[ 'active', 'Em aberto'], ['all', 'Todos'], ...Object.entries(KINDS) as [EntryKind, string][],
          ['done', 'Concluídos'], ['archived', 'Arquivados']]} /></div>
    </div>
    <div className="record-list">
      {entries.length ? entries.slice(0,limit).map((entry) => <EntryCard key={entry.id} entry={entry} initiallyExpanded={entry.id === selectedId}/>) :
        <Surface><EmptyState icon={filter === 'archived' ? <Archive size={23}/> : data.entries.length ? <Search size={23}/> : <Brain size={23}/>}
          title={data.entries.length ? 'Nenhum registro neste filtro.' : 'Uma mente mais leve começa aqui.'}
          description={data.entries.length ? 'Tente outro filtro ou uma busca diferente.' : 'Anote uma tarefa, um pensamento ou uma ideia no campo acima. Nenhuma organização complexa é necessária.'}/></Surface>}
      {entries.length > limit && <Button variant="secondary" className="more-records" icon={<Inbox size={16}/>} onClick={() => setLimit(limit+12)}>Mostrar mais {Math.min(entries.length-limit,12)} registros</Button>}
    </div>
  </div>;
}
