"use client";

import { Clock, DoorOpen, Plus, Repeat, Shirt, Trash2, Trophy, User, Users } from "lucide-react";
import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, Checkbox, cn, EmptyState, FormField, Input, Modal, PageHeader, Segmented, Select } from "@/components/ui";
import { CATEGORIES, CATEGORY_META, defaultsForAge, FIELD_NEED_META, teamAge } from "@/lib/meta";
import { uid } from "@/lib/seed";
import { useLookups, useStore } from "@/lib/store";
import { cap, fmtTime, formatDate, todayISO, WEEKDAYS_SHORT } from "@/lib/time";
import type { Category, FieldNeed, Team } from "@/lib/types";

export default function TeamsPage() {
  const { data, canEdit } = useStore();
  const lookups = useLookups();
  const [filter, setFilter] = useState<Category | "alle">("alle");
  const [edit, setEdit] = useState<Partial<Team> | null>(null);
  const today = todayISO();
  const newTeam = () => setEdit({ category: "pupillen", players: 10, roomForTraining: false, ...defaultsForAge(10) });

  const teams = data.teams
    .filter((t) => filter === "alle" || t.category === filter)
    .sort((a, b) => teamAge(a) - teamAge(b) || a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        eyebrow="Club"
        title="Teams"
        description={
          data.teams.length
            ? `${data.teams.length} teams met samen ${data.teams.reduce((n, t) => n + t.players, 0)} spelers.${canEdit ? " Kies een team om het te wijzigen." : ""}`
            : "Alle teams van je club op een rij."
        }
        actions={canEdit && <Button variant="primary" onClick={newTeam}><Plus size={18} /> Team toevoegen</Button>}
      />
      {data.teams.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Shirt />}
            title="Er zijn nog geen teams"
            action={canEdit && <Button variant="primary" onClick={newTeam}><Plus size={18} /> Eerste team toevoegen</Button>}
          >
            Voeg de teams van je club toe, bijvoorbeeld JO11-1 of Heren 1. Bij jeugdteams vult Club Support de veldgrootte en speelduur automatisch in.
          </EmptyState>
        </Card>
      ) : (
        <div className="mb-4">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[{ value: "alle" as const, label: `Alle (${data.teams.length})` }, ...CATEGORIES.filter((c) => data.teams.some((t) => t.category === c)).map((c) => ({ value: c, label: CATEGORY_META[c].label }))]}
          />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {teams.map((t) => {
          const meta = CATEGORY_META[t.category];
          const trainings = data.bookings.filter((b) => b.teamId === t.id && b.kind === "training" && b.weekday).sort((a, b) => a.weekday! - b.weekday!);
          const next = data.matches.filter((m) => m.teamId === t.id && m.date >= today && m.status === "gepland").sort((a, b) => a.date.localeCompare(b.date) || a.kickoff - b.kickoff)[0];
          return (
            <Card key={t.id} className={cn("group overflow-hidden transition-shadow", canEdit && "cursor-pointer hover:shadow-md")} onClick={() => canEdit && setEdit(t)}>
              <div className="h-1.5" style={{ backgroundColor: meta.color }} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: meta.soft, color: meta.text }}>
                      <Shirt size={22} />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-stone-900">{t.name}</p>
                      <p className="text-xs font-medium" style={{ color: meta.text }}>{meta.label}</p>
                    </div>
                  </div>
                  <Badge>{FIELD_NEED_META[t.fieldNeed].label}</Badge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5 text-stone-600"><User size={14} className="text-stone-500" /> {t.trainer}</div>
                  <div className="flex items-center gap-1.5 text-stone-600"><Users size={14} className="text-stone-500" /> {t.players} spelers</div>
                  <div className="flex items-center gap-1.5 text-stone-600"><Clock size={14} className="text-stone-500" /> Wedstrijd {t.matchDuration} min</div>
                  <div className="flex items-center gap-1.5 text-stone-600"><DoorOpen size={14} className="text-stone-500" /> {t.roomForTraining ? "Kleedkamer bij training" : "Geen kleedkamer"}</div>
                </dl>
                <div className="mt-4 border-t border-stone-100 pt-3">
                  <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold tracking-wide text-stone-500 uppercase"><Repeat size={12} /> Trainingen</p>
                  <div className="flex flex-wrap gap-1.5">
                    {trainings.length ? trainings.map((b) => (
                      <span key={b.id} className="rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-700 tabular-nums">
                        <b className="uppercase">{WEEKDAYS_SHORT[b.weekday! - 1]}</b> {fmtTime(b.start)} · {lookups.field.get(b.fieldId)?.name.replace("Veld ", "V")}
                      </span>
                    )) : <span className="text-xs text-stone-500">Geen vaste training</span>}
                  </div>
                </div>
                {next && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-stone-600">
                    <Trophy size={13} className="text-stone-500" />
                    <span>{cap(formatDate(next.date))}</span> {fmtTime(next.kickoff)} · {next.home ? "thuis" : "uit"} vs {next.opponent}
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {edit && <TeamModal initial={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function TeamModal({ initial, onClose }: { initial: Partial<Team>; onClose: () => void }) {
  const { data, update } = useStore();
  const toast = useToast();
  const confirm = useConfirm();
  const [t, setT] = useState(initial);
  const set = <K extends keyof Team>(k: K, v: Team[K]) => setT((x) => ({ ...x, [k]: v }));
  const valid = !!(t.name && t.category && t.fieldNeed && t.matchDuration);

  const onName = (name: string) => {
    const age = teamAge({ name, category: t.category ?? "senioren" } as Team);
    // Suggest KNVB defaults for new teams as you type "JO11-…"
    setT((x) => ({ ...x, name, ...(!x.id && age < 99 ? { ...defaultsForAge(age), category: age >= 13 ? (name.toUpperCase().startsWith("MO") ? "vrouwen" : "junioren") : name.toUpperCase().startsWith("MO") ? "vrouwen" : "pupillen" } : {}) }));
  };

  const save = () => {
    if (!valid) return;
    const full = { trainer: "", players: 0, roomForTraining: false, ...t, id: t.id ?? uid("t") } as Team;
    update((d) => ({ ...d, teams: t.id ? d.teams.map((x) => (x.id === t.id ? full : x)) : [...d.teams, full] }));
    toast(t.id ? "Team bijgewerkt" : "Team toegevoegd", { undo: true });
    onClose();
  };
  const remove = async () => {
    const trainings = data.bookings.filter((b) => b.teamId === t.id).length;
    const matches = data.matches.filter((m) => m.teamId === t.id).length;
    const ok = await confirm({
      title: `${t.name} verwijderen?`,
      text: trainings + matches > 0
        ? `Ook de ${trainings} trainingen en ${matches} wedstrijden van dit team worden verwijderd.`
        : "Het team verdwijnt uit de lijst.",
    });
    if (!ok) return;
    update((d) => {
      const matchIds = new Set(d.matches.filter((m) => m.teamId === t.id).map((m) => m.id));
      return {
        ...d,
        teams: d.teams.filter((x) => x.id !== t.id),
        bookings: d.bookings.filter((b) => b.teamId !== t.id),
        matches: d.matches.filter((m) => m.teamId !== t.id),
        roomAssignments: d.roomAssignments.filter((a) => a.teamId !== t.id && !(a.matchId && matchIds.has(a.matchId))),
        duties: d.duties.filter((x) => !(x.matchId && matchIds.has(x.matchId))).map((x) => (x.teamId === t.id ? { ...x, teamId: undefined } : x)),
        requests: d.requests.filter((r) => r.teamId !== t.id),
      };
    });
    toast("Team en bijbehorende planning verwijderd", { undo: true });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t.id ? `${t.name} wijzigen` : "Team toevoegen"}
      footer={<>{t.id && <Button variant="danger" onClick={remove}><Trash2 size={18} /> Team verwijderen</Button>}<Button variant="primary" onClick={save} disabled={!valid}>Opslaan</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Naam van het team" hint="Bijvoorbeeld JO11-2, MO15-1 of Heren 3">
          <Input value={t.name ?? ""} autoComplete="off" onChange={(e) => onName(e.target.value)} />
        </FormField>
        <FormField label="Categorie">
          <Select value={t.category} onChange={(e) => set("category", e.target.value as Category)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
          </Select>
        </FormField>
        <FormField label="Trainer of leider">
          <Input value={t.trainer ?? ""} onChange={(e) => set("trainer", e.target.value)} />
        </FormField>
        <FormField label="Aantal spelers">
          <Input type="number" inputMode="numeric" min={1} value={t.players ?? ""} onChange={(e) => set("players", Number(e.target.value))} />
        </FormField>
        <FormField label="Veldgrootte bij wedstrijden" hint="Kwart veld voor de jongste jeugd, half veld tot JO12, daarna een heel veld">
          <Select value={t.fieldNeed} onChange={(e) => set("fieldNeed", e.target.value as FieldNeed)}>
            {(Object.keys(FIELD_NEED_META) as FieldNeed[]).map((n) => <option key={n} value={n}>{FIELD_NEED_META[n].label}</option>)}
          </Select>
        </FormField>
        <FormField label="Duur van een wedstrijd" hint="In minuten, speeltijd en rust samen">
          <Input type="number" inputMode="numeric" min={20} step={5} value={t.matchDuration ?? ""} onChange={(e) => set("matchDuration", Number(e.target.value))} />
        </FormField>
      </div>
      <Checkbox className="mt-3" checked={!!t.roomForTraining} onChange={(e) => set("roomForTraining", e.target.checked)} label="Dit team gebruikt een kleedkamer bij trainingen" />
    </Modal>
  );
}
