import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../api';
import { Alert, Loading, StaleDataWarning, StatusBadge } from '../components/common';
import { HOLD_POLL_MS } from '../config';
import { useNow } from '../hooks/useNow';
import { usePolling } from '../hooks/usePolling';
import { displayStatus, formatDateTime, formatDuration, holdDeadline } from '../lib/time';
import { useStudent } from '../student';

type Feedback = { kind: 'success' | 'error'; text: string };

export function ApplicationPage() {
  const { holdId = '' } = useParams();
  const { studentId } = useStudent();
  const hold = usePolling(() => api.getHold(holdId), HOLD_POLL_MS, `hold:${holdId}`);
  // The ticking clock can lag behind a response that just arrived; never look at the hold "before" it came in.
  const now = Math.max(useNow(), hold.receivedAt);
  const [busy, setBusy] = useState<'pay' | 'cancel'>();
  const [feedback, setFeedback] = useState<Feedback>();
  const [askingToCancel, setAskingToCancel] = useState(false);

  const data = hold.data;
  const deadline = data ? holdDeadline(data, hold.receivedAt) : 0;
  const status = data ? displayStatus(data, deadline, now) : undefined;
  const expiredJustNow = data?.status === 'HELD' && status === 'EXPIRED';

  // The countdown hit zero: ask the server for the official status right away.
  const { refresh } = hold;
  useEffect(() => {
    if (expiredJustNow) void refresh();
  }, [expiredJustNow, refresh]);

  if (!data) {
    if (hold.error instanceof ApiError && hold.error.status === 404) {
      return (
        <section>
          <h1>Application</h1>
          <Alert kind="error">This application could not be found.</Alert>
          <Link to="/applications">Go to my applications</Link>
        </section>
      );
    }
    return (
      <section>
        <h1>Application</h1>
        {hold.error ? <Alert kind="error">{errorMessage(hold.error)}</Alert> : <Loading />}
      </section>
    );
  }

  const ownedByOther = !!data.studentId && !!studentId && data.studentId !== studentId;
  const isHeld = status === 'HELD';
  const actionBlocked = !studentId || ownedByOther || busy !== undefined;

  const run = async (action: 'pay' | 'cancel') => {
    setBusy(action);
    setFeedback(undefined);
    setAskingToCancel(false);
    try {
      if (action === 'pay') {
        await api.payFee(data.holdId, studentId);
        setFeedback({ kind: 'success', text: 'Payment received. Admission is confirmed!' });
      } else {
        await api.cancelHold(data.holdId, studentId);
        setFeedback({ kind: 'success', text: 'Application cancelled. The seat has been released.' });
      }
    } catch (error) {
      setFeedback({ kind: 'error', text: errorMessage(error) });
    } finally {
      setBusy(undefined);
      void hold.refresh();
    }
  };

  return (
    <section>
      <p>
        <Link to="/applications">← My applications</Link>
      </p>
      <h1>{data.className ?? 'Application'}</h1>
      <StaleDataWarning error={hold.error} />
      {feedback && <Alert kind={feedback.kind}>{feedback.text}</Alert>}

      <div className="card">
        <dl className="details">
          <dt>Status</dt>
          <dd>
            <StatusBadge status={status!} />
          </dd>
          {isHeld && (
            <>
              <dt>Time left to pay</dt>
              <dd>
                <span className="countdown mono" data-testid="countdown">
                  {formatDuration(deadline - now)}
                </span>
              </dd>
            </>
          )}
          <dt>{status === 'HELD' || status === 'EXPIRED' ? 'Hold expires at' : 'Hold was valid until'}</dt>
          <dd>{formatDateTime(data.expiresAt)}</dd>
          {data.studentId && (
            <>
              <dt>Student</dt>
              <dd className="mono">{data.studentId}</dd>
            </>
          )}
          <dt>Application ID</dt>
          <dd className="mono small">{data.holdId}</dd>
        </dl>

        {status === 'EXPIRED' && (
          <Alert kind="warning">
            The time to pay ran out and the seat was released. You can <Link to="/">apply again</Link> if seats are
            still available.
          </Alert>
        )}
        {status === 'CONFIRMED' && <Alert kind="success">Admission confirmed. The admission fee has been paid.</Alert>}
        {status === 'CANCELLED' && <Alert kind="info">This application was cancelled.</Alert>}
        {!studentId && isHeld && (
          <Alert kind="info">Sign in with the birth registration number to pay or cancel.</Alert>
        )}
        {ownedByOther && (
          <Alert kind="warning">
            This application belongs to a different student. Sign in as that student to act on it.
          </Alert>
        )}

        <div className="button-row">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={!isHeld || actionBlocked}
            onClick={() => void run('pay')}
          >
            {busy === 'pay' ? 'Paying…' : 'Pay admission fee'}
          </button>

          {askingToCancel ? (
            <span className="confirm-inline">
              Cancel this application and release the seat?
              <button type="button" className="btn btn-danger" disabled={actionBlocked} onClick={() => void run('cancel')}>
                Yes, cancel
              </button>
              <button type="button" className="btn" onClick={() => setAskingToCancel(false)}>
                No, keep it
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="btn btn-danger-outline"
              disabled={!isHeld || actionBlocked}
              onClick={() => setAskingToCancel(true)}
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel application'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
