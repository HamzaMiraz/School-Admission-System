import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../api';
import { ClassTable } from '../components/ClassTable';
import { Alert, Loading, StaleDataWarning } from '../components/common';
import { CLASS_POLL_MS } from '../config';
import { usePolling } from '../hooks/usePolling';

const MAX_SEATS = 100000;

function validate(name: string, seats: string): string | null {
  if (!name.trim()) return 'Please enter a class name, e.g. "Class 6 - Morning Shift".';
  if (name.trim().length > 100) return 'Class name must be at most 100 characters.';
  if (!/^\d+$/.test(seats.trim())) return 'Total seats must be a whole number.';
  const n = Number(seats);
  if (n < 1 || n > MAX_SEATS) return `Total seats must be between 1 and ${MAX_SEATS}.`;
  return null;
}

export function AdminPage() {
  const classes = usePolling(api.listClasses, CLASS_POLL_MS, 'classes');
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string }>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validate(name, seats);
    if (problem) {
      setFeedback({ kind: 'error', text: problem });
      return;
    }
    setSaving(true);
    setFeedback(undefined);
    try {
      const created = await api.createClass(name.trim(), Number(seats));
      setFeedback({ kind: 'success', text: `Created "${created.name}" with ${created.totalSeats} seats.` });
      setName('');
      setSeats('');
      void classes.refresh();
    } catch (error) {
      setFeedback({ kind: 'error', text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h1>Create class (school admin)</h1>
      <p className="muted">
        Each shift is its own class with its own seats — e.g. "Class 6 - Morning Shift" and "Class 6 - Day Shift".
      </p>

      <form className="card form" onSubmit={submit} noValidate>
        <label htmlFor="class-name">Class name</label>
        <input
          id="class-name"
          className="input"
          placeholder="Class 6 - Morning Shift"
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label htmlFor="total-seats">Total seats</label>
        <input
          id="total-seats"
          className="input"
          inputMode="numeric"
          placeholder="120"
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
        />
        {feedback && <Alert kind={feedback.kind}>{feedback.text}</Alert>}
        <div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create class'}
          </button>
        </div>
      </form>

      <h2>Existing classes</h2>
      {classes.data ? (
        <>
          <StaleDataWarning error={classes.error} />
          {classes.data.length === 0 ? <p className="muted">No classes yet.</p> : <ClassTable classes={classes.data} />}
        </>
      ) : classes.error ? (
        <Alert kind="error">{errorMessage(classes.error)}</Alert>
      ) : (
        <Loading />
      )}
    </section>
  );
}
