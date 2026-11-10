import type { Hold, HoldStatus } from '../api';

/**
 * When the hold runs out, in browser-clock milliseconds. Uses the server's
 * remainingSeconds (measured from when the response arrived) so a wrong PC clock
 * doesn't matter; falls back to expiresAt.
 */
export function holdDeadline(hold: Hold, receivedAt: number): number {
  if (typeof hold.remainingSeconds === 'number') return receivedAt + hold.remainingSeconds * 1000;
  return Date.parse(hold.expiresAt);
}

/** A HELD hold whose time is up is shown as EXPIRED immediately, without waiting for the server. */
export function displayStatus(hold: Hold, deadline: number, now: number): HoldStatus {
  return hold.status === 'HELD' && now >= deadline ? 'EXPIRED' : hold.status;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}
