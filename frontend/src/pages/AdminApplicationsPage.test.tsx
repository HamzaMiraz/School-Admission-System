import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Hold } from '../api';
import { fakeBackend, json, renderApp } from '../test/utils';
import { AdminApplicationsPage } from './AdminApplicationsPage';

const classes = [
  { id: 'c_1', name: 'Class 6 - Morning Shift', totalSeats: 10, heldSeats: 1, confirmedSeats: 1, availableSeats: 8 },
  { id: 'c_2', name: 'Class 7 - Day Shift', totalSeats: 10, heldSeats: 0, confirmedSeats: 0, availableSeats: 10 },
];

const holds: Hold[] = [
  {
    holdId: 'h_paid',
    classId: 'c_1',
    className: 'Class 6 - Morning Shift',
    studentId: '20150000000000001',
    status: 'CONFIRMED',
    expiresAt: '2026-11-11T10:10:00Z',
    createdAt: '2026-11-11T10:00:00Z',
    confirmedAt: '2026-11-11T10:02:00Z',
    remainingSeconds: 0,
  },
  {
    holdId: 'h_waiting',
    classId: 'c_1',
    className: 'Class 6 - Morning Shift',
    studentId: '20150000000000002',
    status: 'HELD',
    expiresAt: '2026-11-11T10:20:00Z',
    createdAt: '2026-11-11T10:10:00Z',
    remainingSeconds: 300,
  },
  {
    holdId: 'h_expired',
    classId: 'c_2',
    className: 'Class 7 - Day Shift',
    studentId: '20150000000000003',
    status: 'EXPIRED',
    expiresAt: '2026-11-11T09:10:00Z',
    createdAt: '2026-11-11T09:00:00Z',
    remainingSeconds: 0,
  },
];

describe('AdminApplicationsPage', () => {
  it('shows each student with class, shift, status and payment', async () => {
    fakeBackend((_, path) => json(200, path === '/classes' ? classes : holds));

    renderApp(<AdminApplicationsPage />);

    const paid = await screen.findByTestId('application-h_paid');
    expect(within(paid).getByText('20150000000000001')).toBeInTheDocument();
    expect(within(paid).getByText('Class 6')).toBeInTheDocument();
    expect(within(paid).getByText('Morning Shift')).toBeInTheDocument();
    expect(within(paid).getByText(/✔ Paid/)).toBeInTheDocument();

    const waiting = screen.getByTestId('application-h_waiting');
    expect(within(waiting).getByText(/Not paid yet · 0[45]:\d\d left/)).toBeInTheDocument();

    const expired = screen.getByTestId('application-h_expired');
    expect(within(expired).getByText('Class 7')).toBeInTheDocument();
    expect(within(expired).getByText('Day Shift')).toBeInTheDocument();
    expect(within(expired).getByText('Not paid')).toBeInTheDocument();

    expect(within(screen.getByTestId('stat-Paid & confirmed')).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByTestId('stat-Waiting for payment')).getByText('1')).toBeInTheDocument();
  });

  it('asks the server for the chosen filters', async () => {
    const fetchMock = fakeBackend((_, path) => json(200, path === '/classes' ? classes : []));

    renderApp(<AdminApplicationsPage />);
    await screen.findByText('No applications match these filters.');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Class 7 - Day Shift' })).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'CONFIRMED');
    await userEvent.selectOptions(screen.getByLabelText('Class & shift'), 'c_2');

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(urls).toContain('http://localhost:8080/admin/holds?status=CONFIRMED&classId=c_2');
    });
  });
});
