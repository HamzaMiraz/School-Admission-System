/** The school admits Class 1 to Class 10. */
export const GRADES = Array.from({ length: 10 }, (_, i) => i + 1);

/** Each shift of a class is admitted separately, with its own seats. */
export const SHIFTS = ['Morning', 'Day'] as const;

/** Name stored for a class, e.g. "Class 6 - Morning Shift". */
export function buildClassName(grade: number, shift: string): string {
  return `Class ${grade} - ${shift} Shift`;
}

/** Reads class number and shift from "Class 6 - Morning Shift"; undefined for other names. */
export function parseClassName(name: string): { grade: number; shift: string } | undefined {
  const match = /^Class\s+(\d+)\s+-\s+(\w+)\s+Shift$/i.exec(name.trim());
  return match ? { grade: Number(match[1]), shift: match[2] } : undefined;
}

/** Orders classes Class 1 → Class 10, Morning before Day; any other names go last, alphabetically. */
export function compareClassNames(a: string, b: string): number {
  const pa = parseClassName(a);
  const pb = parseClassName(b);
  if (pa && pb) {
    const shiftOrder = (s: string) => {
      const i = SHIFTS.findIndex((x) => x.toLowerCase() === s.toLowerCase());
      return i < 0 ? SHIFTS.length : i;
    };
    return pa.grade - pb.grade || shiftOrder(pa.shift) - shiftOrder(pb.shift);
  }
  if (pa) return -1;
  if (pb) return 1;
  return a.localeCompare(b);
}

/** Splits "Class 6 - Morning Shift" into its class and shift; other names are returned whole. */
export function splitClassName(name: string): { grade: string; shift: string } {
  const match = /^(.+?)\s+-\s+(.+\s+Shift)$/i.exec(name.trim());
  return match ? { grade: match[1], shift: match[2] } : { grade: name, shift: '—' };
}
