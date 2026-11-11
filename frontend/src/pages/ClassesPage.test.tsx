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

describe('ClassesPage search and order', () => {
  const many: SchoolClass[] = [
    { id: 'c_10d', name: 'Class 10 - Day Shift', totalSeats: 5, heldSeats: 0, confirmedSeats: 0, availableSeats: 5 },
    { id: 'c_2d', name: 'Class 2 - Day Shift', totalSeats: 5, heldSeats: 5, confirmedSeats: 0, availableSeats: 0 },
    { id: 'c_2m', name: 'Class 2 - Morning Shift', totalSeats: 5, heldSeats: 1, confirmedSeats: 0, availableSeats: 4 },
    { id: 'c_1d', name: 'Class 1 - Day Shift', totalSeats: 5, heldSeats: 0, confirmedSeats: 0, availableSeats: 5 },
  ];
  const rowIds = () => screen.getAllByTestId(/^class-row-/).map((r) => r.dataset.testid);

  it('lists classes from Class 1 to Class 10, Morning before Day', async () => {
    fakeBackend(() => json(200, many));

    renderPage(STUDENT_ID);
    await screen.findByTestId('class-row-c_1d');

    expect(rowIds()).toEqual(['class-row-c_1d', 'class-row-c_2m', 'class-row-c_2d', 'class-row-c_10d']);
  });

  it('filters by class, shift and free seats, and blocks applying to a full class', async () => {
    fakeBackend(() => json(200, many));

    renderPage(STUDENT_ID);
    await screen.findByTestId('class-row-c_1d');
    await userEvent.selectOptions(screen.getByLabelText('Class'), '2');
    expect(rowIds()).toEqual(['class-row-c_2m', 'class-row-c_2d']);

    const full = within(screen.getByTestId('class-row-c_2d'));
    expect(full.getByText('Full — cannot apply')).toBeInTheDocument();
    expect(full.getByRole('button', { name: 'Full' })).toBeDisabled();
    expect(within(screen.getByTestId('class-row-c_2m')).getByText('Available')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Shift'), 'Day');
    expect(rowIds()).toEqual(['class-row-c_2d']);

    await userEvent.click(screen.getByLabelText('Only show classes with free seats'));
    expect(screen.queryAllByTestId(/^class-row-/)).toHaveLength(0);
    expect(screen.getByText(/No class matches your search/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show all classes' }));
    expect(rowIds()).toHaveLength(4);
  });
});

describe('ClassesPage one class per student', () => {
  const open: SchoolClass[] = [
    { id: 'c_1', name: 'Class 6 - Morning Shift', totalSeats: 10, heldSeats: 1, confirmedSeats: 0, availableSeats: 9 },
    { id: 'c_2', name: 'Class 7 - Day Shift', totalSeats: 10, heldSeats: 0, confirmedSeats: 0, availableSeats: 10 },
  ];

  it('blocks applying to other classes while the student has an application', async () => {
    fakeBackend((_, path) =>
      path === '/me/holds'
        ? json(200, [
            {
              holdId: 'h_1',
              classId: 'c_1',
              className: 'Class 6 - Morning Shift',
              status: 'HELD',
              expiresAt: '2099-01-01T00:00:00Z',
              remainingSeconds: 500,
            },
          ])
        : json(200, open),
    );

    renderPage(STUDENT_ID);

    expect(await screen.findByText(/already applied for Class 6 - Morning Shift/)).toBeInTheDocument();
    expect(within(screen.getByTestId('class-row-c_2')).getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(within(screen.getByTestId('class-row-c_1')).getByRole('button', { name: 'Apply' })).toBeDisabled();
  });

  it('allows applying again once the earlier application is cancelled', async () => {
    fakeBackend((_, path) =>
      path === '/me/holds'
        ? json(200, [
            {
              holdId: 'h_1',
              classId: 'c_1',
              className: 'Class 6 - Morning Shift',
              status: 'CANCELLED',
              expiresAt: '2099-01-01T00:00:00Z',
            },
          ])
        : json(200, open),
    );

    renderPage(STUDENT_ID);

    const row = within(await screen.findByTestId('class-row-c_2'));
    expect(row.getByRole('button', { name: 'Apply' })).toBeEnabled();
    expect(screen.queryByText(/already applied/)).not.toBeInTheDocument();
  });
});

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
