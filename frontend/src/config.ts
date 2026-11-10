declare global {
  interface Window {
    __APP_CONFIG__?: { API_URL?: string };
  }
}

/**
 * Backend base URL. Priority:
 * 1. window.__APP_CONFIG__.API_URL — written at container start from the API_URL env var
 * 2. VITE_API_URL — env var at dev/build time
 * 3. http://localhost:8080
 */
export const API_URL = (
  window.__APP_CONFIG__?.API_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8080'
).replace(/\/+$/, '');

/** How often seat counts and application status are refreshed. */
export const CLASS_POLL_MS = 3000;
export const HOLD_POLL_MS = 5000;
