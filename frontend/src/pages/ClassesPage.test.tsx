import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { SchoolClass } from '../api';
import { fakeBackend, json, renderApp, STUDENT_ID } from '../test/utils';
import { ClassesPage } from './ClassesPage';

const classes: SchoolClass[] = [
  { id: 'c_1', name: 'Class 6 - Morning Shift', totalSeats: 120, heldSeats: 15, confirmedSeats: 80, availableSeats: 25 },
  { id: 'c_2', name: 'Class 6 - Day Shift', totalSeats: 2, heldSeats: 1, confirmedSeats: 1, availableSeats: 0 },
];

function renderPage(studentId?: string) {
  return renderApp(
    <Routes>
      <Route path="/" element={<ClassesPage />} />
      <Route path="/applications/:holdId" element={<p>Application page for this hold</p>} />
    </Routes>,
    { studentId },
  );
}

describe('ClassesPage', () => {
  it('shows seat counts for every class and marks full classes', async () => {
    fakeBackend(() => json(200, classes));

    renderPage(STUDENT_ID);

    const morning = await screen.findByTestId('class-row-c_1');
    for (const value of ['120', '15', '80', '25']) {
      expect(within(morning).getByText(value)).toBeInTheDocument();
    }
    expect(within(morning).getByRole('button', { name: 'Apply' })).toBeEnabled();
    expect(within(screen.getByTestId('class-row-c_2')).getByRole('button', { name: 'Full' })).toBeDisabled();
  });

  it('opens the application after a successful apply', async () => {
    fakeBackend((method) =>
      method === 'POST'
        ? json(201, { holdId: 'h_9', classId: 'c_1', status: 'HELD', expiresAt: '2026-11-01T04:10:00Z' })
        : json(200, classes),
    );

    renderPage(STUDENT_ID);
    await userEvent.click(within(await screen.findByTestId('class-row-c_1')).getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText('Application page for this hold')).toBeInTheDocument();
  });

  it('explains when the seats ran out in the meantime', async () => {
    fakeBackend((method) =>
      method === 'POST'
        ? json(409, { error: 'NO_SEATS_AVAILABLE', message: 'Sorry, all seats in Class 6 - Morning Shift are taken right now.' })
        : json(200, classes),
    );

    renderPage(STUDENT_ID);
    await userEvent.click(within(await screen.findByTestId('class-row-c_1')).getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText(/all seats in Class 6 - Morning Shift are taken/)).toBeInTheDocument();
  });

  it('shows an error instead of a blank page when the server is down', async () => {
    fakeBackend(() => {
      throw new TypeError('Failed to fetch');
    });

    renderPage(STUDENT_ID);

    expect(await screen.findByText(/Cannot reach the admission server/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
