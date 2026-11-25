import type { AppData, Entry, TimeBlock, TimeRange } from '../types';
import { asLocalDate, localTime } from './engine';
import { clockMinutes, dayOffset } from './localDates';

export const overlaps = (a: TimeRange, b: TimeRange) => a.start < b.end && b.start < a.end;
const duration = ({ start, end }: TimeRange) => end - start;
const total = (ranges: TimeRange[]) => ranges.reduce((sum, range) => sum + duration(range), 0);

export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const result: TimeRange[] = [];
  for (const range of sorted) {
    const last = result.at(-1);
    if (last && last.end >= range.start) last.end = Math.max(last.end, range.end);
    else result.push({ start: range.start, end: range.end });
  }
  return result;
}

export function subtractRanges(open: TimeRange[], busy: TimeRange[]): TimeRange[] {
  return mergeRanges(busy).reduce((gaps, range) => gaps.flatMap((gap) => !overlaps(gap, range) ? [gap] : [
    ...(gap.start < range.start ? [{ start: gap.start, end: range.start }] : []),
    ...(range.end < gap.end ? [{ start: range.end, end: gap.end }] : []),
  ]), mergeRanges(open));
}

export function fixedEvents(data: AppData, day: string) {
  const previousDay = dayOffset(day, -1);
  return data.entries.flatMap((entry) => {
    const eventDay = asLocalDate(entry.dueAt);
    if (entry.kind !== 'event' || entry.status === 'archived' || !entry.eventTime || (eventDay !== day && eventDay !== previousDay)) return [];
    const start = clockMinutes(localTime(entry.dueAt)) - (eventDay === day ? 0 : 1440);
    const end = start + entry.minutes;
    return end > 0 ? [{ id: entry.id, title: entry.title, start: Math.max(0, start), end: Math.min(1440, end) }] : [];
  });
}

export function dueOnOrBefore(entry: Entry, day: string) {
  const deadline = asLocalDate(entry.dueAt);
  return !!deadline && deadline <= day;
}

export function dayCapacity(data: AppData, day: string, referenceDay = asLocalDate(new Date().toISOString())) {
  const weekday = new Date(day + 'T12:00:00').getDay();
  const configured = data.cognitive.availability[weekday];
  const windows = mergeRanges(configured ?? []);
  const fixed = fixedEvents(data, day);
  const blocks = data.blocks.filter((block) => block.day === day);
  const commitments = [...fixed, ...blocks];
  const gaps = subtractRanges(windows, commitments);
  const freeBeforeBlocks = subtractRanges(windows, fixed);
  const available = total(windows);
  const fixedMinutes = available - total(freeBeforeBlocks);
  const margin = Math.ceil(total(freeBeforeBlocks) * data.cognitive.buffer / 100);
  const study = total(mergeRanges(blocks.filter(({ type }) => type === 'study')));
  const breaks = total(mergeRanges(blocks.filter(({ type }) => type === 'break')));
  const studyByEntry = new Map<string, number>();
  for (const block of blocks) if (block.type === 'study' && block.entryId) {
    studyByEntry.set(block.entryId, (studyByEntry.get(block.entryId) ?? 0) + duration(block));
  }
  const planned = data.entries.filter((entry) => entry.status === 'active' && entry.kind === 'task' &&
    (entry.plannedOn === day || (!entry.plannedOn &&
      (asLocalDate(entry.dueAt) === day || (day === referenceDay && dueOnOrBefore(entry, day))))))
    .reduce((sum, entry) => sum + Math.max(0, entry.minutes - (studyByEntry.get(entry.id) ?? 0)), 0);
  const free = total(gaps);
  const conflicts = commitments.flatMap((first, index) => commitments.slice(index + 1)
    .filter((second) => overlaps(first, second)).map((second) => [first.id, second.id] as const));
  const outside = configured ? blocks.filter((block) => !windows.some((range) => range.start <= block.start && range.end >= block.end)) : [];
  const excess = configured ? Math.max(0, planned + margin - free, study + breaks + margin - total(freeBeforeBlocks)) : 0;
  return { configured: !!configured, windows, fixed, blocks, gaps, available, fixedMinutes, margin, study, breaks, planned, free, excess, conflicts, outside,
    unallocated: Math.max(0, free - margin - planned) };
}

export function isExecutable(entry: Entry, entries: Entry[]) {
  return entry.kind === 'task' && entry.status === 'active' && (entry.dependencies ?? []).every((id) =>
    entries.some((candidate) => candidate.id === id && candidate.kind === 'task' && candidate.status === 'done'));
}

export function executableTasks(entries: Entry[]) {
  const complete = new Set(entries.filter((entry) => entry.kind === 'task' && entry.status === 'done').map(({ id }) => id));
  return entries.filter((entry) => entry.kind === 'task' && entry.status === 'active' && (entry.dependencies ?? []).every((id) => complete.has(id)));
}

export function cyclicDependency(entries: Entry[], taskId: string, dependencyId: string) {
  const visited = new Set<string>();
  const stack = [dependencyId];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === taskId) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    stack.push(...(entries.find((entry) => entry.id === id)?.dependencies ?? []));
  }
  return false;
}

export type BlockProposal = Omit<TimeBlock, 'id'>;
export function suggestBlocks(data: AppData, day: string, ordered: Entry[], now = new Date()) {
  const capacity = dayCapacity(data, day);
  let budget = total(capacity.gaps) - capacity.margin;
  const minute = asLocalDate(now.toISOString()) === day ? now.getHours() * 60 + now.getMinutes() : 0;
  const gaps = capacity.gaps.filter((gap) => gap.end > minute).map((gap) => ({ ...gap, start: Math.max(gap.start, minute) }));
  const proposals: BlockProposal[] = [];
  if (!capacity.configured || data.days.some((plan) => plan.day === day && plan.rest)) return proposals;
  for (const task of ordered) {
    if (task.plannedOn && task.plannedOn > day) continue;
    if (!isExecutable(task, data.entries) || data.blocks.some((block) => block.entryId === task.id && block.day >= day)) continue;
    const gap = gaps.find((range) => range.end - range.start >= task.minutes);
    if (!gap || task.minutes > budget) continue;
    const start = gap.start;
    gap.start += task.minutes;
    budget -= task.minutes;
    proposals.push({ day, type: 'study', entryId: task.id, start, end: gap.start });
  }
  return proposals;
}

export function canApplyBlocks(data: AppData, proposals: BlockProposal[], requireAvailability = true) {
  let workspace = data;
  for (const proposal of proposals) {
    const capacity = dayCapacity(workspace, proposal.day);
    const task = proposal.entryId ? workspace.entries.find(({ id }) => id === proposal.entryId) : undefined;
    if (!Number.isInteger(proposal.start) || !Number.isInteger(proposal.end) || proposal.start < 0 || proposal.end > 1440 || proposal.start >= proposal.end ||
      capacity.fixed.some((event) => overlaps(event, proposal)) || capacity.blocks.some((block) => overlaps(block, proposal)) ||
      (requireAvailability && (workspace.days.some((plan) => plan.day === proposal.day && plan.rest) || !capacity.gaps.some((gap) => gap.start <= proposal.start && gap.end >= proposal.end) ||
        total(capacity.gaps) - duration(proposal) < capacity.margin ||
        (proposal.entryId && (!task || !isExecutable(task, workspace.entries) || task.minutes !== duration(proposal) ||
          workspace.blocks.some((block) => block.entryId === proposal.entryId && block.day >= proposal.day)))))) return false;
    if (proposal.entryId && !task) return false;
    workspace = { ...workspace, blocks: [...workspace.blocks, { ...proposal, id: 'proposal' }] };
  }
  return true;
}

export function rescheduleEntry(data: AppData, id: string, day: string): AppData {
  return { ...data, entries: data.entries.map((entry) => entry.id === id && entry.kind === 'task' && entry.status === 'active'
    ? { ...entry, plannedOn: day, postponeCount: entry.postponeCount + 1 } : entry) };
}

export function suggestWeek(data: AppData, firstDay: string, ordered: Entry[], now = new Date()) {
  const proposals: BlockProposal[] = [];
  let draft = data;
  for (let offset = 0; offset < 7; offset++) {
    const day = dayOffset(firstDay, offset);
    if (day < asLocalDate(now.toISOString())) continue;
    const candidates = ordered.filter((entry) => !proposals.some((block) => block.entryId === entry.id));
    const daily = suggestBlocks(draft, day, candidates, now);
    proposals.push(...daily);
    draft = { ...draft, blocks: [...draft.blocks, ...daily.map((block, index) => ({ ...block, id: 'preview-' + offset + '-' + index }))] };
  }
  return proposals;
}
