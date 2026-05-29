import { useRef, useCallback } from 'react';
import { getJobStatus } from '../services/api';

/**
 * Hook that polls a background job until completion.
 * Returns a function: pollJob(jobId, onComplete, onError)
 *
 * - Polls every 2s
 * - Calls onComplete() when job state is 'completed'
 * - Calls onError(message) when job state is 'failed' or after timeout
 * - Automatically cleans up on unmount
 */
export function useJobPoller() {
  const intervalRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pollJob = useCallback((jobId, onComplete, onError) => {
    stopPolling();
    let attempts = 0;
    const maxAttempts = 150; // 5 minutes at 2s intervals

    intervalRef.current = setInterval(async () => {
      attempts++;

      if (attempts > maxAttempts) {
        stopPolling();
        onError('Job timed out — please check back later');
        return;
      }

      try {
        const res = await getJobStatus(jobId);
        const { state } = res.data;

        if (state === 'completed') {
          stopPolling();
          onComplete();
        } else if (state === 'failed') {
          stopPolling();
          onError(res.data.error || 'Job failed');
        }
        // 'active' or 'created' — keep polling
      } catch {
        // Network error — keep trying
      }
    }, 2000);

    return stopPolling;
  }, [stopPolling]);

  return { pollJob, stopPolling };
}
