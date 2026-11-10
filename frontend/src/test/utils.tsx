import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { saveStudentId } from '../lib/studentId';
import { StudentProvider } from '../student';

export const STUDENT_ID = '20152691234567890';

export function renderApp(ui: ReactElement, { route = '/', studentId }: { route?: string; studentId?: string } = {}) {
  if (studentId) saveStudentId(studentId);
  return render(
    <MemoryRouter initialEntries={[route]}>
      <StudentProvider>{ui}</StudentProvider>
    </MemoryRouter>,
  );
}

export function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Handler = (method: string, path: string, init: RequestInit | undefined) => Response | Promise<Response>;

/** Replaces fetch with a fake backend. Returns the mock to inspect calls. */
export function fakeBackend(handler: Handler) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    return handler(init?.method ?? 'GET', url.pathname, init);
  });
}
