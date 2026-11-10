import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { Alert, Loading, StaleDataWarning, StatusBadge } from '../components/common';
import { HOLD_POLL_MS } from '../config';
import { useNow } from '../hooks/useNow';
import { usePolling } from '../hooks/usePolling';
import { displayStatus, formatDateTime, formatDuration, holdDeadline } from '../lib/time';
import { useStudent } from '../student';

export function MyApplicationsPage() {
  const { studentId } = useStudent();
  return (
    <section>
      <h1>My applications</h1>
      {studentId ? (
        <ApplicationsList studentId={studentId} />
      ) : (
        <Alert kind="info">Enter the student's 17-digit birth registration number at the top to see applications.</Alert>
      )}
    </section>
  );
}

function ApplicationsList({ studentId }: { studentId: string }) {
  const holds = usePolling(() => api.myHolds(studentId), HOLD_POLL_MS, `me:${studentId}`);
  // The ticking clock can lag behind a response that just arrived; never look at holds "before" they came in.
  const now = Math.max(useNow(), holds.receivedAt);

  if (!holds.data) {
    return holds.error ? <Alert kind="error">{errorMessage(holds.error)}</Alert> : <Loading />;
  }
  if (holds.data.length === 0) {
    return (
      <Alert kind="info">
        No applications yet for this student. <Link to="/">Choose a class</Link> to apply.
      </Alert>
    );
  }

  return (
    <>
      <StaleDataWarning error={holds.error} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Status</th>
              <th>Time left</th>
              <th>Expires at</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {holds.data.map((hold) => {
              const deadline = holdDeadline(hold, holds.receivedAt);
              const status = displayStatus(hold, deadline, now);
              return (
                <tr key={hold.holdId}>
                  <td>{hold.className ?? hold.classId}</td>
                  <td>
                    <StatusBadge status={status} />
                  </td>
                  <td className="mono">{status === 'HELD' ? formatDuration(deadline - now) : '—'}</td>
                  <td>{formatDateTime(hold.expiresAt)}</td>
                  <td className="actions">
                    <Link className="btn" to={`/applications/${hold.holdId}`}>
                      {status === 'HELD' ? 'Pay / cancel' : 'Details'}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
