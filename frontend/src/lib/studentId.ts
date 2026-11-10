const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';
const STORAGE_KEY = 'school-admission.studentId';

/** Accepts Bangla digits and ignores spaces/dashes people often type. */
export function normalizeStudentId(input: string): string {
  return Array.from(input.trim())
    .map((ch) => {
      const index = BANGLA_DIGITS.indexOf(ch);
      return index >= 0 ? String(index) : ch;
    })
    .join('')
    .replace(/[\s-]/g, '');
}

/** Returns an error message, or null when the value is a valid 17-digit birth registration number. */
export function validateStudentId(value: string): string | null {
  if (!value) return 'Please enter the birth registration number.';
  if (!/^\d+$/.test(value)) return 'Birth registration number can contain digits only.';
  if (value.length !== 17) return `Birth registration number must be 17 digits (you entered ${value.length}).`;
  return null;
}

export function loadStudentId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) ?? '';
    return validateStudentId(saved) === null ? saved : '';
  } catch {
    return '';
  }
}

export function saveStudentId(value: string): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be blocked (private mode); the ID still works for this tab.
  }
}
