"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createSeedData } from "./seed";
import type { AppData } from "./types";

const STORAGE_KEY = "clubsupport:data:v1";

type Updater = (draft: AppData) => AppData;

interface StoreValue {
  data: AppData;
  update: (fn: Updater) => void;
  undo: () => void;
  canUndo: boolean;
  reset: () => void;
  replace: (data: AppData) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function load(): AppData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed?.version === 1) return parsed;
    }
  } catch {
    /* storage unavailable or corrupt: fall back to demo data */
  }
  return createSeedData();
}

export function StoreProvider({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const [state, setState] = useState<{ data: AppData | null; history: AppData[] }>({ data: null, history: [] });
  const { data, history } = state;

  useEffect(() => {
    // Client-only: localStorage and "today" only exist in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ data: load(), history: [] });
  }, []);

  useEffect(() => {
    if (!data) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore quota / private mode */
    }
  }, [data]);

  const update = useCallback((fn: Updater) => {
    setState((s) => (s.data ? { data: fn(s.data), history: [...s.history.slice(-29), s.data] } : s));
  }, []);

  const undo = useCallback(() => {
    setState((s) => (s.history.length ? { data: s.history[s.history.length - 1], history: s.history.slice(0, -1) } : s));
  }, []);

  const reset = useCallback(() => setState({ data: createSeedData(), history: [] }), []);

  const replace = useCallback((next: AppData) => {
    setState((s) => ({ data: next, history: s.data ? [...s.history.slice(-29), s.data] : s.history }));
  }, []);

  const canUndo = history.length > 0;
  const value = useMemo(
    () => (data ? { data, update, undo, canUndo, reset, replace } : null),
    [data, update, undo, canUndo, reset, replace],
  );

  if (!value) return <>{fallback ?? null}</>;
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

export function useLookups() {
  const { data } = useStore();
  return useMemo(
    () => ({
      team: new Map(data.teams.map((t) => [t.id, t])),
      field: new Map(data.fields.map((f) => [f.id, f])),
      room: new Map(data.rooms.map((r) => [r.id, r])),
    }),
    [data.teams, data.fields, data.rooms],
  );
}
