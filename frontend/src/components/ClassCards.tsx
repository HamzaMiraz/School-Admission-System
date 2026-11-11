import type { SchoolClass } from '../api';
import { useNow } from '../hooks/useNow';
import { parseClassName } from '../lib/classNames';
import { formatDeadline, isClassOpen } from '../lib/deadline';

interface Props {
  classes: SchoolClass[];
  onApply: (schoolClass: SchoolClass) => void;
  applyDisabledReason?: string;
  applyingClassId?: string;
}

/** Parents' view of the classes: one card per class and shift, with deadline, seat bar and an Apply button. */
export function ClassCards({ classes, onApply, applyDisabledReason, applyingClassId }: Props) {
  const now = useNow(1000);
  return (
    <div className="class-grid">
      {classes.map((c) => {
        const parsed = parseClassName(c.name);
        const closed = !isClassOpen(c, now);
        const full = c.availableSeats <= 0;
        const pct = (n: number) => `${c.totalSeats > 0 ? Math.min(100, (n / c.totalSeats) * 100) : 0}%`;
        const state = closed ? 'is-closed' : full ? 'is-full' : '';
        return (
          <article key={c.id} className={`class-card ${state}`} data-testid={`class-row-${c.id}`}>
            <header className="class-card-head">
              <h3 className="class-card-title">{parsed ? `Class ${parsed.grade}` : c.name}</h3>
              {parsed && (
                <span className={`chip chip-${parsed.shift.toLowerCase()}`}>
                  {parsed.shift.toLowerCase() === 'morning' ? '☀️' : '🌤️'} {parsed.shift} Shift
                </span>
              )}
            </header>

            <p className={`deadline ${closed ? 'deadline-closed' : ''}`} data-testid="deadline">
              <span aria-hidden>📅</span>
              {c.applicationDeadline
                ? `${closed ? 'Closed on' : 'Apply by'} ${formatDeadline(c.applicationDeadline)}`
                : 'No application deadline'}
            </p>

            <div
              className="seat-bar"
              role="img"
              aria-label={`${c.confirmedSeats} confirmed, ${c.heldSeats} on hold, ${c.availableSeats} free of ${c.totalSeats} seats`}
            >
              <span className="seat-bar-confirmed" style={{ width: pct(c.confirmedSeats) }} />
              <span className="seat-bar-held" style={{ width: pct(c.heldSeats) }} />
            </div>

            <dl className="seat-numbers">
              <div>
                <dt>Total</dt>
                <dd>{c.totalSeats}</dd>
              </div>
              <div>
                <dt>On hold</dt>
                <dd>{c.heldSeats}</dd>
              </div>
              <div>
                <dt>Confirmed</dt>
                <dd>{c.confirmedSeats}</dd>
              </div>
              <div className={full ? 'text-danger' : 'text-success'}>
                <dt>Free seats</dt>
                <dd>{c.availableSeats}</dd>
              </div>
            </dl>

            <footer className="class-card-foot">
              {closed ? (
                <span className="badge badge-expired">Applications closed</span>
              ) : full ? (
                <span className="badge badge-cancelled">Full — cannot apply</span>
              ) : (
                <span className="badge badge-confirmed">Available</span>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={closed || full || !!applyDisabledReason || applyingClassId !== undefined}
                title={
                  closed ? 'The application deadline has passed' : full ? 'No seats available right now' : applyDisabledReason
                }
                onClick={() => onApply(c)}
              >
                {applyingClassId === c.id ? 'Applying…' : closed ? 'Closed' : full ? 'Full' : 'Apply'}
              </button>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
