import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { fakeBackend, json, renderApp } from './test/utils';

const classes = [
  { id: 'c_1', name: 'Class 6 - Morning Shift', totalSeats: 120, heldSeats: 15, confirmedSeats: 80, availableSeats: 25 },
  { id: 'c_2', name: 'Class 6 - Day Shift', totalSeats: 60, heldSeats: 5, confirmedSeats: 10, availableSeats: 45 },
];

describe('panels', () => {
  it('user panel has the student box and parent menu', async () => {
    fakeBackend(() => json(200, classes));

    renderApp(<App />, { route: '/' });

    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: 'Classes' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'My applications' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Create class' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/birth registration number/i)).toBeInTheDocument();
  });

  it('admin panel has its own menu, totals, and no student box', async () => {
    fakeBackend(() => json(200, classes));

    renderApp(<App />, { route: '/admin' });

    expect(screen.getByText(/Admin Panel/)).toBeInTheDocument();
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: 'Create class' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'My applications' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/birth registration number/i)).not.toBeInTheDocument();
    expect(within(await screen.findByTestId('stat-Total seats')).getByText('180')).toBeInTheDocument();
    expect(within(screen.getByTestId('stat-Available')).getByText('70')).toBeInTheDocument();
  });

  it('switches between the panels', async () => {
    fakeBackend(() => json(200, classes));

    renderApp(<App />, { route: '/' });
    await userEvent.click(screen.getByRole('link', { name: 'Admin panel →' }));
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: '← User panel' }));
    expect(screen.getByRole('heading', { name: 'Classes' })).toBeInTheDocument();
  });
});
