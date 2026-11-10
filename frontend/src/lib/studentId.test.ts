import { describe, expect, it } from 'vitest';
import { loadStudentId, normalizeStudentId, saveStudentId, validateStudentId } from './studentId';

describe('student ID', () => {
  it('accepts exactly 17 digits', () => {
    expect(validateStudentId('20152691234567890')).toBeNull();
  });

  it.each([
    ['', 'Please enter'],
    ['2015269123456789', '17 digits (you entered 16)'],
    ['201526912345678901', '17 digits (you entered 18)'],
    ['2015269123456789X', 'digits only'],
  ])('rejects %j with a readable message', (value, message) => {
    expect(validateStudentId(value)).toContain(message);
  });

  it('converts Bangla digits and strips spaces and dashes', () => {
    expect(normalizeStudentId(' ২০১৫ ২৬৯১-২৩৪৫৬৭৮৯০ ')).toBe('20152691234567890');
  });

  it('remembers the ID across page loads and ignores garbage in storage', () => {
    saveStudentId('20152691234567890');
    expect(loadStudentId()).toBe('20152691234567890');
    localStorage.setItem('school-admission.studentId', 'nonsense');
    expect(loadStudentId()).toBe('');
  });
});
