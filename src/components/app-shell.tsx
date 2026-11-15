"use client";

import {
  CalendarDays, DoorOpen, HandHeart, LayoutDashboard, LayoutGrid, Menu, Settings, Tv, Users, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { todayISO } from "@/lib/time";
import { Logo, LogoMark } from "./logo";
import { ToastProvider } from "./toast";
import { cn } from "./ui";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, mobile: true },
  { href: "/app/veldbezetting", label: "Veldbezetting", icon: LayoutGrid, mobile: true },
  { href: "/app/kleedkamers", label: "Kleedkamers", icon: DoorOpen, mobile: true },
  { href: "/app/wedstrijden", label: "Wedstrijden", icon: CalendarDays, mobile: true },
  { href: "/app/teams", label: "Teams", icon: Users, mobile: false },
  { href: "/app/vrijwilligers", label: "Vrijwilligers", icon: HandHeart, mobile: true },
  { href: "/app/instellingen", label: "Instellingen", icon: Settings, mobile: false },
] as const;

const DateContext = createContext<[string, (d: string) => void]>(["", () => {}]);
export const useSelectedDate = () => useContext(DateContext);

function DateProvider({ children }: { children: React.ReactNode }) {
  const state = useState(todayISO);
  return <DateContext.Provider value={state}>{children}</DateContext.Provider>;
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex animate-pulse items-center gap-3 text-stone-500">
        <LogoMark size={36} /> Club Support laden…
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider fallback={<Loading />}>
      <ToastProvider>
        <DateProvider>
          <Frame>{children}</Frame>
        </DateProvider>
      </ToastProvider>
    </StoreProvider>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
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
  const { data } = useStore();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const initials = data.club.shortName.slice(0, 2).toUpperCase();

  const clubCard = (
    <div className="flex items-center gap-3 rounded-xl bg-white/6 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-400 text-sm font-bold text-brand-950">{initials}</div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{data.club.name}</p>
        <p className="truncate text-xs text-brand-100/60">{data.club.city} · voetbal</p>
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
        <p className="mt-auto px-2 text-xs text-brand-100/40">Demo-omgeving · gegevens blijven in deze browser</p>
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
          {NAV.filter((n) => n.mobile).map((item) => {
            const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-brand-700" : "text-stone-500")}>
                <Icon size={20} />
                {item.label.replace("Veldbezetting", "Velden").replace("Vrijwilligers", "Diensten")}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
