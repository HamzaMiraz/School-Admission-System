import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError, errorMessage, type SchoolClass } from '../api';
import { ClassTable } from '../components/ClassTable';
import { Alert, Loading, StaleDataWarning } from '../components/common';
import { CLASS_POLL_MS } from '../config';
import { usePolling } from '../hooks/usePolling';
import { useStudent } from '../student';

interface ActionError {
  message: string;
  existingHoldId?: string;
}

export function ClassesPage() {
  const { studentId } = useStudent();
  const navigate = useNavigate();
  const classes = usePolling(api.listClasses, CLASS_POLL_MS, 'classes');
  const [applyingClassId, setApplyingClassId] = useState<string>();
  const [actionError, setActionError] = useState<ActionError>();

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
    } finally {
      setApplyingClassId(undefined);
    }
  };

  return (
    <section>
      <h1>Classes</h1>
      <p className="muted">
        Seats are given first come, first served. Applying holds a seat for a limited time; pay the admission fee
        before the time runs out to confirm admission. Counts update automatically.
      </p>

      {!studentId && (
        <Alert kind="info">Sign in with the student's birth registration number to apply.</Alert>
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
            <ClassTable
              classes={classes.data}
              onApply={apply}
              applyDisabledReason={studentId ? undefined : 'Enter the birth registration number first'}
              applyingClassId={applyingClassId}
            />
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
