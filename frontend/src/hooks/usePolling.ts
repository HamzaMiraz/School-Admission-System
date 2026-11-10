import { useCallback, useEffect, useRef, useState } from 'react';

export interface PollingState<T> {
  data: T | undefined;
  /** Browser time when `data` arrived. */
  receivedAt: number;
  error: unknown;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Loads data now and then every `intervalMs`. On a failed refresh the last good data is
 * kept and `error` is set, so the page can say "can't reach server" without going blank.
 * `key` identifies the resource; changing it restarts polling.
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, key: string): PollingState<T> {
  const [state, setState] = useState<Omit<PollingState<T>, 'refresh'>>({
    data: undefined,
    receivedAt: 0,
    error: undefined,
    loading: true,
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const generation = useRef(0);

  const load = useCallback(async () => {
    const mine = generation.current;
    try {
      const data = await fetcherRef.current();
      if (mine !== generation.current) return;
      setState({ data, receivedAt: Date.now(), error: undefined, loading: false });
    } catch (error) {
      if (mine !== generation.current) return;
      setState((prev) => ({ ...prev, error, loading: false }));
    }
  }, []);

  useEffect(() => {
    generation.current += 1;
    setState({ data: undefined, receivedAt: 0, error: undefined, loading: true });
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      await load();
      if (!stopped) timer = setTimeout(tick, intervalMs);
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [key, intervalMs, load]);

  return { ...state, refresh: load };
}
