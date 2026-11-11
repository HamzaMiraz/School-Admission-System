import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Hold } from '../api';
import { fakeBackend, json, renderApp, STUDENT_ID } from '../test/utils';
import { ApplicationPage } from './ApplicationPage';

function renderPage() {
  return renderApp(
    <Routes>
      <Route path="/applications/:holdId" element={<ApplicationPage />} />
    </Routes>,
    { route: '/applications/h_1', studentId: STUDENT_ID },
  );
}

function hold(overrides: Partial<Hold> = {}): Hold {
  return {
    holdId: 'h_1',
    classId: 'c_1',
    className: 'Class 6 - Morning Shift',
    studentId: STUDENT_ID,
    status: 'HELD',
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    remainingSeconds: 600,
    ...overrides,
  };
}

describe('ApplicationPage', () => {
  it('shows the status and time left, with pay and cancel buttons', async () => {
    fakeBackend(() => json(200, hold({ remainingSeconds: 125 })));

    renderPage();

    expect(await screen.findByText(/Seat held/)).toBeInTheDocument();
    expect(screen.getByTestId('countdown')).toHaveTextContent(/02:0[45]/);
    expect(screen.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'বাতিল' })).toBeEnabled();
  });

  it('switches to EXPIRED and disables paying when the countdown ends, without a reload', async () => {
    // A server whose hold runs out 2 seconds from now. It keeps answering HELD (as if its
    // sweeper had not run yet) so the UI has to notice the expiry on its own.
    const expiresAt = Date.now() + 2000;
    fakeBackend(() =>
      json(200, hold({ remainingSeconds: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) })),
    );

    renderPage();
    const pay = await screen.findByRole('button', { name: 'ভর্তি ফি দিন' });
    expect(pay).toBeEnabled();

    await waitFor(() => expect(screen.getByText(/EXPIRED/)).toBeInTheDocument(), { timeout: 4000 });
    expect(pay).toBeDisabled();
    expect(screen.getByText(/time to pay ran out/i)).toBeInTheDocument();
  });

  it('confirms admission when the fee is paid', async () => {
    let status: Hold['status'] = 'HELD';
    const fetchMock = fakeBackend((method, path) => {
      if (method === 'POST' && path === '/holds/h_1/confirm') {
        status = 'CONFIRMED';
        return json(200, { holdId: 'h_1', status });
      }
      return json(200, hold({ status, remainingSeconds: status === 'HELD' ? 600 : 0 }));
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'ভর্তি ফি দিন' }));

    expect(await screen.findByText('Payment received. Admission is confirmed!')).toBeInTheDocument();
    expect(await screen.findByText(/Admission confirmed\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeDisabled();
    const confirmCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect((confirmCall?.[1]?.headers as Record<string, string>)['X-Student-Id']).toBe(STUDENT_ID);
  });

  it('shows the server explanation when paying fails', async () => {
    fakeBackend((method) =>
      method === 'POST'
        ? json(409, { error: 'HOLD_EXPIRED', message: 'The time to pay the admission fee has run out.' })
        : json(200, hold()),
    );

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'ভর্তি ফি দিন' }));

    expect(await screen.findByText('The time to pay the admission fee has run out.')).toBeInTheDocument();
  });

  it('asks before cancelling, then cancels', async () => {
    let status: Hold['status'] = 'HELD';
    fakeBackend((method) => {
      if (method === 'DELETE') {
        status = 'CANCELLED';
        return new Response(null, { status: 204 });
      }
      return json(200, hold({ status }));
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'বাতিল' }));
    await userEvent.click(screen.getByRole('button', { name: 'হ্যাঁ, বাতিল করুন' }));

    expect(await screen.findByText(/Application cancelled/)).toBeInTheDocument();
    expect(await screen.findByText('This application was cancelled.')).toBeInTheDocument();
  });

  it('shows a clear message when the server is down', async () => {
    fakeBackend(() => {
      throw new TypeError('Failed to fetch');
    });

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/Cannot reach the admission server/);
  });
});
