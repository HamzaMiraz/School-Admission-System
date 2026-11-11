import type { SchoolClass } from '../api';

interface Props {
  classes: SchoolClass[];
  /** When given, each row gets an "Apply" button. */
  onApply?: (schoolClass: SchoolClass) => void;
  applyDisabledReason?: string;
  applyingClassId?: string;
}

export function ClassTable({ classes, onApply, applyDisabledReason, applyingClassId }: Props) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Class</th>
            <th className="num">মোট</th>
            <th className="num">hold-এ থাকা</th>
            <th className="num">নিশ্চিত</th>
            <th className="num">খালি seat</th>
            {onApply && <th>Availability</th>}
            {onApply && <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {classes.map((c) => {
            const full = c.availableSeats <= 0;
            return (
              <tr key={c.id} data-testid={`class-row-${c.id}`}>
                <td>{c.name}</td>
                <td className="num">{c.totalSeats}</td>
                <td className="num">{c.heldSeats}</td>
                <td className="num">{c.confirmedSeats}</td>
                <td className={`num ${full ? 'text-danger' : 'text-success'}`}>
                  <strong>{c.availableSeats}</strong>
                </td>
                {onApply && (
                  <td>
                    {full ? (
                      <span className="badge badge-cancelled">Full — cannot apply</span>
                    ) : (
                      <span className="badge badge-confirmed">Available</span>
                    )}
                  </td>
                )}
                {onApply && (
                  <td className="actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={full || !!applyDisabledReason || applyingClassId !== undefined}
                      title={full ? 'No seats available right now' : applyDisabledReason}
                      onClick={() => onApply(c)}
                    >
                      {applyingClassId === c.id ? 'আবেদন হচ্ছে…' : full ? 'Full' : 'আবেদন করুন'}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
