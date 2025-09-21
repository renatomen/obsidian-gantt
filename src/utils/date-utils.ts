// Date utilities (UTC anchor, YYYY-MM-DD formatting)
// Kept framework-agnostic and pure for easy testing

export const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
export const createUTCDate = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

export function parseInputToUTCDate(v: unknown): Date | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v;
  if (typeof v === 'number' && isFinite(v)) { const d = new Date(v); return isNaN(d.getTime()) ? undefined : d; }
  if (typeof v === 'string') {
    const s = v.trim(); if (!s) return undefined;
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return createUTCDate(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/); if (m) return createUTCDate(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return createUTCDate(+m[3], +m[1], +m[2]);
    if (/[TtZz]|[+-]\d{2}:?\d{2}$/.test(s)) { const d = new Date(s); return isNaN(d.getTime()) ? undefined : d; }
    const d = new Date(s); return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

export const formatDateUTCToYMD = (d: Date): string => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
export const addDaysUTC = (d: Date, days: number): Date => { const c = new Date(d.getTime()); c.setUTCDate(c.getUTCDate() + days); return c; };

