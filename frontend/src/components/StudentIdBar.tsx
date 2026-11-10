import { useState, type FormEvent } from 'react';
import { normalizeStudentId, validateStudentId } from '../lib/studentId';
import { useStudent } from '../student';

/** The box at the top of every page where the student's birth registration number is entered. */
export function StudentIdBar() {
  const { studentId, setStudentId } = useStudent();
  const [editing, setEditing] = useState(!studentId);
  const [draft, setDraft] = useState(studentId);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = normalizeStudentId(draft);
    const problem = validateStudentId(value);
    setError(problem);
    if (problem) return;
    setStudentId(value);
    setDraft(value);
    setEditing(false);
  };

  if (!editing && studentId) {
    return (
      <div className="student-bar">
        <span>
          Student (birth registration no.): <strong className="mono">{studentId}</strong>
        </span>
        <button type="button" className="btn btn-link" onClick={() => setEditing(true)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <form className="student-bar" onSubmit={submit} noValidate>
      <label htmlFor="student-id">Student's birth registration number (17 digits)</label>
      <div className="student-bar-row">
        <input
          id="student-id"
          className={`input mono ${error ? 'input-error' : ''}`}
          inputMode="numeric"
          autoComplete="off"
          placeholder="e.g. 20152691234567890"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'student-id-error' : undefined}
        />
        <button type="submit" className="btn btn-primary">
          Use this number
        </button>
        {studentId && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setDraft(studentId);
              setError(null);
              setEditing(false);
            }}
          >
            Keep {studentId}
          </button>
        )}
      </div>
      {error && (
        <p id="student-id-error" className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
