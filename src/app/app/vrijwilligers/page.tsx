"use client";

import { HandHeart, Scale, Sparkles, Trash2, UserCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useSelectedDate } from "@/components/app-shell";
import { useToast } from "@/components/toast";
import { Button, Card, CardHeader, cn, CommitInput, DateNavigator, EmptyState, IconButton, PageHeader, Select } from "@/components/ui";
import { CATEGORY_META, DUTY_META } from "@/lib/meta";
import { distributeDuties, generateDuties } from "@/lib/planning";
import { uid } from "@/lib/seed";
import { useLookups, useStore } from "@/lib/store";
import { fmtTime, formatDate } from "@/lib/time";
import type { Duty, DutyRole } from "@/lib/types";

export default function VrijwilligersPage() {
  const { data, update, canEdit } = useStore();
  const lookups = useLookups();
  const toast = useToast();
  const [date, setDate] = useSelectedDate();
  const [hover, setHover] = useState<string | null>(null);

  const duties = data.duties.filter((d) => d.date === date).sort((a, b) => a.start - b.start);
  const open = duties.filter((d) => !d.person && !d.teamId).length;
  const roles = [...new Set(duties.map((d) => d.role))] as DutyRole[];
  const homeMatches = data.matches.filter((m) => m.date === date && m.home && m.status === "gepland").length;
  const nextDutyDay = data.duties.map((d) => d.date).filter((d) => d > date).sort()[0];

  const setDuty = (id: string, patch: Partial<Duty>) =>
    update((d) => ({ ...d, duties: d.duties.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  const generate = () => {
    const created = generateDuties(data, date, () => uid("d"));
    update((d) => ({ ...d, duties: [...d.duties, ...created] }));
    toast(created.length ? `${created.length} diensten aangemaakt` : "Er zijn geen thuiswedstrijden of alle diensten bestaan al", { undo: !!created.length });
  };

  const distribute = () => {
    const result = distributeDuties(data, date);
    update((d) => ({ ...d, duties: d.duties.map((x) => (result.has(x.id) ? { ...x, teamId: result.get(x.id) } : x)) }));
    toast(`${result.size} diensten eerlijk verdeeld over teams`, { undo: true });
  };

  // Season load per team: fairness overview (single series → no legend needed)
  const load = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of data.duties) if (d.teamId) counts.set(d.teamId, (counts.get(d.teamId) ?? 0) + 1);
    return [...counts.entries()].map(([teamId, n]) => ({ team: lookups.team.get(teamId), n })).filter((x) => x.team).sort((a, b) => b.n - a.n);
  }, [data.duties, lookups]);
  const max = Math.max(1, ...load.map((l) => l.n));

  return (
    <>
      <PageHeader
        eyebrow="Vrijwilligers"
        title="Diensten & vrijwilligers"
        description="Wie staat er achter de bar, wie fluit en wie zit op het wedstrijdsecretariaat? Verdeel de diensten eerlijk over de teams en vul de namen in."
        actions={<DateNavigator value={date} onChange={setDate} />}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {canEdit && duties.length > 0 && <Button onClick={generate}><Sparkles size={18} /> Ontbrekende diensten aanmaken</Button>}
        {canEdit && open > 0 && <Button variant="primary" onClick={distribute}><Scale size={18} /> {open} open dienst{open > 1 ? "en" : ""} eerlijk verdelen</Button>}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-4">
          {duties.length === 0 && (
            <Card>
              <EmptyState
                icon={<HandHeart />}
                title="Nog geen diensten op deze dag"
                action={
                  <>
                    {canEdit && homeMatches > 0 && <Button variant="primary" onClick={generate}><Sparkles size={18} /> Diensten aanmaken</Button>}
                    {nextDutyDay && <Button onClick={() => setDate(nextDutyDay)}>Ga naar {formatDate(nextDutyDay, { long: true })}</Button>}
                  </>
                }
              >
                {homeMatches > 0
                  ? "Laat Club Support een rooster maken voor de bar, het wedstrijdsecretariaat en de scheidsrechters, op basis van de thuiswedstrijden van deze dag."
                  : "Op deze dag zijn er geen thuiswedstrijden, dus er zijn geen diensten nodig. Kies een andere dag."}
              </EmptyState>
            </Card>
          )}
          {roles.map((role) => (
            <Card key={role}>
              <CardHeader
                title={`${DUTY_META[role].emoji}  ${DUTY_META[role].label}`}
                subtitle={`${duties.filter((d) => d.role === role && (d.person || d.teamId)).length}/${duties.filter((d) => d.role === role).length} ingevuld`}
              />
              <div className="divide-y divide-stone-100">
                {duties.filter((d) => d.role === role).map((d) => {
                  const match = d.matchId ? data.matches.find((m) => m.id === d.matchId) : undefined;
                  const team = d.teamId ? lookups.team.get(d.teamId) : undefined;
                  const filled = !!(d.person || d.teamId);
                  return (
                    <div key={d.id} className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-2 px-4 py-3 sm:px-5 lg:grid-cols-[120px_1fr_190px_190px_auto]">
                      <div className="lg:contents">
                        <span className="flex items-center gap-2 text-base font-semibold tabular-nums lg:text-sm">
                          {fmtTime(d.start)}–{fmtTime(d.end)}
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold lg:hidden", filled ? "bg-brand-50 text-brand-800" : "bg-red-100 text-red-800")}>{filled ? "Ingevuld" : "Open"}</span>
                        </span>
                        <span className="block truncate text-sm text-stone-600">
                          {match ? `${lookups.team.get(match.teamId)?.name} – ${match.opponent}` : filled ? <span className="hidden text-brand-700 lg:inline">Ingevuld</span> : <span className="hidden font-medium text-red-700 lg:inline">Open dienst</span>}
                        </span>
                      </div>
                      {canEdit && (
                        <IconButton
                          label="Dienst verwijderen"
                          tone="danger"
                          className="lg:order-last"
                          onClick={() => { update((x) => ({ ...x, duties: x.duties.filter((y) => y.id !== d.id) })); toast("Dienst verwijderd", { undo: true }); }}
                        >
                          <Trash2 size={20} />
                        </IconButton>
                      )}
                      <div className="col-span-2 grid gap-2 sm:grid-cols-2 lg:contents">
                        <Select compact value={d.teamId ?? ""} disabled={!canEdit} aria-label="Team dat de dienst draait" onChange={(e) => setDuty(d.id, { teamId: e.target.value || undefined })}>
                          <option value="">Kies een team…</option>
                          {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </Select>
                        <CommitInput
                          compact
                          disabled={!canEdit}
                          aria-label="Naam van de vrijwilliger"
                          placeholder={team ? `Naam (namens ${team.name})` : "Naam van de vrijwilliger"}
                          value={d.person ?? ""}
                          onCommit={(v) => setDuty(d.id, { person: v.trim() || undefined })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>

        <div className="grid content-start gap-4">
          <Card className={cn("p-5", duties.length === 0 && "hidden")}>
            <div className="flex items-center gap-3">
              <div className={cn("rounded-xl p-2.5", open ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600")}><UserCheck size={22} /></div>
              <div>
                <p className="text-3xl font-bold tabular-nums">{duties.length - open}/{duties.length}</p>
                <p className="text-sm text-stone-600">diensten ingevuld · {open} open</p>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Diensten per team" subtitle="Hele seizoen · eerlijk verdeeld?" />
            <div className="space-y-1 p-4" onMouseLeave={() => setHover(null)}>
              {load.length === 0 && <p className="text-sm text-stone-600">Nog geen diensten aan teams toegewezen.</p>}
              {load.map(({ team, n }) => (
                <div key={team!.id} className="relative flex items-center gap-3 rounded-md py-0.5" onMouseEnter={() => setHover(team!.id)}>
                  <span className="w-24 shrink-0 truncate text-sm text-stone-700">{team!.name}</span>
                  <div className="h-5 flex-1">
                    <div className="h-full rounded-r-[4px]" style={{ width: `${(n / max) * 100}%`, backgroundColor: hover === team!.id ? "#13794d" : "#3fae79" }} />
                  </div>
                  <span className="w-6 text-right text-sm text-stone-600 tabular-nums">{n}</span>
                  {hover === team!.id && (
                    <div className="pointer-events-none absolute -top-8 left-24 z-10 rounded-md bg-stone-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow">
                      {team!.name} · {CATEGORY_META[team!.category].label}: {n} dienst{n === 1 ? "" : "en"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
