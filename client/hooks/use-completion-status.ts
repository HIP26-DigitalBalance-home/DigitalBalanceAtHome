import { useEffect, useRef, useState } from 'react';
import { completionsApi } from '@/lib/api';

interface CompletionState {
  status: string | null;
  photoUrl: string | null;
}

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 60000;

export function useCompletionStatus(completionId: string | null): CompletionState {
  const [state, setState] = useState<CompletionState>({ status: null, photoUrl: null });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!completionId) return;

    setState({ status: null, photoUrl: null });

    function stop() {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    }

    async function poll() {
      try {
        const res = await completionsApi.getById(completionId!);
        const { status } = res.data;
        if (status === 'ready') {
          stop();
          // photo_url is now included in the polling response from the server
          setState({ status: 'ready', photoUrl: res.data.photo_url ?? null });
        } else {
          setState({ status, photoUrl: null });
        }
      } catch {
        // keep polling until timeout
      }
    }

    poll(); // immediate first check
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    timeoutRef.current = setTimeout(stop, TIMEOUT_MS);

    return stop;
  }, [completionId]);

  return state;
}
