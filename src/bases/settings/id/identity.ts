export function generateStableId(prefix = 'gantt-'): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}${ts}-${rnd}`;
}

export function ensureQueryId(q: Record<string, unknown>, gen = generateStableId): string {
  const cur = q['id'];
  if (typeof cur === 'string' && cur.length > 0) return cur;
  const id = gen();
  q['id'] = id;
  return id;
}

