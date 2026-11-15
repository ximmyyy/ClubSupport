"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadClub, saveChanges, type Role } from "./cloud";
import { sameData, SPECS } from "./repository";
import { createSeedData } from "./seed";
import { getSupabase } from "./supabase";
import type { AppData } from "./types";

const STORAGE_KEY = "clubsupport:data:v1";

export type DataSource = { kind: "demo" } | { kind: "cloud"; clubId: string; role: Role };
export type SyncStatus = "saved" | "saving" | "error";

type Updater = (draft: AppData) => AppData;

interface StoreValue {
  data: AppData;
  update: (fn: Updater) => void;
  undo: () => void;
  canUndo: boolean;
  reset: () => void;
  replace: (data: AppData) => void;
  source: DataSource;
  canEdit: boolean;
  sync: SyncStatus;
  syncError: string | null;
}

const StoreContext = createContext<StoreValue | null>(null);

export function loadDemoData(): AppData | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed?.version === 1) return parsed;
    }
  } catch {
    /* storage unavailable or corrupt */
  }
  return null;
}

type State = { data: AppData | null; history: AppData[] };

export function StoreProvider({ children, fallback, source }: { children: React.ReactNode; fallback?: React.ReactNode; source: DataSource }) {
  const [state, setState] = useState<State>({ data: null, history: [] });
  const [sync, setSync] = useState<SyncStatus>("saved");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { data, history } = state;

  const cloud = source.kind === "cloud" ? source : null;
  const clubId = cloud?.clubId;
  const canEdit = !cloud || cloud.role === "admin" || cloud.role === "planner";

  /** Last state known to be stored remotely; changes beyond it are written by the save effect. */
  const savedRef = useRef<AppData | null>(null);
  const latestRef = useRef<AppData | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef(0);

  const loadFromServer = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !clubId) return;
    const fresh = await loadClub(sb, clubId);
    if (latestRef.current && sameData(latestRef.current, fresh)) return;
    savedRef.current = fresh;
    setState({ data: fresh, history: [] });
  }, [clubId]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    if (!clubId) {
      const local = loadDemoData() ?? createSeedData();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ data: local, history: [] });
      return;
    }
    loadFromServer().catch((e: Error) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [clubId, loadFromServer]);

  // Persist: demo → localStorage, cloud → Supabase (diff against the last saved state)
  useEffect(() => {
    latestRef.current = data;
    if (!data) return;
    if (!clubId) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        /* ignore quota / private mode */
      }
      return;
    }
    const prev = savedRef.current;
    if (!prev || prev === data) return;
    savedRef.current = data;
    const sb = getSupabase();
    if (!sb) return;
    pendingRef.current += 1;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflects an external write starting
    setSync("saving");
    queueRef.current = queueRef.current
      .then(() => saveChanges(sb, clubId, prev, data))
      .then(() => {
        pendingRef.current -= 1;
        if (pendingRef.current === 0) setSync("saved");
        setSyncError(null);
      })
      .catch(async (e: Error) => {
        pendingRef.current -= 1;
        setSync("error");
        setSyncError(e.message);
        // Server is the source of truth: reload so the screen matches what is stored.
        await loadFromServer().catch(() => {});
      });
  }, [data, clubId, loadFromServer]);

  // Realtime: other users' changes (and the TV screen) update live
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !clubId) return;
    const tables = new Set(["clubs", ...SPECS.map((s) => s.table)]);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (pendingRef.current > 0) return schedule();
        loadFromServer().catch(() => {});
      }, 800);
    };
    const channel = sb
      .channel(`club-${clubId}`)
      .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
        if (!tables.has(payload.table)) return;
        const row = (payload.new ?? {}) as { club_id?: string; id?: string };
        if (payload.eventType === "DELETE" || row.club_id === clubId || row.id === clubId) schedule();
      })
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      sb.removeChannel(channel);
    };
  }, [clubId, loadFromServer]);

  const update = useCallback(
    (fn: Updater) => {
      if (!canEdit) return;
      setState((s) => (s.data ? { data: fn(s.data), history: [...s.history.slice(-29), s.data] } : s));
    },
    [canEdit],
  );

  const undo = useCallback(() => {
    setState((s) => (s.history.length ? { data: s.history[s.history.length - 1], history: s.history.slice(0, -1) } : s));
  }, []);

  const reset = useCallback(() => {
    if (!clubId) setState({ data: createSeedData(), history: [] });
  }, [clubId]);

  const replace = useCallback(
    (next: AppData) => {
      if (!canEdit) return;
      setState((s) => ({ data: next, history: s.data ? [...s.history.slice(-29), s.data] : s.history }));
    },
    [canEdit],
  );

  const canUndo = history.length > 0;
  const value = useMemo(
    () => (data ? { data, update, undo, canUndo, reset, replace, source, canEdit, sync, syncError } : null),
    [data, update, undo, canUndo, reset, replace, source, canEdit, sync, syncError],
  );

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="font-semibold text-stone-900">De clubgegevens konden niet worden geladen.</p>
          <p className="mt-1 text-sm text-stone-500">{loadError}</p>
          <button className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => window.location.reload()}>
            Opnieuw proberen
          </button>
        </div>
      </div>
    );
  }
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
