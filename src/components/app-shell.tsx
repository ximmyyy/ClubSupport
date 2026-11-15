"use client";

import {
  AlertCircle, CalendarDays, Check, CloudUpload, DoorOpen, Eye, HandHeart, House, Inbox, LayoutGrid, LogIn, LogOut, Menu, Settings, Tv, Users, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { ROLE_LABELS, type Role } from "@/lib/cloud";
import { useStore } from "@/lib/store";
import { todayISO } from "@/lib/time";
import { AccountProvider, useAccount } from "./account";
import { ClubGate } from "./club-gate";
import { ConfirmProvider } from "./confirm";
import { Logo, LogoMark } from "./logo";
import { ApplyTextSize, TextSizeControl } from "./text-size";
import { ToastProvider } from "./toast";
import { cn } from "./ui";

type NavItem = { href: string; label: string; short: string; icon: typeof House };

const HOME: NavItem = { href: "/app", label: "Overzicht", short: "Overzicht", icon: House };
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Planning",
    items: [
      { href: "/app/veldbezetting", label: "Veldbezetting", short: "Velden", icon: LayoutGrid },
      { href: "/app/kleedkamers", label: "Kleedkamers", short: "Kleedkamers", icon: DoorOpen },
      { href: "/app/wedstrijden", label: "Wedstrijden", short: "Wedstrijden", icon: CalendarDays },
      { href: "/app/vrijwilligers", label: "Vrijwilligers", short: "Diensten", icon: HandHeart },
    ],
  },
  {
    title: "Club",
    items: [
      { href: "/app/verzoeken", label: "Verzoeken", short: "Verzoeken", icon: Inbox },
      { href: "/app/teams", label: "Teams", short: "Teams", icon: Users },
      { href: "/app/instellingen", label: "Instellingen", short: "Instellingen", icon: Settings },
    ],
  },
];
const ALL_NAV = [HOME, ...NAV_GROUPS.flatMap((g) => g.items)];

/** Four most used pages in the phone tab bar; everything else sits behind "Meer". */
const TABS_PLANNER = ["/app", "/app/veldbezetting", "/app/kleedkamers", "/app/wedstrijden"];
const TABS_OTHER = ["/app", "/app/veldbezetting", "/app/wedstrijden", "/app/verzoeken"];

const isActive = (pathname: string, href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

/** Open requests that need attention from this user. */
function useOpenRequestCount() {
  const { data, canEdit, me } = useStore();
  return data.requests.filter((r) => r.status === "open" && (canEdit || me.teamIds.includes(r.teamId))).length;
}

function CountBadge({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cn("min-w-5 rounded-full bg-amber-400 px-1.5 text-center text-xs leading-5 font-bold text-amber-950", className)} aria-label={`${n} open`}>
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
      <ApplyTextSize />
      <ClubGate>
        <ToastProvider>
          <ConfirmProvider>
            <DateProvider>
              <Frame>{children}</Frame>
            </DateProvider>
          </ConfirmProvider>
        </ToastProvider>
      </ClubGate>
    </AccountProvider>
  );
}

function SyncBadge() {
  const { source, sync, syncError, canEdit, canRequest } = useStore();
  if (source.kind === "demo") return null;
  if (!canEdit && !canRequest) return <span className="flex items-center gap-1 text-xs text-amber-200"><Eye size={13} /> Alleen lezen</span>;
  if (sync === "saving") return <span className="flex items-center gap-1 text-xs text-brand-100/80"><CloudUpload size={13} className="animate-pulse" /> Bezig met opslaan…</span>;
  if (sync === "error") return <span className="flex items-center gap-1 text-xs text-red-300" title={syncError ?? ""}><AlertCircle size={13} /> Niet opgeslagen</span>;
  return <span className="flex items-center gap-1 text-xs text-brand-100/75"><Check size={13} /> Alles is opgeslagen</span>;
}

function AccountFooter() {
  const { state, signOut, leaveDemo, cloudAvailable, setDemoRole } = useAccount();
  const { data } = useStore();
  return (
    <div className="mt-auto flex flex-col gap-4 pt-4">
      <div className="px-2"><TextSizeControl dark /></div>
      {state.status === "demo" && (
        <div className="rounded-xl bg-white/8 p-3 text-sm text-brand-100/80">
          <label className="mb-2 block">
            <span className="mb-1 block font-semibold text-brand-100">Bekijk de demo als</span>
            <select
              value={state.role === "trainer" ? `trainer:${state.teamIds[0] ?? ""}` : state.role}
              onChange={(e) => {
                const [role, teamId] = e.target.value.split(":");
                setDemoRole(role as Role, teamId ? [teamId] : []);
              }}
              className="h-11 w-full rounded-lg bg-white/10 px-2 text-base text-white focus:outline-none sm:h-9 sm:text-sm [&>optgroup]:text-stone-900 [&>option]:text-stone-900"
            >
              <option value="admin">Wedstrijdsecretaris (beheerder)</option>
              <optgroup label="Trainer van…">
                {data.teams.map((t) => <option key={t.id} value={`trainer:${t.id}`}>{t.name} ({t.trainer})</option>)}
              </optgroup>
              <option value="viewer">Alleen lezen</option>
            </select>
          </label>
          <p>Dit is de demo. Wijzigingen blijven alleen in deze browser bewaard.</p>
          {cloudAvailable && (
            <button onClick={leaveDemo} className="mt-2 flex min-h-11 items-center gap-2 font-semibold text-brand-200 hover:text-white sm:min-h-0">
              <LogIn size={16} /> Inloggen met je club
            </button>
          )}
        </div>
      )}
      {state.status === "club" && (
        <div className="flex flex-col gap-1 px-2">
          <span className="truncate text-sm text-brand-100/75" title={state.email}>{state.email}</span>
          <button onClick={signOut} className="flex min-h-11 items-center gap-2 self-start rounded-lg text-sm font-semibold text-brand-100 hover:text-white sm:min-h-9">
            <LogOut size={16} /> Uitloggen
          </button>
        </div>
      )}
    </div>
  );
}

function NavLink({ item, onNavigate, badge }: { item: NavItem; onNavigate?: () => void; badge?: number }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-medium transition-colors lg:min-h-10 lg:text-sm",
        active ? "bg-white/14 text-white" : "text-brand-100/85 hover:bg-white/8 hover:text-white",
      )}
    >
      <Icon size={20} className={active ? "text-brand-300" : ""} />
      {item.label}
      {!!badge && <CountBadge n={badge} className="ml-auto" />}
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const openRequests = useOpenRequestCount();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Hoofdmenu">
      <NavLink item={HOME} onNavigate={onNavigate} />
      {NAV_GROUPS.map((group) => (
        <div key={group.title} className="mt-4 flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-xs font-semibold tracking-wider text-brand-100/60 uppercase">{group.title}</p>
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} badge={item.href === "/app/verzoeken" ? openRequests : undefined} />
          ))}
        </div>
      ))}
      <div className="my-3 h-px bg-white/10" />
      <Link
        href="/scherm"
        target="_blank"
        className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-medium text-brand-100/85 hover:bg-white/8 hover:text-white lg:min-h-10 lg:text-sm"
      >
        <Tv size={20} /> TV-scherm kantine
      </Link>
    </nav>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { data, canEdit } = useStore();
  const { state, switchClub } = useAccount();
  const openRequests = useOpenRequestCount();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const initials = data.club.shortName.slice(0, 2).toUpperCase();
  const tabs = (canEdit ? TABS_PLANNER : TABS_OTHER).map((href) => ALL_NAV.find((n) => n.href === href)!);
  const moreActive = !tabs.some((t) => isActive(pathname, t.href));
  const moreBadge = tabs.some((t) => t.href === "/app/verzoeken") ? 0 : openRequests;

  const clubCard = (
    <div className="flex items-center gap-3 rounded-xl bg-white/8 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-400 text-sm font-bold text-brand-950">{initials}</div>
      <div className="min-w-0 flex-1">
        {state.status === "club" && state.clubs.length > 1 ? (
          <select
            value={state.active.clubId}
            onChange={(e) => switchClub(e.target.value)}
            className="w-full truncate rounded bg-transparent text-base font-semibold text-white focus:outline-none lg:text-sm [&>option]:text-stone-900"
            aria-label="Wissel van club"
          >
            {state.clubs.map((c) => <option key={c.clubId} value={c.clubId}>{c.name}</option>)}
          </select>
        ) : (
          <p className="truncate text-base font-semibold text-white lg:text-sm">{data.club.name}</p>
        )}
        <p className="truncate text-xs text-brand-100/75">
          {state.status === "club" ? ROLE_LABELS[state.active.role] : state.status === "demo" ? `Demo · ${ROLE_LABELS[state.role]}` : "Demo"}
          {data.club.city ? ` · ${data.club.city}` : ""}
        </p>
        <div className="mt-1"><SyncBadge /></div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="no-print scrollbar-thin sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-5 overflow-y-auto bg-brand-950 p-4 lg:flex">
        <Link href="/" className="px-2 pt-1">
          <Logo light />
        </Link>
        {clubCard}
        <NavLinks />
        <AccountFooter />
      </aside>

      {/* Phone / tablet menu */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col gap-4 overflow-y-auto overscroll-contain bg-brand-950 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <Logo light />
              <button onClick={() => setOpen(false)} className="flex h-11 items-center gap-1.5 rounded-xl px-3 font-semibold text-white hover:bg-white/10">
                <X size={22} /> Sluiten
              </button>
            </div>
            {clubCard}
            <NavLinks onNavigate={() => setOpen(false)} />
            <AccountFooter />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-stone-200 bg-white/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
          <Link href="/app" className="flex min-h-14 min-w-0 items-center gap-2.5">
            <LogoMark size={34} />
            <span className="truncate text-lg font-bold tracking-tight text-stone-900">{data.club.name}</span>
          </Link>
          <button onClick={() => setOpen(true)} className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-stone-300 px-3 font-semibold text-stone-800 hover:bg-stone-50">
            <Menu size={20} /> Menu
          </button>
        </header>

        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pt-6 lg:pb-10">{children}</main>

        {/* Phone tab bar */}
        <nav className="no-print pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white lg:hidden" aria-label="Snelmenu">
          <div className="mx-auto grid max-w-xl grid-cols-5">
            {tabs.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("relative flex min-h-16 flex-col items-center justify-center gap-1 text-[0.72rem] font-semibold tracking-tight", active ? "text-brand-700" : "text-stone-600")}
                >
                  {active && <span className="absolute top-0 h-1 w-10 rounded-b-full bg-brand-600" />}
                  <span className="relative">
                    <Icon size={24} />
                    {item.href === "/app/verzoeken" && <CountBadge n={openRequests} className="absolute -top-1.5 -right-3" />}
                  </span>
                  <span>{item.short}</span>
                </Link>
              );
            })}
            <button
              onClick={() => setOpen(true)}
              className={cn("relative flex min-h-16 flex-col items-center justify-center gap-1 text-[0.72rem] font-semibold tracking-tight", moreActive ? "text-brand-700" : "text-stone-600")}
              aria-label="Meer: open het menu"
            >
              {moreActive && <span className="absolute top-0 h-1 w-10 rounded-b-full bg-brand-600" />}
              <span className="relative">
                <Menu size={24} />
                <CountBadge n={moreBadge} className="absolute -top-1.5 -right-3" />
              </span>
              Meer
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
