import { useState } from 'react';
import { api, errorMessage, type AdminHoldFilters, type HoldStatus } from '../api';
import { Alert, Loading, StaleDataWarning, StatusBadge, Stat } from '../components/common';
import { HOLD_POLL_MS } from '../config';
import { useNow } from '../hooks/useNow';
import { usePolling } from '../hooks/usePolling';
import { splitClassName } from '../lib/classNames';
import { formatDeadline } from '../lib/deadline';
import { displayStatus, formatDuration, holdDeadline } from '../lib/time';

const STATUS_OPTIONS: { value: HoldStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'HELD', label: 'Waiting for payment' },
  { value: 'CONFIRMED', label: 'Paid & confirmed' },
  { value: 'EXPIRED', label: 'Expired (not paid in time)' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/** Admin: who applied for which class and shift, and whether they paid. */
export function AdminApplicationsPage() {
  const [filters, setFilters] = useState<AdminHoldFilters>({ status: '', classId: '', studentId: '' });
  const classes = usePolling(api.listClasses, HOLD_POLL_MS, 'classes');
  const holds = usePolling(() => api.adminHolds(filters), HOLD_POLL_MS, `admin-holds:${JSON.stringify(filters)}`);
  const now = Math.max(useNow(), holds.receivedAt);

  const rows = (holds.data ?? []).map((hold) => {
    const deadline = holdDeadline(hold, holds.receivedAt);
    return { hold, deadline, status: displayStatus(hold, deadline, now) };
  });
  const count = (status: HoldStatus) => rows.filter((r) => r.status === status).length;

  return (
    <section>
      <h1>Applications</h1>
      <p className="muted">Every application: student, class, shift, and whether the fee was paid. Updates automatically.</p>

      <div className="card filters">
        <div>
          <label htmlFor="filter-status">Status</label>
          <select
            id="filter-status"
            className="input"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as HoldStatus | '' })}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-class">Class &amp; shift</label>
          <select
            id="filter-class"
            className="input"
            value={filters.classId}
            onChange={(e) => setFilters({ ...filters, classId: e.target.value })}
          >
            <option value="">All classes</option>
            {(classes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-student">Birth registration no.</label>
          <input
            id="filter-student"
            className="input mono"
            inputMode="numeric"
            placeholder="Search…"
            value={filters.studentId}
            onChange={(e) => setFilters({ ...filters, studentId: e.target.value.replace(/\D/g, '') })}
          />
        </div>
      </div>

      {holds.data ? (
        <>
          <StaleDataWarning error={holds.error} />
          <div className="stats">
            <Stat label="Applications" value={rows.length} />
            <Stat label="Waiting for payment" value={count('HELD')} />
            <Stat label="Paid & confirmed" value={count('CONFIRMED')} />
            <Stat label="Expired" value={count('EXPIRED')} />
            <Stat label="Cancelled" value={count('CANCELLED')} />
          </div>

          {rows.length === 0 ? (
            <Alert kind="info">No applications match these filters.</Alert>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Birth registration no.</th>
                    <th>Class</th>
                    <th>Shift</th>
                    <th>Applied at</th>
                    <th>Status</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ hold, deadline, status }) => {
                    const { grade, shift } = splitClassName(hold.className ?? hold.classId);
                    return (
                      <tr key={hold.holdId} data-testid={`application-${hold.holdId}`}>
                        <td className="mono">{hold.studentId}</td>
                        <td>{grade}</td>
                        <td>{shift}</td>
                        <td>{hold.createdAt ? formatDeadline(hold.createdAt) : '—'}</td>
                        <td>
                          <StatusBadge status={status} />
                        </td>
                        <td>
                          {status === 'CONFIRMED' ? (
                            <>
                              <span className="text-success">✔ Paid</span>
                              {hold.confirmedAt && (
                                <div className="muted small">{formatDeadline(hold.confirmedAt)}</div>
                              )}
                            </>
                          ) : status === 'HELD' ? (
                            <span>Not paid yet · {formatDuration(deadline - now)} left</span>
                          ) : (
                            <span className="muted">Not paid</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : holds.error ? (
        <Alert kind="error">{errorMessage(holds.error)}</Alert>
      ) : (
        <Loading label="Loading applications…" />
      )}
    </section>
  );
}
