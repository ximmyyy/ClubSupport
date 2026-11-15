/** Date helpers. Dates are local "YYYY-MM-DD" strings; times are minutes since midnight. */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** 1 = maandag … 7 = zondag */
export function weekdayOf(iso: string): number {
  const js = parseISODate(iso).getDay();
  return js === 0 ? 7 : js;
}

export function startOfWeek(iso: string): string {
  return addDays(iso, 1 - weekdayOf(iso));
}

/** Next date (including today) that falls on the given weekday. */
export function nextWeekday(iso: string, weekday: number): string {
  const diff = (weekday - weekdayOf(iso) + 7) % 7;
  return addDays(iso, diff);
}

export const WEEKDAYS = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
export const WEEKDAYS_SHORT = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const MONTHS_LONG = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

export function formatDate(iso: string, opts: { long?: boolean; weekday?: boolean } = {}): string {
  const d = parseISODate(iso);
  const wd = WEEKDAYS[weekdayOf(iso) - 1];
  const month = opts.long ? MONTHS_LONG[d.getMonth()] : MONTHS[d.getMonth()];
  const base = `${d.getDate()} ${month}`;
  return opts.weekday === false ? base : `${opts.long ? wd : wd.slice(0, 2)} ${base}`;
}

/** Capitalise the first letter only (Dutch month names stay lower case). */
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseTime(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
