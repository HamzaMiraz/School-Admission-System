import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { normalizeStudentId, validateStudentId } from '../lib/studentId';
import { useStudent } from '../student';

/**
 * Sign in with the student's birth registration number. There is no password: the brief
 * identifies a student by this number only (sent as X-Student-Id).
 */
export function LoginPage() {
  const { studentId, setStudentId } = useStudent();
  const navigate = useNavigate();
  const location = useLocation();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/';

  if (studentId) return <Navigate to={returnTo} replace />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = normalizeStudentId(draft);
    const problem = validateStudentId(value);
    setError(problem);
    if (problem) return;
    setStudentId(value);
    navigate(returnTo, { replace: true });
  };

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={submit} noValidate>
        <div className="login-logo" aria-hidden>
          🏫
        </div>
        <h1>School Admission</h1>
        <p className="muted">Sign in with the student's birth registration number to apply and follow applications.</p>

        <label htmlFor="student-id">Birth registration number (17 digits)</label>
        <input
          id="student-id"
          className={`input mono ${error ? 'input-error' : ''}`}
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          placeholder="e.g. 20152691234567890"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'student-id-error' : undefined}
        />
        {error && (
          <p id="student-id-error" className="field-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-lg">
          Sign in
        </button>
        <p className="muted small login-footer">
          School staff? <Link to="/admin">Open the admin panel</Link>
        </p>
      </form>
    </div>
  );
}
