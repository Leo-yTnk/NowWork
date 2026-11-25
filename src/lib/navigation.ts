export const planningViews = [
  { id: 'tarefas', label: 'Tarefas' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'entrada', label: 'Caixa de entrada' },
] as const;

export const studyViews = [
  { id: 'foco', label: 'Foco' },
  { id: 'progresso', label: 'Progresso' },
] as const;

export const subjectViews = [
  { id: 'caderno', label: 'Caderno' },
  { id: 'tarefas', label: 'Tarefas' },
  { id: 'revisao', label: 'Revisão' },
] as const;

type PlanningView = typeof planningViews[number]['id'];
type StudyView = typeof studyViews[number]['id'];
export type SubjectView = typeof subjectViews[number]['id'];
export type Area = 'hoje' | 'planejar' | 'materias' | 'estudar';

export type Route =
  | { area: 'hoje' }
  | { area: 'planejar'; view: PlanningView; entryId?: string }
  | { area: 'estudar'; view: StudyView }
  | { area: 'materias'; subjectId?: string; view?: SubjectView; noteId?: string };

export const areas: Record<Area, Route> = {
  hoje: { area: 'hoje' },
  planejar: { area: 'planejar', view: 'tarefas' },
  materias: { area: 'materias' },
  estudar: { area: 'estudar', view: 'foco' },
};

export function routeHref(route: Route): string {
  switch (route.area) {
    case 'hoje': return '#/hoje';
    case 'planejar': return '#/planejar/' + route.view + (route.entryId ? '/' + encodeURIComponent(route.entryId) : '');
    case 'estudar': return '#/estudar/' + route.view;
    case 'materias': return route.subjectId
      ? '#/materias/' + encodeURIComponent(route.subjectId) + '/' + (route.view || 'caderno') + ((route.view === 'caderno' || route.view === 'revisao') && route.noteId ? '/' + encodeURIComponent(route.noteId) : '')
      : '#/materias';
  }
}

export function parseRoute(hash: string): Route {
  const [, area, segment, view, item] = hash.split('/');
  if (area === 'planejar') {
    const selected = planningViews.find(({ id }) => id === segment)?.id ?? 'tarefas';
    return { area, view: selected, entryId: selected !== 'agenda' ? decode(view) : undefined };
  }
  if (area === 'estudar') return { area, view: studyViews.find(({ id }) => id === segment)?.id ?? 'foco' };
  if (area === 'materias') {
    const subjectId = decode(segment);
    if (!subjectId) return areas.materias;
    const selected = subjectViews.find(({ id }) => id === view)?.id ?? 'caderno';
    return { area, subjectId, view: selected, noteId: selected !== 'tarefas' ? decode(item) : undefined };
  }
  return areas.hoje;
}

function decode(value: string | undefined) {
  try { return value ? decodeURIComponent(value) : undefined; }
  catch { return undefined; }
}
