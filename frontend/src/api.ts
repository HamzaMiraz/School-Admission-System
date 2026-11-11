import { API_URL } from './config';

export type HoldStatus = 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';

export interface SchoolClass {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
  /** Last moment new applications are accepted; null/absent = no deadline. */
  applicationDeadline?: string | null;
  /** False once the deadline has passed. */
  isOpen?: boolean;
}

export interface Hold {
  holdId: string;
  classId: string;
  className?: string;
  studentId?: string;
  status: HoldStatus;
  expiresAt: string;
  createdAt?: string;
  confirmedAt?: string | null;
  /** Seconds left at the moment the server answered; avoids trusting the browser clock. */
  remainingSeconds?: number;
}

/** An error with a message that can be shown to a parent as-is. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const NETWORK_ERROR_MESSAGE =
  'Cannot reach the admission server. Please check your internet connection — we will keep trying.';

function fallbackMessage(status: number): string {
  if (status >= 500) return 'The server had a problem handling this request. Please try again in a moment.';
  if (status === 404) return 'This item could not be found.';
  return 'The request could not be completed. Please check the details and try again.';
}

/** Turns anything thrown into text a person can read. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something unexpected went wrong. Please try again.';
}

interface RequestOptions {
  studentId?: string;
  body?: unknown;
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.studentId) headers['X-Student-Id'] = options.studentId;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', NETWORK_ERROR_MESSAGE);
  }

  const text = await response.text().catch(() => '');
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!response.ok) {
    const body = (data ?? {}) as { error?: string; message?: string; details?: Record<string, unknown> };
    throw new ApiError(
      response.status,
      body.error ?? `HTTP_${response.status}`,
      body.message || fallbackMessage(response.status),
      body.details,
    );
  }
  return data as T;
}

export const api = {
  listClasses: () => request<SchoolClass[]>('GET', '/classes'),
  getClass: (classId: string) => request<SchoolClass>('GET', `/classes/${encodeURIComponent(classId)}`),
  createClass: (name: string, totalSeats: number, applicationDeadline?: string) =>
    request<SchoolClass>('POST', '/classes', { body: { name, totalSeats, applicationDeadline } }),
  applyForSeat: (classId: string, studentId: string) =>
    request<Hold>('POST', `/classes/${encodeURIComponent(classId)}/holds`, { studentId }),
  getHold: (holdId: string) => request<Hold>('GET', `/holds/${encodeURIComponent(holdId)}`),
  payFee: (holdId: string, studentId: string) =>
    request<Hold>('POST', `/holds/${encodeURIComponent(holdId)}/confirm`, { studentId }),
  cancelHold: (holdId: string, studentId: string) =>
    request<void>('DELETE', `/holds/${encodeURIComponent(holdId)}`, { studentId }),
  myHolds: (studentId: string) => request<Hold[]>('GET', '/me/holds', { studentId }),
  /** Admin panel: every application, optionally filtered. */
  adminHolds: (filters: AdminHoldFilters = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    const query = params.toString();
    return request<Hold[]>('GET', `/admin/holds${query ? `?${query}` : ''}`);
  },
};

export interface AdminHoldFilters {
  status?: HoldStatus | '';
  classId?: string;
  studentId?: string;
}
