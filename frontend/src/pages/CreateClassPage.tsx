import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../api';
import { ClassTable } from '../components/ClassTable';
import { Alert, Loading, StaleDataWarning } from '../components/common';
import { CLASS_POLL_MS } from '../config';
import { usePolling } from '../hooks/usePolling';

const MAX_SEATS = 100000;

/** The school admits Class 1 to Class 10. */
export const GRADES = Array.from({ length: 10 }, (_, i) => i + 1);

/** Each shift of a class is admitted separately, with its own seats. */
export const SHIFTS = ['Morning', 'Day'] as const;

/** Name sent to the API, e.g. "Class 6 - Morning Shift". */
export function className(grade: number, shift: string): string {
  return `Class ${grade} - ${shift} Shift`;
}

function validate(grade: string, shift: string, seats: string): string | null {
  if (!grade) return 'Please choose a class (1 to 10).';
  if (!shift) return 'Please choose a shift.';
  if (!/^\d+$/.test(seats.trim())) return 'Total seats must be a whole number.';
  const n = Number(seats);
  if (n < 1 || n > MAX_SEATS) return `Total seats must be between 1 and ${MAX_SEATS}.`;
  return null;
}

export function CreateClassPage() {
  const classes = usePolling(api.listClasses, CLASS_POLL_MS, 'classes');
  const [grade, setGrade] = useState('');
  const [shift, setShift] = useState('');
  const [seats, setSeats] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string }>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validate(grade, shift, seats);
    if (problem) {
      setFeedback({ kind: 'error', text: problem });
      return;
    }
    setSaving(true);
    setFeedback(undefined);
    try {
      const created = await api.createClass(className(Number(grade), shift), Number(seats));
      setFeedback({ kind: 'success', text: `Created "${created.name}" with ${created.totalSeats} seats.` });
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
      <h1>Create class</h1>
      <p className="muted">
        Choose the class and the shift. Each shift is admitted separately with its own seats — e.g. "Class 6 - Morning
        Shift" and "Class 6 - Day Shift".
      </p>

      <form className="card form" onSubmit={submit} noValidate>
        <label htmlFor="class-grade">Class</label>
        <select id="class-grade" className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">Choose a class…</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              Class {g}
            </option>
          ))}
        </select>

        <label htmlFor="class-shift">Shift</label>
        <select id="class-shift" className="input" value={shift} onChange={(e) => setShift(e.target.value)}>
          <option value="">Choose a shift…</option>
          {SHIFTS.map((s) => (
            <option key={s} value={s}>
              {s} Shift
            </option>
          ))}
        </select>

        <label htmlFor="total-seats">Total seats</label>
        <input
          id="total-seats"
          className="input"
          inputMode="numeric"
          placeholder="120"
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
        />

        {grade && shift && (
          <p className="muted">
            Will be created as: <strong>{className(Number(grade), shift)}</strong>
          </p>
        )}
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
