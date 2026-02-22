import { useEffect, useRef, useCallback } from "react";
import React from "react";

/**
 * Debounce a value - returns the original value after it hasn't changed for the delay
 * Useful for search inputs and filter changes
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttle a callback function - ensures it's called at most once per delay period
 * Useful for scroll, resize, and frequent events
 */
export function useThrottledCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number = 300,
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCallRef = useRef<number>(0);

  return useCallback(
    (...args: any[]) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        callback(...args);
      } else {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          callback(...args);
        }, delay - timeSinceLastCall);
      }
    },
    [callback, delay],
  ) as T;
}

/**
 * Debounce a callback function - ensures it's called only after it hasn't been called for the delay
 * Useful for auto-save, API calls on input change
 */
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number = 500,
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    (...args: any[]) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay],
  ) as T;
}
