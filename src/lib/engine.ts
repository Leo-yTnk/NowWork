import type { AppData, Energy, Entry, Activity } from '../types';

export function pointsFor(entry: Entry): number {
  return 6 + entry.importance * 4 + Math.min(8, Math.floor(entry.minutes / 30) * 2);
}

export function pointsBalance(activity: Activity[]): number {
  return activity.reduce((sum, item) => sum + item.points, 0);
}

export function dueDays(entry: Entry, now: Date = new Date()): number | null {
  if (!entry.dueAt) return null;
  const time = new Date(entry.dueAt).getTime();
  return Number.isFinite(time) ? (time - now.getTime()) / 86400000 : null;
}

export function priorityScore(entry: Entry, energy: Energy, now = new Date()): number {
  if (entry.kind !== 'task' || entry.status !== 'active') return -Infinity;
  const days = dueDays(entry, now);
  const deadline = days === null ? 0 : days < 0 ? 48 : days <= 1 ? 40 : days <= 3 ? 28 : days <= 7 ? 15 : 0;
  const match = entry.effort <= energy ? 12 : -14 * (entry.effort - energy);
  const quickWin = entry.minutes <= 20 ? 8 : entry.minutes <= 40 ? 4 : 0;
  const deferrals = Math.min(12, entry.postponeCount * 4);
  return deadline + entry.importance * 9 + match + quickWin + deferrals;
}

export function rankedTasks(data: AppData, now = new Date()): Entry[] {
  return data.entries
    .filter((item) => item.status === 'active' && item.kind === 'task')
    .sort((a, b) => priorityScore(b, data.profile.energy, now) - priorityScore(a, data.profile.energy, now) ||
      a.createdAt.localeCompare(b.createdAt));
}

export function reasonFor(entry: Entry, energy: Energy, now = new Date()): string {
  const days = dueDays(entry, now);
  if (days !== null && days < 0) return 'O prazo informado já passou; vale rever esta pendência.';
  if (days !== null && days <= 1) return 'O prazo está próximo, então faz sentido priorizá-la.';
  if (entry.effort > energy) return 'É importante, mas exige mais energia do que a que você indicou.';
  if (entry.minutes <= 20) return 'É uma ação breve, compatível com sua disposição atual.';
  if (entry.importance === 3) return 'Você marcou esta atividade como muito importante.';
  if (entry.postponeCount >= 2) return 'Você já a adiou algumas vezes; um passo pequeno pode ajudar.';
  return 'Ela combina prazo, importância, duração e disposição disponível.';
}

export function assistantMessage(data: AppData, now = new Date()): string {
  const tasks = data.entries.filter((e) => e.kind === 'task' && e.status === 'active');
  const overdue = tasks.filter((e) => (dueDays(e, now) ?? Infinity) < 0);
  const soon = tasks.filter((e) => { const d = dueDays(e, now); return d !== null && d >= 0 && d <= 1; });
  if (data.break) return 'Esta pausa também faz parte do plano. O resto pode esperar um pouco.';
  if (overdue.length) return 'Há uma atividade com prazo ultrapassado no que você registrou. Vamos cuidar de uma coisa por vez?';
  if (!tasks.length && data.entries.length === 0) return 'Um lugar tranquilo para tirar as coisas da cabeça. Registre algo quando quiser.';
  if (!tasks.length) return 'Não encontrei tarefas em aberto. Você pode descansar ou revisar suas anotações.';
  if (soon.length > 0) return 'Existe um prazo próximo entre suas tarefas. Organizei uma próxima ação para você.';
  if (tasks.length >= 7) return 'Há bastante coisa registrada. Você não precisa resolver tudo agora.';
  if (now.getHours() >= 21 && !soon.length) return 'Não encontrei urgências para as próximas 24 horas. Que tal desacelerar?';
  if (data.profile.energy === 1) return 'Com pouca disposição, um passo menor também é progresso.';
  if (data.profile.energy === 3) return 'Você marcou sua disposição como alta. Podemos aproveitar sem exagerar.';
  return 'Vamos deixar o dia mais leve, começando pelo que mais importa.';
}

export function weekActivity(data: Pick<AppData, 'activity' | 'entries'>, now = new Date()) {
  const completedByDay = new Map<string, number>();
  for (const entry of data.entries) {
    if (entry.kind !== 'task' || entry.status === 'active') continue;
    const day = asLocalDate(entry.completedAt);
    if (day) completedByDay.set(day, (completedByDay.get(day) ?? 0) + 1);
  }
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - index));
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    const actions = data.activity.filter((event) => {
      const at = new Date(event.at).getTime();
      return at >= day.getTime() && at < next.getTime();
    });
    return {
      key: day.toISOString(),
      label: new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(day).replace('.', ''),
      completed: completedByDay.get(asLocalDate(day.toISOString())) ?? 0,
      steps: actions.filter((a) => a.kind === 'step').length,
      breaks: actions.filter((a) => a.kind === 'rest').length,
      focusMinutes: actions.filter((a) => a.kind === 'focus').reduce((s, a) => s + (a.minutes || 0), 0),
    };
  });
}

export function dueLabel(date: string | null, today = new Date()): string {
  if (!date) return 'Sem prazo';
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return 'Sem prazo';
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return 'Amanhã';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(d).replace('.', '');
}

export function asLocalDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

export function localTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return [date.getHours(), date.getMinutes()].map((part) => String(part).padStart(2, '0')).join(':');
}

export function entryDueLabel(entry: Entry, now = new Date()): string {
  const label = dueLabel(entry.dueAt, now);
  return entry.kind === 'event' && entry.eventTime && entry.dueAt ? label + ' às ' + localTime(entry.dueAt) : label;
}

export function nextCommitment(entries: Entry[], now: Date): Entry | undefined {
  return entries.filter((entry) => entry.kind === 'event' && entry.status === 'active' &&
    entry.dueAt && Date.parse(entry.dueAt) >= now.getTime())
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!))[0];
}

export function dateToDeadline(date: string, time = ''): string | null {
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time ? time.split(':').map(Number) : [23, 59];
  const result = new Date(year, month - 1, day, hour, minute);
  return Number.isFinite(result.getTime()) ? result.toISOString() : null;
}
