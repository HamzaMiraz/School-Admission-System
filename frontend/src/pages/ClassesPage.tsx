import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError, errorMessage, type Hold, type SchoolClass } from '../api';
import { ClassCards } from '../components/ClassCards';
import { Alert, Loading, StaleDataWarning } from '../components/common';
import { CLASS_POLL_MS, HOLD_POLL_MS } from '../config';
import { useNow } from '../hooks/useNow';
import { usePolling } from '../hooks/usePolling';
import { compareClassNames, GRADES, parseClassName, SHIFTS } from '../lib/classNames';
import { displayStatus, holdDeadline } from '../lib/time';
import { useStudent } from '../student';

interface ActionError {
  message: string;
  existingHoldId?: string;
}

export function ClassesPage() {
  const { studentId } = useStudent();
  const navigate = useNavigate();
  const classes = usePolling(api.listClasses, CLASS_POLL_MS, 'classes');
  const myHolds = usePolling(
    () => (studentId ? api.myHolds(studentId) : Promise.resolve([] as Hold[])),
    HOLD_POLL_MS,
    `me:${studentId}`,
  );
  const now = Math.max(useNow(1000), myHolds.receivedAt);
  // A student can apply for only one class: an unpaid-but-running or paid application blocks the rest.
  const activeHold = (myHolds.data ?? []).find((h) => {
    const status = displayStatus(h, holdDeadline(h, myHolds.receivedAt), now);
    return status === 'HELD' || status === 'CONFIRMED';
  });
  const activeStatus = activeHold && displayStatus(activeHold, holdDeadline(activeHold, myHolds.receivedAt), now);
  const [applyingClassId, setApplyingClassId] = useState<string>();
  const [actionError, setActionError] = useState<ActionError>();
  const [gradeFilter, setGradeFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const filtering = gradeFilter !== '' || shiftFilter !== '' || onlyAvailable;

  const visible = (classes.data ?? [])
    .filter((c) => {
      const parsed = parseClassName(c.name);
      if (gradeFilter && parsed?.grade !== Number(gradeFilter)) return false;
      if (shiftFilter && parsed?.shift.toLowerCase() !== shiftFilter.toLowerCase()) return false;
      if (onlyAvailable && c.availableSeats <= 0) return false;
      return true;
    })
    .sort((a, b) => compareClassNames(a.name, b.name));

  const apply = async (schoolClass: SchoolClass) => {
    setActionError(undefined);
    setApplyingClassId(schoolClass.id);
    try {
      const hold = await api.applyForSeat(schoolClass.id, studentId);
      navigate(`/applications/${hold.holdId}`);
    } catch (error) {
      const holdId = error instanceof ApiError ? error.details?.holdId : undefined;
      setActionError({
        message: errorMessage(error),
        existingHoldId: typeof holdId === 'string' ? holdId : undefined,
      });
      void classes.refresh();
      void myHolds.refresh();
    } finally {
      setApplyingClassId(undefined);
    }
  };

  return (
    <section>
      <h1>Class তালিকা</h1>
      <p className="muted">
        Seats are given first come, first served. Applying holds a seat for a limited time; pay the admission fee
        before the time runs out to confirm admission. Counts update automatically.
      </p>

      {!studentId && (
        <Alert kind="info">Sign in with the student's birth registration number to apply.</Alert>
      )}
      {activeHold && (
        <Alert kind={activeStatus === 'CONFIRMED' ? 'success' : 'info'}>
          {activeStatus === 'CONFIRMED'
            ? `Admission confirmed for ${activeHold.className ?? 'a class'}. A student can be admitted to only one class.`
            : `You have already applied for ${activeHold.className ?? 'a class'}. A student can apply for only one class — pay the fee to confirm it, or cancel it to choose another class.`}{' '}
          <Link to={`/applications/${activeHold.holdId}`}>View application</Link>
        </Alert>
      )}
      {actionError && (
        <Alert kind="error">
          {actionError.message}{' '}
          {actionError.existingHoldId && (
            <Link to={`/applications/${actionError.existingHoldId}`}>View that application</Link>
          )}
        </Alert>
      )}

      {classes.data ? (
        <>
          <StaleDataWarning error={classes.error} />
          {classes.data.length === 0 ? (
            <Alert kind="info">No classes are open for admission yet. Please check back later.</Alert>
          ) : (
            <>
              <div className="card filters">
                <div>
                  <label htmlFor="filter-grade">Class</label>
                  <select
                    id="filter-grade"
                    className="input"
                    value={gradeFilter}
                    onChange={(e) => setGradeFilter(e.target.value)}
                  >
                    <option value="">All classes</option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        Class {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="filter-shift">Shift</label>
                  <select
                    id="filter-shift"
                    className="input"
                    value={shiftFilter}
                    onChange={(e) => setShiftFilter(e.target.value)}
                  >
                    <option value="">All shifts</option>
                    {SHIFTS.map((s) => (
                      <option key={s} value={s}>
                        {s} Shift
                      </option>
                    ))}
                  </select>
                </div>
                <label className="checkbox">
                  <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
                  Only show classes with free seats
                </label>
              </div>

              {visible.length === 0 ? (
                <Alert kind="info">
                  No class matches your search
                  {onlyAvailable ? ' with free seats right now' : ''}.{' '}
                  {filtering && (
                    <button
                      type="button"
                      className="btn btn-link"
                      onClick={() => {
                        setGradeFilter('');
                        setShiftFilter('');
                        setOnlyAvailable(false);
                      }}
                    >
                      Show all classes
                    </button>
                  )}
                </Alert>
              ) : (
                <ClassCards
                  classes={visible}
                  onApply={apply}
                  applyDisabledReason={
                    !studentId
                      ? 'Sign in first'
                      : activeHold
                        ? 'A student can apply for only one class'
                        : undefined
                  }
                  applyingClassId={applyingClassId}
                />
              )}
            </>
          )}
        </>
      ) : classes.error ? (
        <Alert kind="error">
          {errorMessage(classes.error)}{' '}
          <button type="button" className="btn btn-link" onClick={() => void classes.refresh()}>
            Try again
          </button>
        </Alert>
      ) : (
        <Loading label="Loading classes…" />
      )}
    </section>
  );
}
