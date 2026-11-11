import type { ReactNode } from 'react';
import type { HoldStatus } from '../api';
import { ApiError, errorMessage } from '../api';

export function Alert({ kind, children }: { kind: 'error' | 'success' | 'info' | 'warning'; children: ReactNode }) {
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

const STATUS_LABELS: Record<HoldStatus, string> = {
  HELD: 'Seat held — fee due',
  CONFIRMED: 'Admission confirmed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

export function StatusBadge({ status }: { status: HoldStatus }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`} data-status={status}>
      {status} · {STATUS_LABELS[status]}
    </span>
  );
}

/** Shown when a background refresh fails but we still have (possibly stale) data on screen. */
export function StaleDataWarning({ error }: { error: unknown }) {
  if (!error) return null;
  const offline = error instanceof ApiError && error.code === 'NETWORK_ERROR';
  return (
    <Alert kind="warning">
      {offline ? 'Live updates paused: cannot reach the server. Retrying automatically…' : errorMessage(error)}
    </Alert>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="muted" role="status">
      {label}
    </p>
  );
}

/** A number with a label, used on the admin dashboards. */
export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat" data-testid={`stat-${label}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
