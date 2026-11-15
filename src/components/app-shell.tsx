"use client";

import {
  AlertCircle, CalendarDays, Check, CloudUpload, DoorOpen, Eye, HandHeart, Inbox, LayoutDashboard, LayoutGrid, LogIn, LogOut, Menu, Settings, Tv, Users, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { ROLE_LABELS, type Role } from "@/lib/cloud";
import { useStore } from "@/lib/store";
import { todayISO } from "@/lib/time";
import { AccountProvider, useAccount } from "./account";
import { ClubGate } from "./club-gate";
import { Logo } from "./logo";
import { ToastProvider } from "./toast";
import { cn } from "./ui";

const NAV = [
  { href: "/app", label: "Dashboard", short: "Dashboard", icon: LayoutDashboard },
  { href: "/app/veldbezetting", label: "Veldbezetting", short: "Velden", icon: LayoutGrid },
  { href: "/app/kleedkamers", label: "Kleedkamers", short: "Kleedkamers", icon: DoorOpen },
  { href: "/app/wedstrijden", label: "Wedstrijden", short: "Wedstrijden", icon: CalendarDays },
  { href: "/app/verzoeken", label: "Verzoeken", short: "Verzoeken", icon: Inbox },
  { href: "/app/teams", label: "Teams", short: "Teams", icon: Users },
  { href: "/app/vrijwilligers", label: "Vrijwilligers", short: "Diensten", icon: HandHeart },
  { href: "/app/instellingen", label: "Instellingen", short: "Instellingen", icon: Settings },
] as const;

/** Five most useful pages for the phone tab bar, per role. */
const MOBILE_PLANNER = ["/app", "/app/veldbezetting", "/app/kleedkamers", "/app/wedstrijden", "/app/verzoeken"];
const MOBILE_OTHER = ["/app", "/app/veldbezetting", "/app/wedstrijden", "/app/verzoeken", "/app/vrijwilligers"];

/** Open requests that need attention from this user. */
function useOpenRequestCount() {
  const { data, canEdit, me } = useStore();
  return data.requests.filter((r) => r.status === "open" && (canEdit || me.teamIds.includes(r.teamId))).length;
}

function CountBadge({ n, light }: { n: number; light?: boolean }) {
  if (!n) return null;
  return (
    <span className={cn("ml-auto min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-bold", light ? "bg-amber-400 text-amber-950" : "bg-amber-500 text-white")}>
      {n}
    </span>
  );
}

const DateContext = createContext<[string, (d: string) => void]>(["", () => {}]);
export const useSelectedDate = () => useContext(DateContext);

function DateProvider({ children }: { children: React.ReactNode }) {
  const state = useState(todayISO);
  return <DateContext.Provider value={state}>{children}</DateContext.Provider>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AccountProvider>
      <ClubGate>
        <ToastProvider>
          <DateProvider>
            <Frame>{children}</Frame>
          </DateProvider>
        </ToastProvider>
      </ClubGate>
    </AccountProvider>
  );
}

function SyncBadge() {
  const { source, sync, syncError, canEdit, canRequest } = useStore();
  if (source.kind === "demo") return null;
  if (!canEdit && !canRequest) return <span className="flex items-center gap-1 text-xs text-amber-200"><Eye size={12} /> Alleen lezen</span>;
  if (sync === "saving") return <span className="flex items-center gap-1 text-xs text-brand-100/70"><CloudUpload size={12} className="animate-pulse" /> Opslaan…</span>;
  if (sync === "error") return <span className="flex items-center gap-1 text-xs text-red-300" title={syncError ?? ""}><AlertCircle size={12} /> Niet opgeslagen</span>;
  return <span className="flex items-center gap-1 text-xs text-brand-100/60"><Check size={12} /> Opgeslagen</span>;
}

function AccountFooter() {
  const { state, signOut, leaveDemo, cloudAvailable, setDemoRole } = useAccount();
  const { data } = useStore();
  if (state.status === "demo") {
    const value = state.role === "trainer" ? `trainer:${state.teamIds[0] ?? ""}` : state.role;
    return (
      <div className="mt-auto rounded-xl bg-white/6 p-3 text-xs text-brand-100/70">
        <label className="mb-2 block">
          <span className="mb-1 block font-semibold text-brand-100">Bekijk de demo als</span>
          <select
            value={value}
            onChange={(e) => {
              const [role, teamId] = e.target.value.split(":");
              setDemoRole(role as Role, teamId ? [teamId] : []);
            }}
            className="w-full rounded-lg bg-white/10 px-2 py-1.5 text-sm text-white focus:outline-none [&>optgroup]:text-stone-900 [&>option]:text-stone-900"
          >
            <option value="admin">Wedstrijdsecretaris (beheerder)</option>
            <optgroup label="Trainer van…">
              {data.teams.map((t) => <option key={t.id} value={`trainer:${t.id}`}>{t.name} ({t.trainer})</option>)}
            </optgroup>
            <option value="viewer">Alleen lezen</option>
          </select>
        </label>
        <p>Je bekijkt de demo. Gegevens blijven in deze browser.</p>
        {cloudAvailable && (
          <button onClick={leaveDemo} className="mt-2 flex items-center gap-1.5 font-semibold text-brand-200 hover:text-white"><LogIn size={14} /> Inloggen met je club</button>
        )}
      </div>
    );
  }
  if (state.status !== "club") return null;
  return (
    <div className="mt-auto flex items-center justify-between gap-2 px-2">
      <span className="truncate text-xs text-brand-100/60" title={state.email}>{state.email}</span>
      <button onClick={signOut} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-brand-100/70 hover:bg-white/6 hover:text-white"><LogOut size={14} /> Uitloggen</button>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const openRequests = useOpenRequestCount();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-white/12 text-white" : "text-brand-100/75 hover:bg-white/6 hover:text-white",
            )}
          >
            <Icon size={18} className={active ? "text-brand-300" : ""} />
            {item.label}
            {item.href === "/app/verzoeken" && <CountBadge n={openRequests} light />}
          </Link>
        );
      })}
      <div className="my-3 h-px bg-white/10" />
      <Link
        href="/scherm"
        target="_blank"
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-100/75 hover:bg-white/6 hover:text-white"
      >
        <Tv size={18} /> TV-scherm kantine
      </Link>
    </nav>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { data, canEdit } = useStore();
  const { state, switchClub } = useAccount();
  const openRequests = useOpenRequestCount();
  const mobileNav = (canEdit ? MOBILE_PLANNER : MOBILE_OTHER).map((href) => NAV.find((n) => n.href === href)!);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const initials = data.club.shortName.slice(0, 2).toUpperCase();

  const clubCard = (
    <div className="flex items-center gap-3 rounded-xl bg-white/6 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-400 text-sm font-bold text-brand-950">{initials}</div>
      <div className="min-w-0 flex-1">
        {state.status === "club" && state.clubs.length > 1 ? (
          <select
            value={state.active.clubId}
            onChange={(e) => switchClub(e.target.value)}
            className="w-full truncate rounded bg-transparent text-sm font-semibold text-white focus:outline-none [&>option]:text-stone-900"
            aria-label="Wissel van club"
          >
            {state.clubs.map((c) => <option key={c.clubId} value={c.clubId}>{c.name}</option>)}
          </select>
        ) : (
          <p className="truncate text-sm font-semibold text-white">{data.club.name}</p>
        )}
        <p className="truncate text-xs text-brand-100/60">
          {state.status === "club" ? ROLE_LABELS[state.active.role] : state.status === "demo" ? `Demo · ${ROLE_LABELS[state.role]}` : "Demo"} · {data.club.city || "voetbal"}
        </p>
        <div className="mt-1"><SyncBadge /></div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 bg-brand-950 p-4 lg:flex">
        <Link href="/" className="px-2 pt-1">
          <Logo light />
        </Link>
        {clubCard}
        <NavLinks />
        <AccountFooter />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 bg-brand-950 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <Logo light />
              <button onClick={() => setOpen(false)} className="p-1 text-white" aria-label="Menu sluiten"><X /></button>
            </div>
            {clubCard}
            <NavLinks onNavigate={() => setOpen(false)} />
            <AccountFooter />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-stone-700 hover:bg-stone-100" aria-label="Menu openen">
            <Menu />
          </button>
          <Logo />
          <span className="w-9" />
        </header>
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 pt-6 pb-24 md:px-8 lg:pb-10">{children}</main>
        {/* Mobile bottom nav */}
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-stone-200 bg-white lg:hidden">
          {mobileNav.map((item) => {
            const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={cn("relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-brand-700" : "text-stone-500")}>
                <Icon size={20} />
                {item.short}
                {item.href === "/app/verzoeken" && openRequests > 0 && (
                  <span className="absolute top-1 left-1/2 ml-2 min-w-4 rounded-full bg-amber-500 px-1 text-[10px] leading-4 font-bold text-white">{openRequests}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
