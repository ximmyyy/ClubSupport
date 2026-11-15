"use client";

import { useEffect, useState } from "react";
import { AccountProvider } from "@/components/account";
import { ClubGate } from "@/components/club-gate";
import { LogoMark } from "@/components/logo";
import { Pitch } from "@/components/pitch";
import { CATEGORY_META } from "@/lib/meta";
import { fieldSlotsForDate, isFieldClosed, sectionsLabel } from "@/lib/planning";
import { useLookups, useStore } from "@/lib/store";
import { cap, fmtTime, formatDate, nowMinutes, todayISO } from "@/lib/time";

export function TvScreen() {
  return (
    <AccountProvider>
      <ClubGate dark>
        <Screen />
      </ClubGate>
    </AccountProvider>
  );
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Screen() {
  const { data } = useStore();
  const lookups = useLookups();
  const clock = useClock();
  const today = todayISO();
  const minutes = nowMinutes();

  // Today, or the next day with home matches
  const matchDay =
    data.matches.some((m) => m.date === today && m.home) ? today
      : data.matches.filter((m) => m.home && m.date > today && m.status !== "gespeeld").map((m) => m.date).sort()[0] ?? today;
  const matches = data.matches.filter((m) => m.date === matchDay && m.home).sort((a, b) => a.kickoff - b.kickoff);
  const slots = fieldSlotsForDate(data, today).filter((s) => s.start <= minutes && minutes < s.end);
  const closures = data.closures.filter((c) => c.date === matchDay);

  return (
    <div className="flex min-h-dvh flex-col bg-brand-950 p-6 text-white lg:p-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <LogoMark size={56} />
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-brand-300 uppercase">Welkom bij</p>
            <h1 className="text-3xl font-extrabold tracking-tight lg:text-5xl">{data.club.name}</h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold tabular-nums lg:text-6xl">{clock.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}</p>
          <p className="text-brand-200">{cap(formatDate(today, { long: true }))}</p>
        </div>
      </header>

      {closures.length > 0 && (
        <div className="mb-6 rounded-2xl bg-red-600 px-6 py-4 text-xl font-semibold">
          ⚠️ {closures.map((c) => `${lookups.field.get(c.fieldId)?.name} afgekeurd (${c.reason})`).join(" · ")}
        </div>
      )}

      <div className="grid flex-1 gap-8 xl:grid-cols-[1fr_minmax(420px,36%)]">
        <section>
          <h2 className="mb-4 text-xl font-semibold text-brand-200">
            {matchDay === today ? "Wedstrijden vandaag" : <span>Wedstrijden {formatDate(matchDay, { long: true })}</span>}
          </h2>
          <div className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
            <table className="w-full text-left text-lg lg:text-2xl">
              <thead className="bg-white/5 text-sm tracking-wider text-brand-200 uppercase">
                <tr>
                  <th className="px-5 py-3">Aftrap</th>
                  <th className="px-5 py-3">Wedstrijd</th>
                  <th className="px-5 py-3">Veld</th>
                  <th className="px-5 py-3">Kleedkamer</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => {
                  const team = lookups.team.get(m.teamId);
                  const homeRoom = data.roomAssignments.find((a) => a.matchId === m.id && a.role === "thuis");
                  const awayRoom = data.roomAssignments.find((a) => a.matchId === m.id && a.role === "uit");
                  const done = matchDay === today && team && minutes > m.kickoff + team.matchDuration;
                  const cancelled = m.status === "afgelast";
                  return (
                    <tr key={m.id} className={`border-t border-white/10 ${done ? "opacity-40" : ""}`}>
                      <td className={`px-5 py-3 font-bold tabular-nums ${cancelled ? "line-through opacity-50" : ""}`}>{fmtTime(m.kickoff)}</td>
                      <td className="px-5 py-3">
                        <span className="mr-3 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: team ? CATEGORY_META[team.category].color : undefined }} />
                        <b>{team?.name}</b> <span className="text-white/70">– {m.opponent}</span>
                        {cancelled && <span className="ml-3 rounded-md bg-red-600 px-2 py-0.5 text-base font-bold">AFGELAST</span>}
                      </td>
                      <td className="px-5 py-3">{m.fieldId ? <>{lookups.field.get(m.fieldId)?.name} <span className="text-base text-white/60">{m.sections && m.sections.length < 4 ? sectionsLabel(m.sections) : ""}</span></> : "–"}</td>
                      <td className="px-5 py-3 text-base lg:text-xl">
                        {homeRoom ? <span className="mr-3">🏠 {lookups.room.get(homeRoom.roomId)?.name.replace("Kleedkamer ", "KK ")}</span> : null}
                        {awayRoom ? <span className="text-white/70">✈️ {lookups.room.get(awayRoom.roomId)?.name.replace("Kleedkamer ", "KK ")}</span> : null}
                        {!homeRoom && !awayRoom && <span className="text-white/40">–</span>}
                      </td>
                    </tr>
                  );
                })}
                {matches.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-white/60">Geen thuiswedstrijden gepland</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-brand-200">Nu op de velden</h2>
          <div className="grid grid-cols-2 gap-3">
            {data.fields.map((f) => (
              <div key={f.id}>
                <p className="mb-1 text-sm font-semibold text-brand-100">{f.name}</p>
                <Pitch
                  className="w-full"
                  closed={isFieldClosed(data.closures, f.id, today)?.reason}
                  occupants={slots.filter((s) => s.fieldId === f.id).map((s) => {
                    const team = s.teamId ? lookups.team.get(s.teamId) : undefined;
                    return { key: s.key, sections: s.sections, title: s.title, subtitle: `tot ${fmtTime(s.end)}`, color: team ? CATEGORY_META[team.category].color : "#78716c", match: s.kind === "wedstrijd" };
                  })}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
      <footer className="mt-8 text-center text-sm text-white/40">Live bijgewerkt via Club Support</footer>
    </div>
  );
}
