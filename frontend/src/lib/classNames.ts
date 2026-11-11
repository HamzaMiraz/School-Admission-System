/** The school admits Class 1 to Class 10. */
export const GRADES = Array.from({ length: 10 }, (_, i) => i + 1);

/** Each shift of a class is admitted separately, with its own seats. */
export const SHIFTS = ['Morning', 'Day'] as const;

/** Name stored for a class, e.g. "Class 6 - Morning Shift". */
export function buildClassName(grade: number, shift: string): string {
  return `Class ${grade} - ${shift} Shift`;
}

/** Splits "Class 6 - Morning Shift" into its class and shift; other names are returned whole. */
export function splitClassName(name: string): { grade: string; shift: string } {
  const match = /^(.+?)\s+-\s+(.+\s+Shift)$/i.exec(name.trim());
  return match ? { grade: match[1], shift: match[2] } : { grade: name, shift: '—' };
}
