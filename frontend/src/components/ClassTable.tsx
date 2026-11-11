import type { SchoolClass } from '../api';
import { useNow } from '../hooks/useNow';
import { compareClassNames } from '../lib/classNames';
import { formatDeadline, isClassOpen } from '../lib/deadline';

/** Admin view of the classes: seats and application deadline, sorted Class 1 → 10. */
export function ClassTable({ classes }: { classes: SchoolClass[] }) {
  const now = useNow(1000);
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Class</th>
            <th className="num">Total seats</th>
            <th className="num">On hold</th>
            <th className="num">Confirmed</th>
            <th className="num">Available</th>
            <th>Application deadline</th>
          </tr>
        </thead>
        <tbody>
          {[...classes]
            .sort((a, b) => compareClassNames(a.name, b.name))
            .map((c) => {
              const full = c.availableSeats <= 0;
              const open = isClassOpen(c, now);
              return (
                <tr key={c.id} data-testid={`class-row-${c.id}`}>
                  <td>{c.name}</td>
                  <td className="num">{c.totalSeats}</td>
                  <td className="num">{c.heldSeats}</td>
                  <td className="num">{c.confirmedSeats}</td>
                  <td className={`num ${full ? 'text-danger' : 'text-success'}`}>
                    <strong>{c.availableSeats}</strong>
                  </td>
                  <td>
                    {c.applicationDeadline ? formatDeadline(c.applicationDeadline) : <span className="muted">None</span>}{' '}
                    {open ? (
                      <span className="badge badge-confirmed">Open</span>
                    ) : (
                      <span className="badge badge-expired">Closed</span>
                    )}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
