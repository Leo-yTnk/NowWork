import type { Route } from './navigation';

function isDirectory(route: Route) {
  return route.area === 'materias' && !route.subjectId;
}

function visibleSubjectId(route: Route) {
  return route.area === 'materias' && !route.noteId ? route.subjectId : undefined;
}

export function sharedSubjectId(from: Route, to: Route) {
  if (isDirectory(from)) return visibleSubjectId(to);
  if (isDirectory(to)) return visibleSubjectId(from);
}

export function findSharedSubjectMark(id: string) {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-shared-subject]'))
    .find((mark) => mark.dataset.sharedSubject === id);
}

export function visibleSubjectMarkBounds(id: string) {
  const bounds = findSharedSubjectMark(id)?.getBoundingClientRect();
  const headerBottom = document.querySelector('.workspace-header')?.getBoundingClientRect().bottom ?? 0;
  if (bounds && bounds.width && bounds.height && bounds.right > 0 && bounds.left < window.innerWidth &&
      bounds.bottom > headerBottom && bounds.top < window.innerHeight) return bounds;
}

export function moveSubjectMark(id: string, from: DOMRect) {
  const mark = findSharedSubjectMark(id);
  const to = visibleSubjectMarkBounds(id);
  if (!mark?.animate || !to) return;
  const x = from.left + from.width / 2 - to.left - to.width / 2;
  const y = from.top + from.height / 2 - to.top - to.height / 2;
  if (Math.hypot(x, y) < 1) return;
  return mark.animate(
    [{ translate: x + 'px ' + y + 'px' }, { translate: '0px 0px' }],
    { duration: 260, easing: 'cubic-bezier(.2,.75,.3,1)' },
  );
}
