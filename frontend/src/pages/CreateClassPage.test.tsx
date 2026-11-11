import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { toDateTimeLocal } from '../lib/deadline';
import { fakeBackend, json, renderApp } from '../test/utils';
import { CreateClassPage } from './CreateClassPage';

describe('CreateClassPage', () => {
  it('offers Class 1 to Class 10 and Morning/Day shifts', async () => {
    fakeBackend(() => json(200, []));

    renderApp(<CreateClassPage />);

    const grades = screen.getByLabelText('Class').querySelectorAll('option:not([value=""])');
    expect([...grades].map((o) => o.textContent)).toEqual(Array.from({ length: 10 }, (_, i) => `Class ${i + 1}`));
    const shifts = screen.getByLabelText('Shift').querySelectorAll('option:not([value=""])');
    expect([...shifts].map((o) => o.textContent)).toEqual(['Morning Shift', 'Day Shift']);
  });

  it('creates the class named from the chosen class and shift, with its deadline', async () => {
    const fetchMock = fakeBackend((method) =>
      method === 'POST'
        ? json(201, { id: 'c_1', name: 'Class 7 - Day Shift', totalSeats: 80 })
        : json(200, []),
    );
    const deadline = toDateTimeLocal(Date.now() + 7 * 24 * 3600_000);

    renderApp(<CreateClassPage />);
    await userEvent.selectOptions(screen.getByLabelText('Class'), '7');
    await userEvent.selectOptions(screen.getByLabelText('Shift'), 'Day');
    await userEvent.type(screen.getByLabelText('Total seats'), '80');
    fireEvent.change(screen.getByLabelText('Application deadline'), { target: { value: deadline } });
    await userEvent.click(screen.getByRole('button', { name: 'Create class' }));

    expect(await screen.findByText(/Created "Class 7 - Day Shift" with 80 seats\. Applications close on/)).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      name: 'Class 7 - Day Shift',
      totalSeats: 80,
      applicationDeadline: new Date(deadline).toISOString(),
    });
  });

  it('requires a deadline in the future', async () => {
    const fetchMock = fakeBackend(() => json(200, []));

    renderApp(<CreateClassPage />);
    await userEvent.selectOptions(screen.getByLabelText('Class'), '7');
    await userEvent.selectOptions(screen.getByLabelText('Shift'), 'Day');
    await userEvent.type(screen.getByLabelText('Total seats'), '80');
    await userEvent.click(screen.getByRole('button', { name: 'Create class' }));
    expect(screen.getByText('Please set the application deadline.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Application deadline'), {
      target: { value: toDateTimeLocal(Date.now() - 3600_000) },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Create class' }));
    expect(screen.getByText('The application deadline must be in the future.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('asks for a shift when none is chosen', async () => {
    fakeBackend(() => json(200, []));

    renderApp(<CreateClassPage />);
    await userEvent.selectOptions(screen.getByLabelText('Class'), '3');
    await userEvent.type(screen.getByLabelText('Total seats'), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Create class' }));

    expect(screen.getByText('Please choose a shift.')).toBeInTheDocument();
  });
});
