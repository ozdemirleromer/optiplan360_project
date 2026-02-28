/**
 * Custom hooks for Admin components
 */

import { useCallback, useRef, useState } from "react";

/**
 * Hook for managing async operations with loading and error states.
 * Keeps a stable `execute` reference to prevent effect loops.
 */
export function useAsyncOperation<T>(
  operation: (...args: unknown[]) => Promise<T>,
  onSuccess?: (data: T) => void,
  onError?: (error: unknown) => void
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const operationRef = useRef(operation);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  operationRef.current = operation;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const execute = useCallback(async (...args: unknown[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await operationRef.current(...args);
      onSuccessRef.current?.(result);
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Islem basarisiz oldu";
      setError(errorMessage);
      onErrorRef.current?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { execute, loading, error, setError };
}
