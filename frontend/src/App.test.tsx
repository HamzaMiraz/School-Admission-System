import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { fakeBackend, json, renderApp, STUDENT_ID } from './test/utils';

const classes = [
  { id: 'c_1', name: 'Class 6 - Morning Shift', totalSeats: 120, heldSeats: 15, confirmedSeats: 80, availableSeats: 25 },
  { id: 'c_2', name: 'Class 6 - Day Shift', totalSeats: 60, heldSeats: 5, confirmedSeats: 10, availableSeats: 45 },
];

describe('user panel sign-in', () => {
  it('sends a visitor who is not signed in to the sign-in page', () => {
    fakeBackend(() => json(200, classes));

    renderApp(<App />, { route: '/applications' });

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('rejects an invalid number, then signs in, remembers the student and signs out', async () => {
    fakeBackend(() => json(200, classes));
    renderApp(<App />, { route: '/' });

    await userEvent.type(screen.getByLabelText(/birth registration number/i), '12345');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('must be 17 digits');

    await userEvent.clear(screen.getByLabelText(/birth registration number/i));
    await userEvent.type(screen.getByLabelText(/birth registration number/i), STUDENT_ID);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('heading', { name: 'Classes' })).toBeInTheDocument();
    expect(screen.getByText(STUDENT_ID)).toBeInTheDocument();
    expect(localStorage.getItem('school-admission.studentId')).toBe(STUDENT_ID);

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(localStorage.getItem('school-admission.studentId')).toBeNull();
  });

  it('after signing out on another page, the next student starts on Classes', async () => {
    fakeBackend((_, path) => json(200, path === '/classes' ? classes : []));
    renderApp(<App />, { route: '/applications', studentId: STUDENT_ID });
    expect(screen.getByRole('heading', { name: 'My applications' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await userEvent.type(screen.getByLabelText(/birth registration number/i), '20159999999999999');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('heading', { name: 'Classes' })).toBeInTheDocument();
    expect(screen.getByText('20159999999999999')).toBeInTheDocument();
  });

  it('a signed-in student sees only the parent menu', () => {
    fakeBackend(() => json(200, classes));

    renderApp(<App />, { route: '/', studentId: STUDENT_ID });

    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: 'Classes' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'My applications' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Create class' })).not.toBeInTheDocument();
  });
});

describe('admin panel', () => {
  it('has its own menu and seat totals, without needing a student', async () => {
    fakeBackend(() => json(200, classes));

    renderApp(<App />, { route: '/admin' });

    expect(screen.getByText(/Admin Panel/)).toBeInTheDocument();
    const nav = screen.getByRole('navigation');
    for (const name of ['Overview', 'Applications', 'Create class']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(within(await screen.findByTestId('stat-Total seats')).getByText('180')).toBeInTheDocument();
    expect(within(screen.getByTestId('stat-Available')).getByText('70')).toBeInTheDocument();
  });
});
