import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { loadStudentId, saveStudentId } from './lib/studentId';

interface StudentContextValue {
  /** The current student's 17-digit birth registration number, or '' if not entered yet. */
  studentId: string;
  setStudentId: (id: string) => void;
}

const StudentContext = createContext<StudentContextValue | undefined>(undefined);

/** Remembers the student ID in localStorage so it survives refreshes and browser restarts. */
export function StudentProvider({ children }: { children: ReactNode }) {
  const [studentId, setState] = useState(loadStudentId);
  const setStudentId = useCallback((id: string) => {
    saveStudentId(id);
    setState(id);
  }, []);
  const value = useMemo(() => ({ studentId, setStudentId }), [studentId, setStudentId]);
  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent(): StudentContextValue {
  const value = useContext(StudentContext);
  if (!value) throw new Error('useStudent must be used inside <StudentProvider>');
  return value;
}
