import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { ClassTable } from '../components/ClassTable';
import { Alert, Loading, StaleDataWarning, Stat } from '../components/common';
import { CLASS_POLL_MS } from '../config';
import { usePolling } from '../hooks/usePolling';

/** Admin panel home: seat situation across all classes, updating live. */
export function AdminOverviewPage() {
  const classes = usePolling(api.listClasses, CLASS_POLL_MS, 'classes');

  return (
    <section>
      <h1>Overview</h1>
      <p className="muted">Seat status of every class and shift. Updates automatically.</p>

      {classes.data ? (
        <>
          <StaleDataWarning error={classes.error} />
          {classes.data.length === 0 ? (
            <Alert kind="info">
              No classes yet. <Link to="/admin/create">Create the first class</Link>.
            </Alert>
          ) : (
            <>
              <div className="stats">
                <Stat label="Classes" value={classes.data.length} />
                <Stat label="Total seats" value={sum(classes.data.map((c) => c.totalSeats))} />
                <Stat label="On hold" value={sum(classes.data.map((c) => c.heldSeats))} />
                <Stat label="Confirmed" value={sum(classes.data.map((c) => c.confirmedSeats))} />
                <Stat label="Available" value={sum(classes.data.map((c) => c.availableSeats))} />
              </div>
              <ClassTable classes={classes.data} />
            </>
          )}
        </>
      ) : classes.error ? (
        <Alert kind="error">{errorMessage(classes.error)}</Alert>
      ) : (
        <Loading />
      )}
    </section>
  );
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
