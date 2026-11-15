"use client";

import { Ban, CalendarDays, ClipboardCopy, DoorOpen, FileUp, MapPin, Plus, Sparkles, Trophy, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useSelectedDate } from "@/components/app-shell";
import { MatchModal } from "@/components/match-modal";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, cn, EmptyState, Modal, PageHeader, Segmented } from "@/components/ui";
import { CATEGORY_META, ROOM_ROLE_META } from "@/lib/meta";
import { autoAssignRooms, autoPlanMatchFields, demandKey, generateDuties, optimizeKickoffs, roomDemandsForDate, sectionsLabel } from "@/lib/planning";
import { uid } from "@/lib/seed";
import { useLookups, useStore } from "@/lib/store";
import { cap, fmtTime, formatDate, parseTime, todayISO } from "@/lib/time";
import type { AppData, Match } from "@/lib/types";

export default function WedstrijdenPage() {
  const { data, update } = useStore();
  const lookups = useLookups();
  const toast = useToast();
  const [date, setDate] = useSelectedDate();
  const [tab, setTab] = useState<"programma" | "uitslagen">("programma");
  const [edit, setEdit] = useState<Partial<Match> | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const today = todayISO();

  const days = useMemo(() => {
    const set = new Set(data.matches.filter((m) => (tab === "programma" ? m.date >= today : m.status === "gespeeld")).map((m) => m.date));
    return [...set].sort((a, b) => (tab === "programma" ? a.localeCompare(b) : b.localeCompare(a)));
  }, [data.matches, tab, today]);

  const activeDay = days.includes(date) ? date : days[0];
  const matches = data.matches
    .filter((m) => m.date === activeDay)
    .sort((a, b) => a.kickoff - b.kickoff || lookups.team.get(a.teamId)!.name.localeCompare(lookups.team.get(b.teamId)!.name));
  const home = matches.filter((m) => m.home);
  const roomGaps = activeDay
    ? (() => {
        const covered = new Set(data.roomAssignments.filter((a) => a.date === activeDay).map(demandKey));
        return roomDemandsForDate(data, activeDay).filter((d) => d.matchId && !covered.has(d.key)).length;
      })()
    : 0;

  const toggleCancel = (m: Match) => {
    const cancel = m.status !== "afgelast";
    update((d) => ({
      ...d,
      matches: d.matches.map((x) => (x.id === m.id ? { ...x, status: cancel ? "afgelast" : "gepland" } : x)),
      roomAssignments: cancel ? d.roomAssignments.filter((a) => a.matchId !== m.id) : d.roomAssignments,
    }));
    toast(cancel ? `${lookups.team.get(m.teamId)?.name} afgelast, veld en kleedkamers vrijgegeven` : "Wedstrijd weer ingepland", { undo: true });
  };

  const copyProgram = async () => {
    if (!activeDay) return;
    const lines = [`*Programma ${formatDate(activeDay, { long: true })}* – ${data.club.name}`, ""];
    for (const m of matches) {
      const team = lookups.team.get(m.teamId)?.name;
      const field = m.fieldId ? ` · ${lookups.field.get(m.fieldId)?.name}` : "";
      const room = data.roomAssignments.find((a) => a.matchId === m.id && a.role === "thuis");
      const roomTxt = room ? ` · ${lookups.room.get(room.roomId)?.name}` : "";
      const status = m.status === "afgelast" ? " ❌ AFGELAST" : "";
      lines.push(`${fmtTime(m.kickoff)}  ${m.home ? `${team} – ${m.opponent}` : `${m.opponent} – ${team}`}${m.home ? field + roomTxt : " (uit)"}${status}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast("Programma gekopieerd");
    } catch {
      toast("Kopiëren lukte niet in deze browser");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Competitie"
        title="Wedstrijden"
        description="Het wedstrijdprogramma, met velden, kleedkamers en scheidsrechters op één plek."
        actions={
          <>
            <Button onClick={() => setImportOpen(true)}><FileUp size={16} /> Programma importeren</Button>
            <Button variant="primary" onClick={() => setEdit({ date: activeDay ?? today, home: true, status: "gepland", kickoff: 600 })}><Plus size={16} /> Wedstrijd</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={tab} onChange={setTab} options={[{ value: "programma", label: "Programma" }, { value: "uitslagen", label: "Uitslagen" }]} />
        <div className="scrollbar-thin flex gap-2 overflow-x-auto">
          {days.map((d) => (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                d === activeDay ? "border-brand-600 bg-brand-600 text-white" : "border-stone-200 bg-white text-stone-700 hover:border-stone-300",
              )}
            >
              {cap(formatDate(d))} <span className="opacity-70">· {data.matches.filter((m) => m.date === d).length}</span>
            </button>
          ))}
        </div>
      </div>

      {!activeDay ? (
        <Card><EmptyState icon={<Trophy />} title={tab === "programma" ? "Geen komende wedstrijden" : "Nog geen uitslagen"}>Voeg wedstrijden toe of importeer het programma.</EmptyState></Card>
      ) : (
        <>
          {tab === "programma" && home.length > 0 && (
            <Card className="mb-4 overflow-hidden">
              <div className="grass flex flex-col gap-4 p-5 text-white md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-brand-100"><Sparkles size={16} /> Wedstrijddag-assistent</p>
                  <p className="mt-1 text-xl font-bold">{cap(formatDate(activeDay, { long: true }))}: {home.filter((m) => m.status === "gepland").length} thuiswedstrijden</p>
                  <p className="text-sm text-white/80">
                    {home.filter((m) => m.status === "gepland" && !m.fieldId).length} zonder veld ·{" "}
                    {roomGaps} team(s) zonder kleedkamer
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={copyProgram}><ClipboardCopy size={16} /> Kopieer programma</Button>
                  <Button onClick={() => setPlanOpen(true)} className="border-0 bg-white text-brand-800 hover:bg-brand-50"><Wand2 size={16} /> Plan de hele dag</Button>
                </div>
              </div>
            </Card>
          )}

          <Card className="divide-y divide-stone-100">
            {matches.map((m) => {
              const team = lookups.team.get(m.teamId);
              const meta = team ? CATEGORY_META[team.category] : undefined;
              const rooms = data.roomAssignments.filter((a) => a.matchId === m.id);
              const cancelled = m.status === "afgelast";
              return (
                <div key={m.id} className={cn("flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center", cancelled && "bg-stone-50")}>
                  <div className="flex items-center gap-4 md:w-[45%]">
                    <div className="w-14 shrink-0 text-center">
                      <p className={cn("text-lg font-bold tabular-nums", cancelled && "text-stone-400 line-through")}>{fmtTime(m.kickoff)}</p>
                      <p className={cn("text-[11px] font-semibold uppercase", m.home ? "text-brand-700" : "text-orange-700")}>{m.home ? "Thuis" : "Uit"}</p>
                    </div>
                    <button onClick={() => setEdit(m)} className="min-w-0 text-left">
                      <p className={cn("flex items-center gap-2 font-semibold text-stone-900", cancelled && "text-stone-400")}>
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta?.color }} />
                        <span className="truncate">{m.home ? `${team?.name} – ${m.opponent}` : `${m.opponent} – ${team?.name}`}</span>
                      </p>
                      <p className="text-sm text-stone-500">{meta?.label}{m.referee ? ` · scheids: ${m.referee}` : ""}</p>
                    </button>
                  </div>
                  <div className="flex flex-1 flex-wrap items-center gap-2 text-sm">
                    {m.status === "gespeeld" ? (
                      <span className="rounded-lg bg-stone-900 px-3 py-1 font-bold text-white tabular-nums">{m.scoreHome ?? "–"} – {m.scoreAway ?? "–"}</span>
                    ) : cancelled ? (
                      <Badge className="bg-red-50 text-red-700"><Ban size={12} /> Afgelast</Badge>
                    ) : m.home ? (
                      <>
                        {m.fieldId ? (
                          <Badge className="bg-brand-50 text-brand-800"><MapPin size={12} /> {lookups.field.get(m.fieldId)?.name} · {sectionsLabel(m.sections ?? [])}</Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-800"><MapPin size={12} /> Geen veld</Badge>
                        )}
                        {rooms.map((r) => (
                          <Badge key={r.id} color={ROOM_ROLE_META[r.role].color} soft={ROOM_ROLE_META[r.role].soft}>
                            {ROOM_ROLE_META[r.role].label}: {lookups.room.get(r.roomId)?.name.replace("Kleedkamer", "KK").replace("Scheidsrechters", "Scheids")}
                          </Badge>
                        ))}
                      </>
                    ) : (
                      <span className="text-stone-500">Uitwedstrijd</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {m.status !== "gespeeld" && (
                      <Button size="sm" variant="ghost" onClick={() => toggleCancel(m)}>{cancelled ? "Herstellen" : "Afgelasten"}</Button>
                    )}
                    <Button size="sm" onClick={() => setEdit(m)}>Bewerken</Button>
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}

      <MatchModal match={edit} onClose={() => setEdit(null)} />
      {planOpen && activeDay && <PlanDayModal date={activeDay} onClose={() => setPlanOpen(false)} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </>
  );
}

function PlanDayModal({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, update } = useStore();
  const toast = useToast();
  const [kickoffs, setKickoffs] = useState(false);
  const [rooms, setRooms] = useState(true);
  const [duties, setDuties] = useState(true);

  const run = () => {
    let next: AppData = data;
    const report: string[] = [];
    if (kickoffs) {
      const { updates, failed } = optimizeKickoffs(next, date);
      next = { ...next, matches: next.matches.map((m) => (updates.has(m.id) ? { ...m, ...updates.get(m.id) } : m)) };
      report.push(`${updates.size} aftraptijden gepland${failed.length ? ` (${failed.length} passen niet)` : ""}`);
    } else {
      const { updates, failed } = autoPlanMatchFields(next, date);
      next = { ...next, matches: next.matches.map((m) => (updates.has(m.id) ? { ...m, ...updates.get(m.id) } : m)) };
      report.push(`${updates.size} velden ingedeeld${failed.length ? ` (${failed.length} passen niet)` : ""}`);
    }
    if (rooms) {
      const { assignments, unassigned } = autoAssignRooms(next, date);
      next = { ...next, roomAssignments: [...next.roomAssignments.filter((a) => a.date !== date), ...assignments] };
      report.push(`${assignments.length} kleedkamers${unassigned.length ? ` (${unassigned.length} tekort)` : ""}`);
    }
    if (duties) {
      const created = generateDuties(next, date, () => uid("d"));
      next = { ...next, duties: [...next.duties, ...created] };
      report.push(`${created.length} nieuwe diensten`);
    }
    const final = next;
    update(() => final);
    toast(report.join(" · "), { undo: true });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Plan ${formatDate(date, { long: true })}`} footer={<Button variant="primary" onClick={run}><Wand2 size={16} /> Uitvoeren</Button>}>
      <div className="grid gap-3">
        <PlanOption checked={kickoffs} onChange={setKickoffs} title="Aftraptijden opnieuw bepalen">
          Jongste teams eerst, elke wedstrijd op het vroegst beschikbare veld, rekening houdend met het aantal kleedkamers. Zonder dit vinkje blijven de aftraptijden staan en zoeken we alleen een vrij veld.
        </PlanOption>
        <PlanOption checked={rooms} onChange={setRooms} title="Kleedkamers indelen">
          Thuis, uit en scheidsrechter, inclusief schoonmaaktijd tussen wissels. Bestaande indeling van deze dag wordt vervangen.
        </PlanOption>
        <PlanOption checked={duties} onChange={setDuties} title="Vrijwilligersdiensten aanmaken">
          Bardiensten, wedstrijdsecretariaat, veld opbouwen en een scheidsrechter per thuiswedstrijd.
        </PlanOption>
        <p className="text-xs text-stone-500">Alles is ongedaan te maken via de melding rechtsonder.</p>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const { data, update } = useStore();
  const toast = useToast();
  const example = "2026-11-28;09:00;Zwaluwen JO9-1;SV Zuidwijk JO9-2\n2026-11-28;10:30;VV Heidebloem JO11-1;Zwaluwen JO11-1";
  const [text, setText] = useState("");

  const parsed = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [date, time, homeTeam, awayTeam] = line.split(/[;\t,]/).map((s) => s?.trim());
      const match = (name?: string) => {
        const n = name?.toLowerCase() ?? "";
        return data.teams.find((t) => n.endsWith(` ${t.name.toLowerCase()}`) && n.includes(data.club.shortName.toLowerCase()));
      };
      const homeOwn = match(homeTeam);
      const awayOwn = match(awayTeam);
      const team = homeOwn ?? awayOwn;
      const ok = !!(team && /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") && /^\d{1,2}:\d{2}$/.test(time ?? ""));
      return { line, ok, date, kickoff: time ? parseTime(time) : 0, team, home: !!homeOwn, opponent: (homeOwn ? awayTeam : homeTeam) ?? "" };
    });

  const valid = parsed.filter((p) => p.ok);
  const importAll = () => {
    const created: Match[] = valid.map((p) => ({ id: uid("m"), teamId: p.team!.id, opponent: p.opponent, date: p.date!, kickoff: p.kickoff, home: p.home, status: "gepland" }));
    update((d) => ({ ...d, matches: [...d.matches, ...created] }));
    toast(`${created.length} wedstrijden geïmporteerd`, { undo: true });
    onClose();
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Programma importeren"
      footer={<Button variant="primary" disabled={!valid.length} onClick={importAll}>{valid.length} wedstrijd(en) importeren</Button>}
    >
      <p className="mb-3 text-sm text-stone-600">
        Plak het programma uit Sportlink, de KNVB-app of Excel. Eén wedstrijd per regel: <code className="rounded bg-stone-100 px-1">datum;tijd;thuisteam;uitteam</code>. We herkennen je eigen teams aan de clubnaam <b>{data.club.shortName}</b>.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={example}
        rows={7}
        className="w-full rounded-lg border border-stone-300 p-3 font-mono text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
      />
      <button className="mt-1 text-xs font-medium text-brand-700" onClick={() => setText(example)}>Voorbeeld invullen</button>
      {parsed.length > 0 && (
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
          {parsed.map((p, i) => (
            <li key={i} className={cn("flex items-center gap-2 rounded-lg px-2 py-1", p.ok ? "bg-brand-50" : "bg-red-50")}>
              {p.ok ? <CalendarDays size={14} className="text-brand-700" /> : <DoorOpen size={14} className="text-red-600" />}
              {p.ok ? (
                <span>{formatDate(p.date!)} {fmtTime(p.kickoff)} · <b>{p.team!.name}</b> {p.home ? "thuis" : "uit"} tegen {p.opponent}</span>
              ) : (
                <span className="text-red-700">Niet herkend: {p.line}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function PlanOption({ checked, onChange, title, children }: { checked: boolean; onChange: (v: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer gap-3 rounded-xl border p-3", checked ? "border-brand-300 bg-brand-50/60" : "border-stone-200")}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 accent-brand-600" />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="text-sm text-stone-500">{children}</span>
      </span>
    </label>
  );
}
