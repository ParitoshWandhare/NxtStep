// ============================================================
// NxtStep — Custom Hooks
// ============================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setTheme, selectTheme, selectIsMobile, setIsMobile } from '@/features/ui/uiSlice';
import { selectIsAuthenticated, selectCurrentUser } from '@/features/auth/authSlice';
import type { Theme } from '@/types';

// ── useTheme ──────────────────────────────────────────────────
export function useTheme() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector(selectTheme);

  const toggle = useCallback(() => {
    const isDark = document.documentElement.classList.contains('dark');
    dispatch(setTheme(isDark ? 'light' : 'dark'));
  }, [dispatch]);

  const set = useCallback(
    (t: Theme) => dispatch(setTheme(t)),
    [dispatch]
  );

  return {
    theme,
    isDark: document.documentElement.classList.contains('dark'),
    toggle,
    set,
  };
}

// ── useResponsive ─────────────────────────────────────────────
export function useResponsive() {
  const dispatch = useAppDispatch();
  const isMobile = useAppSelector(selectIsMobile);
  const [isTablet, setIsTablet] = useState(
    window.innerWidth >= 768 && window.innerWidth < 1024
  );

  useEffect(() => {
    const handler = () => {
      const width = window.innerWidth;
      dispatch(setIsMobile(width < 768));
      setIsTablet(width >= 768 && width < 1024);
    };
    const debouncedHandler = debounceSimple(handler, 150);
    window.addEventListener('resize', debouncedHandler);
    return () => window.removeEventListener('resize', debouncedHandler);
  }, [dispatch]);

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
  };
}

function debounceSimple<T extends () => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...(args as [])), delay);
  }) as T;
}

// ── useAuth ───────────────────────────────────────────────────
export function useAuth() {
  const user = useAppSelector(selectCurrentUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  return { user, isAuthenticated };
}

// ── useCountdown ──────────────────────────────────────────────
export function useCountdown(initialSeconds: number) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          setIsRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const reset = useCallback(
    (newSeconds?: number) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsRunning(false);
      setSeconds(newSeconds ?? initialSeconds);
    },
    [initialSeconds]
  );

  const pause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { seconds, isRunning, start, pause, reset, isExpired: seconds === 0 };
}

// ── useDebounce ───────────────────────────────────────────────
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ── useLocalStorage ───────────────────────────────────────────
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
        localStorage.setItem(key, JSON.stringify(next));
        return next;
      });
    },
    [key]
  );

  return [value, set] as const;
}

// ── useOutsideClick ───────────────────────────────────────────
export function useOutsideClick(callback: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [callback]);
  return ref;
}

// ── usePageTitle ──────────────────────────────────────────────
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} — NxtStep` : 'NxtStep';
  }, [title]);
}

// ── useIntersectionObserver ───────────────────────────────────
export function useIntersectionObserver(options?: IntersectionObserverInit) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      options
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [options]);

  return { ref, isVisible };
}