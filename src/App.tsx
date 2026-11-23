import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, Check, CircleHelp, Coffee, Download, Pencil, ShieldCheck, Sparkles, Trash2, Upload, X } from 'lucide-react';
import nowWorkLogo from './assets/nowwork-logo.png';
import { AppProvider, useApp } from './state/AppState';
import { ElasticSheet } from './components/ElasticSheet';
import { Button, IconButton, PageHeading, Stack } from './components/ui';
import { SectionContent, SectionNavigation, WorkspaceNavigation } from './components/WorkspaceNavigation';
import { areas, parseRoute, planningViews, routeHref, studyViews, subjectViews, type Route, type SubjectView } from './lib/navigation';
import { Agora } from './tabs/Agora';
import { Mente } from './tabs/Mente';
import { Evolucao } from './tabs/Evolucao';
import { validateData } from './lib/storage';
import { springs } from './lib/motion';
import type { AppData, Subject, Theme } from './types';
import { Dashboard } from './study/Dashboard';
import { Subjects, SubjectMark } from './study/Subjects';
import { Tasks, Week } from './study/Planner';
import { Notebook } from './study/Notebook';
import { useMobileEditor } from './study/NotebookToolbar';
import { Review } from './study/Review';
import { WorkspaceSearch, TaskForm, SubjectForm } from './study/WorkspacePanels';

type Sheet = { kind: 'settings' | 'break' | 'search' } | { kind: 'task'; subjectId?: string; dueAt?: string | null } | { kind: 'subject'; subject?: Subject };

function useWorkspaceRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [hash]);
  const open = (next: Route) => { window.location.hash = routeHref(next); };
  return { route: parseRoute(hash), open };
}

function downloadBackup(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'nowwork-backup-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Settings() {
  const app = useApp();
  const { data } = app;
  const input = useRef<HTMLInputElement>(null);
  const download = () => {
    downloadBackup(data);
    app.notify('Backup JSON exportado.');
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const content = JSON.parse(await file.text());
      const restored = validateData(content);
      if (window.confirm('Importar este backup substituirá todos os registros locais. Continuar?')) app.restore(restored);
    } catch (error) {
      app.notify(error instanceof Error ? error.message : 'Não foi possível importar o arquivo.');
    }
  };
  const demoCount = data.entries.filter((entry) => entry.source === 'demo').length;
  return <div className="settings-content">
    <div className="settings-group"><div className="settings-group-title">Personalização</div>
      <label className="field-label">Seu nome <span className="subtle">(opcional)</span>
        <input maxLength={50} placeholder="Como quer ser chamado?" value={data.profile.name}
          onChange={(e) => app.updateProfile({name:e.target.value})}/></label>
      <div className="settings-label">Aparência</div>
      <div className="settings-options">{([['system','Automático'],['light','Claro'],['dark','Escuro']] as [Theme,string][]).map(([value,label]) =>
        <button type="button" key={value} className={'setting-option ' + (data.profile.theme === value ? 'active' : '')}
          aria-pressed={data.profile.theme === value} onClick={() => app.updateProfile({theme:value})}>
          {label}{data.profile.theme === value && <Check size={15}/>}</button>)}</div>
      <label className="toggle-row"><span><strong>Reduzir movimento</strong><small>Desativa molas e movimentos não essenciais; a preferência do dispositivo também é respeitada.</small></span>
        <input type="checkbox" checked={data.profile.reducedMotion} onChange={(e) => app.updateProfile({reducedMotion:e.target.checked})}/></label>
    </div>
    <div className="settings-group"><div className="settings-group-title">Seus dados</div>
      <p className="settings-description"><ShieldCheck size={17}/> Suas informações ficam neste navegador. Nenhum cadastro ou servidor é necessário.</p>
      <div className="settings-buttons"><Button icon={<Download size={16}/>} onClick={download}>Exportar backup</Button>
        <Button icon={<Upload size={16}/>} onClick={() => input.current?.click()}>Importar JSON</Button>
        <input className="visually-hidden" aria-label="Selecionar backup JSON" type="file" accept=".json,application/json" ref={input} onChange={importFile}/></div>
    </div>
    <div className="settings-group"><div className="settings-group-title">Demonstração</div>
      <p className="settings-description">Exemplos opcionais e claramente identificados. Não substituem seus registros reais.</p>
      <div className="settings-buttons"><Button icon={<Sparkles size={16}/>} onClick={app.addDemo}>Carregar exemplos</Button>
        {demoCount > 0 && <Button icon={<X size={16}/>} onClick={app.removeDemo}>Remover {demoCount} exemplos</Button>}</div>
    </div>
    <div className="settings-group danger-zone"><div className="settings-group-title">Recomeçar</div>
      <p className="settings-description">Apaga os dados deste aplicativo no navegador. Exporte um backup se quiser guardá-los.</p>
      <Button variant="danger" icon={<Trash2 size={16}/>} onClick={() => {
        if (window.confirm('Apagar todas as matérias, páginas, cartões, registros e preferências? Esta ação não pode ser desfeita.')) app.clearAll();
      }}>Apagar todos os dados</Button>
    </div>
    <p className="settings-version">NowWork · Código aberto sob licença MIT</p>
  </div>;
}

function AppContent() {
  const app = useApp();
  const { route, open } = useWorkspaceRoute();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const systemReduced = useReducedMotion();
  const reduce = !!systemReduced || app.data.profile.reducedMotion;
  const subject = route.area === 'materias' ? app.data.subjects.find(({ id }) => id === route.subjectId) : undefined;
  const noteId = route.area === 'materias' && route.view === 'caderno'
    ? app.data.notes.find((note) => note.subjectId === subject?.id && note.id === route.noteId)?.id : undefined;
  const { visitSubject } = app;
  const subjectId = subject?.id;
  const mobile = useMobileEditor();
  const sidebarId = useId();
  const sidebarToggleId = useId();
  const [desktopPagesOpen, setDesktopPagesOpen] = useState(true);
  const [mobilePagesOpen, setMobilePagesOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const notebookSubjectId = noteId ? subjectId : undefined;
  const pagesOpen = mobile ? mobilePagesOpen : desktopPagesOpen;
  const setPagesOpen = mobile ? setMobilePagesOpen : setDesktopPagesOpen;
  const closePages = () => {
    setPagesOpen(false);
    document.getElementById(sidebarToggleId)?.focus({ preventScroll: true });
  };
  useEffect(() => {
    setDesktopPagesOpen(true);
  }, [notebookSubjectId]);
  useEffect(() => {
    setMobilePagesOpen(false);
    setOptionsOpen(false);
  }, [noteId]);
  useEffect(() => {
    if (app.ready && subjectId) visitSubject(subjectId);
  }, [app.ready, subjectId, visitSubject]);
  const subjectPage = (id: string, view: SubjectView = 'caderno', noteId?: string) => open({ area: 'materias', subjectId: id, view, noteId });
  const newTask = (dueAt?: string | null) => setSheet({ kind: 'task', subjectId: subject?.id, dueAt });
  const openTask = (id: string) => {
    const entry = app.data.entries.find((item) => item.id === id);
    open({ area: 'planejar', view: entry?.kind === 'idea' || entry?.kind === 'worry' ? 'entrada' : 'tarefas', entryId: id });
  };
  const close = () => setSheet(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && (sheet?.kind === 'search' || (!sheet && !document.querySelector('.sheet-root')))) {
        event.preventDefault();
        setSheet(sheet ? null : { kind: 'search' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);
  if (app.loadFailed) return <main className="loading-shell">
    <p role="alert">O NowWork não conseguiu ler os dados locais. Os arquivos locais foram preservados.</p>
    <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
  </main>;
  if (!app.ready) return <div className="loading-shell"><div className="nw-logo"><img className="nw-logo-icon" src={nowWorkLogo} alt="" width={34} height={34} />NowWork</div><p>Preparando seu espaço…</p></div>;
  const createSubject = () => setSheet({ kind: 'subject' });
  const sheetTitles = { settings: 'Configurações', break: 'Uma pausa para respirar', search: 'Buscar no NowWork',
    task: 'Novo registro', subject: sheet?.kind === 'subject' && sheet.subject ? 'Editar matéria' : 'Nova matéria' };
  const routeKey = route.area === 'materias' ? noteId ? 'caderno:' + subjectId : route.subjectId || route.area : route.area;
  return <div className="nw-shell" data-notebook-page={noteId ? true : undefined}>
    <a className="workspace-skip" href="#main-content" onClick={(event) => {
      event.preventDefault();
      document.getElementById('main-content')?.focus();
    }}>Ir para o conteúdo</a>
    <WorkspaceNavigation current={route.area} search={() => setSheet({ kind: 'search' })} settings={() => setSheet({ kind: 'settings' })}
      notebook={noteId && subjectId ? {
        sidebarId, toggleId: sidebarToggleId, pagesOpen,
        togglePages: () => pagesOpen ? closePages() : setPagesOpen(true),
        directoryHref: routeHref({ area: 'materias', subjectId, view: 'caderno' }),
        openOptions: () => setOptionsOpen(true),
      } : undefined} />
    <main className={'nw-main' + (noteId ? ' document-workspace' : '')} id="main-content" tabIndex={-1}>
      {app.saveError && <div className="inline-alert" role="alert">
        <span>{app.saveError}</span>
        <Button size="sm" onClick={() => downloadBackup(app.data)}>Exportar backup</Button>
      </div>}
      <motion.div key={routeKey} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : springs.panel}>
        {route.area === 'hoje' && <Dashboard subject={subjectPage} newSubject={createSubject}
          focus={() => open(areas.estudar)} add={newTask} openTask={openTask} />}
        {route.area === 'materias' && (!subject
          ? <Subjects open={subjectPage} create={createSubject} />
          : noteId ? <Notebook key={subject.id} subjectId={subject.id} noteId={noteId} open={(id) => subjectPage(subject.id, 'caderno', id)}
            pageControls={{ mobile, pagesOpen, sidebarId, closePages, optionsOpen, closeOptions: () => setOptionsOpen(false) }} />
          : <Stack className="workspace-page">
              <div className="workspace-page-heading">
                <PageHeading title={subject.title} icon={<div className="subject-heading-icons">
                  <a className="subject-directory-link" href={routeHref(areas.materias)} aria-label="Todas as matérias" title="Todas as matérias">
                    <ArrowLeft size={18} aria-hidden="true" />
                  </a><SubjectMark subject={subject} />
                </div>} action={<IconButton label="Editar matéria" onClick={() => setSheet({ kind: 'subject', subject })}><Pencil size={18} /></IconButton>} />
                <SectionNavigation label="Nesta matéria" links={subjectViews.map(({ id, label }) => ({ label, active: route.view === id,
                  href: routeHref({ area: 'materias', subjectId: subject.id, view: id }) }))} />
              </div>
              <SectionContent activeIndex={subjectViews.findIndex(({ id }) => id === route.view)}>
                {route.view === 'tarefas' && <Tasks subjectId={subject.id} onAdd={() => newTask()} />}
                {route.view === 'caderno' && <Notebook subjectId={subject.id} open={(id) => subjectPage(subject.id, 'caderno', id)} />}
                {route.view === 'revisao' && <Review subjectId={subject.id} />}
              </SectionContent>
            </Stack>)}
        {route.area === 'planejar' && <Stack className="workspace-page">
          <div className="workspace-page-heading">
            <PageHeading title="Planejar" />
            <SectionNavigation label="Planejamento" links={planningViews.map(({ id, label }) =>
              ({ label, active: route.view === id, href: routeHref({ area: 'planejar', view: id }) }))} />
          </div>
          <SectionContent activeIndex={planningViews.findIndex(({ id }) => id === route.view)}>
            {route.view === 'tarefas' && <Tasks key={route.entryId || 'all'} onlyId={route.entryId} onAdd={() => newTask()} />}
            {route.view === 'agenda' && <Week onAdd={newTask} />}
            {route.view === 'entrada' && <Mente key={route.entryId || 'all'} selectedId={route.entryId} />}
          </SectionContent>
        </Stack>}
        {route.area === 'estudar' && <Stack className="workspace-page">
          <div className="workspace-page-heading">
            <PageHeading title="Estudar" />
            <SectionNavigation label="Estudo" links={studyViews.map(({ id, label }) =>
              ({ label, active: route.view === id, href: routeHref({ area: 'estudar', view: id }) }))} />
          </div>
          <SectionContent activeIndex={studyViews.findIndex(({ id }) => id === route.view)}>
            {route.view === 'foco' ? <Agora onMind={() => open({ area: 'planejar', view: 'entrada' })} onBreak={() => setSheet({ kind: 'break' })} /> : <Evolucao />}
          </SectionContent>
        </Stack>}
      </motion.div>
    </main>

    <AnimatePresence>{sheet && <ElasticSheet key={sheet.kind} title={sheetTitles[sheet.kind]} onClose={close}>
      {(dismiss: () => void) => <>
        {sheet.kind === 'settings' && <Settings />}
        {sheet.kind === 'task' && <TaskForm subjectId={sheet.subjectId} dueAt={sheet.dueAt} close={dismiss} />}
        {sheet.kind === 'subject' && <SubjectForm subject={sheet.subject} close={dismiss}
          save={(value) => { app.saveSubject(value); subjectPage(value.id); dismiss(); }}
          remove={(id) => { app.removeSubject(id); open(areas.materias); dismiss(); }} />}
        {sheet.kind === 'search' && <WorkspaceSearch subject={(id) => { subjectPage(id); dismiss(); }}
          note={(sid, id) => { subjectPage(sid, 'caderno', id); dismiss(); }} entry={(id) => { openTask(id); dismiss(); }} />}
        {sheet.kind === 'break' && <div className="break-sheet-content">
          <div className="break-illustration"><Coffee size={32} strokeWidth={1.5} /></div>
          <h3>Escolha um intervalo</h3><p>Quando terminar, a pausa será registrada em Progresso.</p>
          <div className="break-options">{[5, 10, 15].map((minutes) => <Button key={minutes} onClick={() => { app.startBreak(minutes); dismiss(); }}>{minutes} min</Button>)}</div>
          <p className="break-footnote"><CircleHelp size={14} /> Você pode encerrar a pausa pelo modo Foco.</p>
        </div>}
      </>}
    </ElasticSheet>}</AnimatePresence>

    <AnimatePresence>{app.toast && <motion.div key={app.toast.id} role="status" aria-live="polite"
      className="toast" initial={reduce ? false : {opacity:0,y:20,scale:.97}}
      animate={{opacity:1,y:0,scale:1}} exit={reduce ? {opacity:0,transition:{duration:0}} : {opacity:0,y:8}}
      transition={reduce ? {duration:0} : springs.panel}>
      <span><Check size={17}/>{app.toast.message}</span>
      {app.toast.undo && <button type="button" onClick={app.undoDelete}>Desfazer</button>}
      <button type="button" className="toast-close" aria-label="Dispensar aviso" onClick={app.dismissToast}><X size={15}/></button>
    </motion.div>}</AnimatePresence>
  </div>;
}

export default function App() {
  return <AppProvider><AppContent/></AppProvider>;
}
