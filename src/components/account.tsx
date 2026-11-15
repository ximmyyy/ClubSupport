"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { listMyClubs, type ClubMembership } from "@/lib/cloud";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const MODE_KEY = "clubsupport:mode";
const CLUB_KEY = "clubsupport:club";

export type AccountState =
  | { status: "loading" }
  | { status: "demo" }
  | { status: "signedOut" }
  | { status: "error"; message: string }
  | { status: "noClub"; userId: string; email: string }
  | { status: "club"; userId: string; email: string; clubs: ClubMembership[]; active: ClubMembership };

interface AccountValue {
  state: AccountState;
  sb: SupabaseClient | null;
  cloudAvailable: boolean;
  startDemo: () => void;
  leaveDemo: () => void;
  signOut: () => Promise<void>;
  switchClub: (clubId: string) => void;
  refreshClubs: (preferClubId?: string) => Promise<void>;
}

const AccountContext = createContext<AccountValue | null>(null);

function readLocal(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AccountState>({ status: "loading" });
  const sb = getSupabase();

  const resolve = useCallback(
    async (session: Session | null, preferClubId?: string) => {
      if (!sb || !session) {
        setState(readLocal(MODE_KEY) === "demo" || !sb ? { status: "demo" } : { status: "signedOut" });
        return;
      }
      writeLocal(MODE_KEY, "cloud");
      const userId = session.user.id;
      const email = session.user.email ?? "";
      try {
        const clubs = await listMyClubs(sb, userId);
        if (!clubs.length) return setState({ status: "noClub", userId, email });
        const wanted = preferClubId ?? readLocal(CLUB_KEY);
        const active = clubs.find((c) => c.clubId === wanted) ?? clubs[0];
        writeLocal(CLUB_KEY, active.clubId);
        setState({ status: "club", userId, email, clubs, active });
      } catch (e) {
        setState({ status: "error", message: (e as Error).message });
      }
    },
    [sb],
  );

  useEffect(() => {
    if (!sb) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no backend configured: demo only
      setState({ status: "demo" });
      return;
    }
    let lastUser: string | null | undefined;
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION fires on load; SIGNED_IN after a magic link; ignore token refreshes
      const user = session?.user.id ?? null;
      if (user === lastUser && event !== "SIGNED_OUT") return;
      lastUser = user;
      // Defer: Supabase recommends not awaiting other client calls inside this callback
      setTimeout(() => resolve(session), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [sb, resolve]);

  const value: AccountValue = {
    state,
    sb,
    cloudAvailable: isSupabaseConfigured,
    startDemo: () => {
      writeLocal(MODE_KEY, "demo");
      setState({ status: "demo" });
    },
    leaveDemo: () => {
      writeLocal(MODE_KEY, null);
      setState(sb ? { status: "signedOut" } : { status: "demo" });
    },
    signOut: async () => {
      writeLocal(CLUB_KEY, null);
      writeLocal(MODE_KEY, null);
      await sb?.auth.signOut();
      setState({ status: "signedOut" });
    },
    switchClub: (clubId) => {
      if (state.status !== "club") return;
      const active = state.clubs.find((c) => c.clubId === clubId);
      if (!active) return;
      writeLocal(CLUB_KEY, clubId);
      setState({ ...state, active });
    },
    refreshClubs: async (preferClubId) => {
      if (!sb) return;
      const { data } = await sb.auth.getSession();
      await resolve(data.session, preferClubId);
    },
  };

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used inside <AccountProvider>");
  return ctx;
}
