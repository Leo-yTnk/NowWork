export type RibbonOrder = [string[], string[]];
export type RibbonPosition = { row: 0 | 1; index: number };

export function validateRibbonOrder(value: unknown): RibbonOrder | undefined {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Array.isArray)) return undefined;
  const seen = new Set<string>();
  return [0, 1].map((row) => value[row].slice(0, 100).filter((id: unknown) => {
    if (typeof id !== 'string' || !id || id.length > 100 || seen.has(id)) return false;
    seen.add(id);
    return true;
  })) as RibbonOrder;
}

export function resolveRibbonOrder(defaults: RibbonOrder, saved?: RibbonOrder): RibbonOrder {
  if (!saved) return defaults;
  const available = new Set(defaults.flat());
  const rows: RibbonOrder = [
    saved[0].filter((id) => available.delete(id)),
    saved[1].filter((id) => available.delete(id)),
  ];
  defaults[0].forEach((id) => { if (available.has(id)) rows[0].push(id); });
  defaults[1].forEach((id) => { if (available.has(id)) rows[1].push(id); });
  return rows;
}

export function moveRibbonItem(order: RibbonOrder, id: string, to: RibbonPosition): RibbonOrder {
  const fromRow = order[0].includes(id) ? 0 : 1;
  if (!order[fromRow].includes(id)) return order;
  const next: RibbonOrder = [[...order[0]], [...order[1]]];
  next[fromRow].splice(next[fromRow].indexOf(id), 1);
  next[to.row].splice(to.index, 0, id);
  return next;
}
