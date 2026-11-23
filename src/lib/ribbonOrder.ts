export type RibbonOrder = Record<string, string[]>;

export function validateRibbonOrder(value: unknown): RibbonOrder | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const clean = (ids: unknown[]) => [...new Set(ids.slice(0, 100)
    .filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100))];

  if (Array.isArray(value)) {
    if (value.length !== 2 || !value.every(Array.isArray)) return undefined;
    return { legacy: clean(value.flat()) };
  }

  return Object.fromEntries(Object.entries(value).slice(0, 20)
    .filter(([lane, ids]) => /^[a-z-]+$/.test(lane) && Array.isArray(ids))
    .map(([lane, ids]) => [lane, clean(ids)]));
}

export function resolveRibbonLane(defaults: string[], saved?: string[]): string[] {
  if (!saved) return defaults;
  const available = new Set(defaults);
  return [...saved.filter((id) => available.delete(id)), ...available];
}

export function moveRibbonItem(order: string[], id: string, position: number): string[] {
  const from = order.indexOf(id);
  if (from < 0 || from === position) return order;
  const next = [...order];
  next.splice(from, 1);
  next.splice(position, 0, id);
  return next;
}
