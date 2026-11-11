import type { SchoolClass } from '../api';
import { parseClassName } from '../lib/classNames';

interface Props {
  classes: SchoolClass[];
  onApply: (schoolClass: SchoolClass) => void;
  applyDisabledReason?: string;
  applyingClassId?: string;
}

/** Parents' view of the classes: one card per class and shift, with a seat bar and an Apply button. */
export function ClassCards({ classes, onApply, applyDisabledReason, applyingClassId }: Props) {
  return (
    <div className="class-grid">
      {classes.map((c) => {
        const parsed = parseClassName(c.name);
        const full = c.availableSeats <= 0;
        const pct = (n: number) => `${c.totalSeats > 0 ? Math.min(100, (n / c.totalSeats) * 100) : 0}%`;
        return (
          <article key={c.id} className={`class-card ${full ? 'is-full' : ''}`} data-testid={`class-row-${c.id}`}>
            <header className="class-card-head">
              <h3 className="class-card-title">{parsed ? `Class ${parsed.grade}` : c.name}</h3>
              {parsed && (
                <span className={`chip chip-${parsed.shift.toLowerCase()}`}>
                  {parsed.shift.toLowerCase() === 'morning' ? '☀️' : '🌤️'} {parsed.shift} Shift
                </span>
              )}
            </header>

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
              {full ? (
                <span className="badge badge-cancelled">Full — cannot apply</span>
              ) : (
                <span className="badge badge-confirmed">Available</span>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={full || !!applyDisabledReason || applyingClassId !== undefined}
                title={full ? 'No seats available right now' : applyDisabledReason}
                onClick={() => onApply(c)}
              >
                {applyingClassId === c.id ? 'Applying…' : full ? 'Full' : 'Apply'}
              </button>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
