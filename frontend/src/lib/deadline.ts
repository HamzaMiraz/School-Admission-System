import type { SchoolClass } from '../api';

/** Open for new applications: the server says so and, as far as this browser can tell, the deadline hasn't passed. */
export function isClassOpen(schoolClass: SchoolClass, now: number): boolean {
  if (schoolClass.isOpen === false) return false;
  return !schoolClass.applicationDeadline || Date.parse(schoolClass.applicationDeadline) > now;
}

/** e.g. "30 Nov 2026, 11:59 PM" in the viewer's time zone. */
export function formatDeadline(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Value for <input type="datetime-local"> at local time `ms` (YYYY-MM-DDTHH:mm). */
export function toDateTimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
