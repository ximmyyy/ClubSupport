"use client";

import {
  AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, CloudRain, DoorOpen, Gauge, HandHeart, Inbox, LayoutGrid, MapPin, Trophy,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useSelectedDate } from "@/components/app-shell";
import { GettingStarted } from "@/components/getting-started";
import { Pitch } from "@/components/pitch";
import { Card, CardHeader, cn, StatTile } from "@/components/ui";
import { CATEGORY_META } from "@/lib/meta";
import { demandKey, fieldOccupancy, fieldSlotsForDate, findFieldConflicts, isFieldClosed, roomDemandsForDate } from "@/lib/planning";
import { useLookups, useStore } from "@/lib/store";
import { plural } from "@/lib/text";
import { addDays, cap, fmtTime, formatDate, nowMinutes, startOfWeek, todayISO, WEEKDAYS_SHORT } from "@/lib/time";

type Alert = { date: string; href: string; icon: React.ReactNode; text: string; tone: "red" | "amber" };

export default function DashboardPage() {
  const { data, canEdit, me } = useStore();
  const lookups = useLookups();
  const router = useRouter();
  const [, setDate] = useSelectedDate();
  const today = todayISO();
  const now = nowMinutes();

  const go = (date: string, href: string) => {
    setDate(date);
    router.push(href);
  };

  const todaySlots = useMemo(() => fieldSlotsForDate(data, today), [data, today]);
  const week = useMemo(() => {
    const start = startOfWeek(today);
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return { date, occ: fieldOccupancy(data, date), count: fieldSlotsForDate(data, date).length };
    });
  }, [data, today]);

  const alerts = useMemo(() => {
    const list: Alert[] = [];
    const open = data.requests.filter((r) => r.status === "open" && (canEdit || me.teamIds.includes(r.teamId)));
    if (open.length) {
      list.push({ date: today, href: "/app/verzoeken", icon: <Inbox size={16} />, text: canEdit ? `${plural(open.length, "verzoek van een trainer wacht", "verzoeken van trainers wachten")} op goedkeuring` : `${plural(open.length, "verzoek van jou wacht", "verzoeken van jou wachten")} op goedkeuring`, tone: "amber" });
    }
    for (let i = 0; i < 14; i++) {
      const date = addDays(today, i);
      const slots = fieldSlotsForDate(data, date);
      for (const c of findFieldConflicts(slots, data, date)) list.push({ date, href: "/app/veldbezetting", icon: <AlertTriangle size={16} />, text: c.message, tone: "red" });
      const unplanned = data.matches.filter((m) => m.date === date && m.home && m.status === "gepland" && !m.fieldId);
      if (unplanned.length) list.push({ date, href: "/app/wedstrijden", icon: <MapPin size={16} />, text: `${plural(unplanned.length, "thuiswedstrijd", "thuiswedstrijden")} zonder veld`, tone: "amber" });
      const covered = new Set(data.roomAssignments.filter((a) => a.date === date).map(demandKey));
      const noRoom = roomDemandsForDate(data, date).filter((d) => d.matchId && !covered.has(d.key));
      if (noRoom.length) list.push({ date, href: "/app/kleedkamers", icon: <DoorOpen size={16} />, text: `${plural(noRoom.length, "team", "teams")} zonder kleedkamer`, tone: "amber" });
      const openDuties = data.duties.filter((d) => d.date === date && !d.person && !d.teamId);
      if (openDuties.length) list.push({ date, href: "/app/vrijwilligers", icon: <HandHeart size={16} />, text: `${plural(openDuties.length, "open vrijwilligersdienst", "open vrijwilligersdiensten")}`, tone: "amber" });
      for (const c of data.closures.filter((x) => x.date === date)) {
        list.push({ date, href: "/app/veldbezetting", icon: <CloudRain size={16} />, text: `${lookups.field.get(c.fieldId)?.name} afgekeurd: ${c.reason}`, tone: "amber" });
      }
    }
    return list;
  }, [data, today, lookups, canEdit, me.teamIds]);

  const upcoming = data.matches
    .filter((m) => m.date >= today && m.status !== "gespeeld")
    .sort((a, b) => a.date.localeCompare(b.date) || a.kickoff - b.kickoff)
    .slice(0, 7);
  const results = data.matches
    .filter((m) => m.status === "gespeeld")
    .sort((a, b) => b.date.localeCompare(a.date) || b.kickoff - a.kickoff)
    .slice(0, 5);

  const nextWeekendHome = data.matches.filter((m) => m.home && m.status === "gepland" && m.date > today && m.date <= addDays(today, 7)).length;
  const openDuties = data.duties.filter((d) => d.date >= today && d.date <= addDays(today, 7) && !d.person && !d.teamId).length;
  const conflictCount = alerts.filter((a) => a.tone === "red").length;

  // Moment shown on the pitch map: now, the next activity today, or the first activity in the coming week
  const park = (() => {
    if (todaySlots.some((s) => s.start <= now && now < s.end)) return { date: today, at: now, slots: todaySlots, label: `Nu, ${fmtTime(now)}` };
    const later = todaySlots.find((s) => s.start > now);
    if (later) return { date: today, at: later.start, slots: todaySlots, label: `Eerstvolgende activiteit: vandaag om ${fmtTime(later.start)}` };
    for (let i = 1; i <= 7; i++) {
      const date = addDays(today, i);
      const slots = fieldSlotsForDate(data, date);
      if (slots.length) return { date, at: slots[0].start, slots, label: `Eerstvolgende activiteit: ${formatDate(date, { long: true })} om ${fmtTime(slots[0].start)}` };
    }
    return null;
  })();
  const parkDate = park?.date ?? today;
  const shown = park ? park.slots.filter((s) => s.start <= park.at && park.at < s.end) : [];
  const freeFields = data.fields.filter((f) => !shown.some((s) => s.fieldId === f.id) && !isFieldClosed(data.closures, f.id, parkDate));

  // A brand-new club only sees the step-by-step guide, not a wall of empty cards
  const emptyClub = !data.fields.length && !data.teams.length && !data.matches.length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Goedemorgen" : hour < 18 ? "Goedemiddag" : "Goedenavond";

  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-2 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-stone-600">{cap(formatDate(today, { long: true }))}</p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{greeting}, {data.club.shortName} 👋</h1>
        </div>
        <Link href="/scherm" target="_blank" className="hidden text-sm font-semibold text-brand-700 hover:underline md:block">TV-scherm voor de kantine openen →</Link>
      </div>

      <GettingStarted />

      {!emptyClub && (
        <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Vandaag op het park" value={todaySlots.length} sub="trainingen en wedstrijden" icon={<LayoutGrid size={18} />} onClick={() => go(today, "/app/veldbezetting")} />
        <StatTile label="Velden bezet vandaag" value={`${Math.round(fieldOccupancy(data, today) * 100)}%`} sub="van de beschikbare tijd" icon={<Gauge size={18} />} onClick={() => go(today, "/app/veldbezetting")} />
        <StatTile label="Thuiswedstrijden" value={nextWeekendHome} sub="in de komende 7 dagen" icon={<Trophy size={18} />} tone="good" onClick={() => router.push("/app/wedstrijden")} />
        <StatTile
          label="Let op"
          value={conflictCount + openDuties}
          sub={conflictCount + openDuties === 0 ? "Alles is geregeld" : `${conflictCount} dubbele boeking${conflictCount === 1 ? "" : "en"} · ${openDuties} open dienst${openDuties === 1 ? "" : "en"}`}
          icon={conflictCount ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          tone={conflictCount ? "warn" : "good"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="order-2 xl:order-none xl:col-span-2">
          <CardHeader
            title="Op het park"
            subtitle={park ? park.label : "De komende week staat er niets gepland"}
            icon={<MapPin size={18} />}
            action={<button onClick={() => go(parkDate, "/app/veldbezetting")} className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 sm:min-h-0">Bekijk planning</button>}
          />
          {data.fields.length === 0 && <p className="px-5 py-6 text-stone-600">Zodra je velden hebt toegevoegd, zie je hier wie er op het park staat.</p>}
          {freeFields.length > 0 && freeFields.length < data.fields.length && (
            <p className="px-4 pt-4 text-sm text-stone-600 sm:hidden">Vrij: {freeFields.map((f) => f.name).join(", ")}</p>
          )}
          {freeFields.length === data.fields.length && data.fields.length > 0 && <p className="px-4 py-5 text-stone-600 sm:hidden">Alle velden zijn vrij.</p>}
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {data.fields.map((f) => {
              const occ = shown.filter((s) => s.fieldId === f.id);
              const closedNow = isFieldClosed(data.closures, f.id, parkDate);
              return (
                // On phones only fields that are in use (or closed) get a picture; free fields are listed above
                <div key={f.id} className={cn(!occ.length && !closedNow && "hidden sm:block")}>
                  <p className="mb-1 flex justify-between text-sm"><span className="font-medium">{f.name}</span><span className="text-stone-500">{f.surface}</span></p>
                  <Pitch
                    className="w-full"
                    closed={closedNow?.reason}
                    occupants={occ.map((s) => {
                      const team = s.teamId ? lookups.team.get(s.teamId) : undefined;
                      return { key: s.key, sections: s.sections, title: s.title, subtitle: `${fmtTime(s.start)}–${fmtTime(s.end)}`, color: team ? CATEGORY_META[team.category].color : "#78716c", match: s.kind === "wedstrijd" };
                    })}
                  />
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="order-1 xl:order-none">
          <CardHeader title="Dit vraagt aandacht" subtitle="In de komende 14 dagen" icon={<AlertTriangle size={18} />} />
          <ul className="max-h-[520px] divide-y divide-stone-100 overflow-y-auto">
            {alerts.length === 0 && (
              <li className="flex items-center gap-2 px-5 py-6 text-stone-700"><CheckCircle2 className="shrink-0 text-brand-600" size={20} /> Alles is geregeld. Er is niets dat aandacht vraagt.</li>
            )}
            {alerts.map((a, i) => (
              <li key={i}>
                <button onClick={() => go(a.date, a.href)} className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-stone-50">
                  <span className={cn("mt-0.5 rounded-lg p-1.5", a.tone === "red" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700")}>{a.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-stone-500 uppercase">{formatDate(a.date)}</span>
                    <span className="text-base text-stone-900 sm:text-sm">{a.text}</span>
                  </span>
                  <ArrowRight size={16} className="mt-3 text-stone-300" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="order-3 xl:order-none">
          <CardHeader title="Veldbezetting deze week" subtitle="% van de beschikbare veldtijd (doordeweeks 17–22 u, weekend 8:30–17:30)" icon={<Gauge size={18} />} />
          <WeekChart week={week} today={today} onPick={(d) => go(d, "/app/veldbezetting")} />
        </Card>

        <Card className="order-4 xl:order-none">
          <CardHeader title="Komende wedstrijden" icon={<CalendarDays size={18} />} action={<Link href="/app/wedstrijden" className="flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 sm:min-h-0">Bekijk alle</Link>} />
          <ul className="divide-y divide-stone-100">
            {upcoming.length === 0 && <li className="px-5 py-6 text-stone-600">Er staan nog geen wedstrijden gepland.</li>}
            {upcoming.map((m) => {
              const team = lookups.team.get(m.teamId);
              return (
                <li key={m.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <div className="w-16 shrink-0">
                    <p className="text-xs text-stone-500">{cap(formatDate(m.date))}</p>
                    <p className="font-semibold tabular-nums">{fmtTime(m.kickoff)}</p>
                  </div>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: team ? CATEGORY_META[team.category].color : undefined }} />
                  <span className={cn("min-w-0 flex-1 truncate", m.status === "afgelast" && "text-stone-500 line-through")}>
                    <b>{team?.name}</b> {m.home ? "vs" : "@"} {m.opponent}
                  </span>
                  <span className="text-xs text-stone-600">{m.home ? lookups.field.get(m.fieldId ?? "")?.name ?? "–" : "uit"}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="order-5 xl:order-none">
          <CardHeader title="Laatste uitslagen" icon={<Trophy size={18} />} />
          <ul className="divide-y divide-stone-100">
            {results.length === 0 && <li className="px-5 py-6 text-stone-600">Nog geen uitslagen ingevuld.</li>}
            {results.map((m) => {
              const team = lookups.team.get(m.teamId);
              const ours = m.home ? m.scoreHome ?? 0 : m.scoreAway ?? 0;
              const theirs = m.home ? m.scoreAway ?? 0 : m.scoreHome ?? 0;
              const res = ours > theirs ? "W" : ours < theirs ? "V" : "G";
              return (
                <li key={m.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white", res === "W" ? "bg-brand-600" : res === "V" ? "bg-red-500" : "bg-stone-400")} title={res === "W" ? "Gewonnen" : res === "V" ? "Verloren" : "Gelijk"}>
                    {res}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.home ? <><b>{team?.name}</b> – {m.opponent}</> : <>{m.opponent} – <b>{team?.name}</b></>}</span>
                  <span className="font-semibold tabular-nums">{m.scoreHome}–{m.scoreAway}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
        </>
      )}
    </>
  );
}

function WeekChart({ week, today, onPick }: { week: { date: string; occ: number; count: number }[]; today: string; onPick: (d: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const H = 160;
  return (
    <div className="pt-4 pr-5 pb-5 pl-14">
      <div className="relative flex h-[190px] items-end gap-2 border-b border-stone-200" style={{ height: H + 30 }}>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <div key={g} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-stone-100" style={{ bottom: g * H }}>
            <span className="absolute -top-2 right-full mr-1.5 text-xs text-stone-600 tabular-nums">{g * 100}%</span>
          </div>
        ))}
        {week.map((d, i) => (
          <button
            key={d.date}
            onClick={() => onPick(d.date)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="relative flex h-full flex-1 flex-col items-center justify-end"
            aria-label={`${formatDate(d.date, { long: true })}: ${Math.round(d.occ * 100)}% bezet, ${d.count} activiteiten`}
          >
            {hover === i && (
              <span className="absolute z-10 rounded-md bg-stone-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow" style={{ bottom: d.occ * H + 10 }}>
                {Math.round(d.occ * 100)}% · {d.count} activiteiten
              </span>
            )}
            <span
              className="w-full max-w-10 rounded-t-[4px] transition-colors"
              style={{ height: Math.max(2, d.occ * H), backgroundColor: hover === i ? "#10603f" : "#1f935f" }}
            />
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {week.map((d, i) => (
          <span key={d.date} className={cn("flex-1 text-center text-xs uppercase", d.date === today ? "font-bold text-stone-900" : "text-stone-600")}>
            {WEEKDAYS_SHORT[i]}
          </span>
        ))}
      </div>
    </div>
  );
}
