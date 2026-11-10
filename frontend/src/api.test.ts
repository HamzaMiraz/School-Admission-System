import { describe, expect, it, vi } from 'vitest';
import { api, ApiError, NETWORK_ERROR_MESSAGE } from './api';
import { fakeBackend, json } from './test/utils';

describe('api client', () => {
  it('sends the student ID header and parses JSON', async () => {
    const fetchMock = fakeBackend(() =>
      json(201, { holdId: 'h_1', classId: 'c_1', status: 'HELD', expiresAt: '2026-11-01T04:10:00Z' }),
    );

    const hold = await api.applyForSeat('c_1', '20152691234567890');

    expect(hold.holdId).toBe('h_1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://localhost:8080/classes/c_1/holds');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['X-Student-Id']).toBe('20152691234567890');
  });

  it('turns a server error body into an ApiError with the server message', async () => {
    fakeBackend(() => json(409, { error: 'NO_SEATS_AVAILABLE', message: 'Sorry, all seats are taken.' }));

    const error = await api.applyForSeat('c_1', '20152691234567890').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'NO_SEATS_AVAILABLE', message: 'Sorry, all seats are taken.' });
  });

  it('explains when the server cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(api.listClasses()).rejects.toMatchObject({ code: 'NETWORK_ERROR', message: NETWORK_ERROR_MESSAGE });
  });

  it('gives a friendly message for a server crash without a JSON body', async () => {
    fakeBackend(() => new Response('<html>Bad Gateway</html>', { status: 502 }));

    await expect(api.listClasses()).rejects.toMatchObject({ status: 502, message: expect.stringMatching(/server/i) });
  });

  it('handles 204 No Content on cancel', async () => {
    fakeBackend(() => new Response(null, { status: 204 }));

    await expect(api.cancelHold('h_1', '20152691234567890')).resolves.toBeUndefined();
  });
});
