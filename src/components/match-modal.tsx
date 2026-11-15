"use client";

import { Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { FIELD_NEED_META } from "@/lib/meta";
import { fieldSlotsForDate, findFreePlacement } from "@/lib/planning";
import { uid } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { fmtTime, parseTime } from "@/lib/time";
import type { Match, MatchStatus } from "@/lib/types";
import { SECTION_OPTIONS } from "./booking-modal";
import { useConfirm } from "./confirm";
import { useToast } from "./toast";
import { Button, FormField, Input, Modal, Segmented, Select } from "./ui";

export function MatchModal({ match, onClose }: { match: Partial<Match> | null; onClose: () => void }) {
  if (!match) return null;
  return <MatchForm key={match.id ?? "new"} initial={match} onClose={onClose} />;
}

function MatchForm({ initial, onClose }: { initial: Partial<Match>; onClose: () => void }) {
  const { data, update } = useStore();
  const toast = useToast();
  const confirm = useConfirm();
  const [m, setM] = useState<Partial<Match>>({ home: true, status: "gepland", kickoff: 600, ...initial });
  const [hint, setHint] = useState<string | null>(null);
  const set = <K extends keyof Match>(k: K, v: Match[K]) => setM((x) => ({ ...x, [k]: v }));
  const team = data.teams.find((t) => t.id === m.teamId);
  const valid = !!(m.teamId && m.opponent && m.date && m.kickoff != null);

  const findField = () => {
    if (!team || !m.date || m.kickoff == null) return;
    const slots = fieldSlotsForDate(data, m.date).filter((s) => !(s.source === "match" && s.id === m.id));
    const place = findFreePlacement(slots, data, m.date, team.fieldNeed, m.kickoff, m.kickoff + team.matchDuration, data.club.fieldBuffer);
    if (place) {
      setM((x) => ({ ...x, ...place }));
      setHint(`Vrij: ${data.fields.find((f) => f.id === place.fieldId)?.name}`);
    } else setHint("Geen vrij veld gevonden op dit tijdstip. Probeer een andere aftraptijd.");
  };

  const save = () => {
    if (!valid) return;
    const full: Match = {
      id: m.id ?? uid("m"),
      teamId: m.teamId!, opponent: m.opponent!, date: m.date!, kickoff: m.kickoff!, home: !!m.home,
      status: m.status ?? "gepland",
      fieldId: m.home ? m.fieldId : undefined,
      sections: m.home ? m.sections : undefined,
      referee: m.referee, scoreHome: m.scoreHome, scoreAway: m.scoreAway,
    };
    update((d) => ({
      ...d,
      matches: m.id ? d.matches.map((x) => (x.id === m.id ? full : x)) : [...d.matches, full],
      // Cancelled matches release their changing rooms
      roomAssignments: full.status === "afgelast" ? d.roomAssignments.filter((a) => a.matchId !== full.id) : d.roomAssignments,
    }));
    toast(m.id ? "Wedstrijd bijgewerkt" : "Wedstrijd toegevoegd", { undo: true });
    onClose();
  };

  const remove = async () => {
    const ok = await confirm({
      title: "Wedstrijd verwijderen?",
      text: `${team?.name ?? "De wedstrijd"} tegen ${m.opponent} verdwijnt uit het programma, samen met de kleedkamers en diensten die erbij horen. Gaat de wedstrijd alleen niet door? Kies dan "Afgelast".`,
    });
    if (!ok) return;
    update((d) => ({
      ...d,
      matches: d.matches.filter((x) => x.id !== m.id),
      requests: d.requests.filter((r) => r.matchId !== m.id),
      roomAssignments: d.roomAssignments.filter((a) => a.matchId !== m.id),
      duties: d.duties.filter((x) => x.matchId !== m.id),
    }));
    toast("Wedstrijd verwijderd", { undo: true });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={m.id ? "Wedstrijd wijzigen" : "Wedstrijd toevoegen"}
      footer={
        <>
          {m.id && <Button variant="danger" onClick={remove}><Trash2 size={18} /> Verwijderen</Button>}
          <Button variant="primary" onClick={save} disabled={!valid}>Opslaan</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Segmented value={m.home ? "h" : "a"} onChange={(v) => set("home", v === "h")} options={[{ value: "h", label: "Thuis" }, { value: "a", label: "Uit" }]} />
          <Segmented<MatchStatus>
            value={m.status ?? "gepland"}
            onChange={(v) => set("status", v)}
            options={[{ value: "gepland", label: "Gepland" }, { value: "afgelast", label: "Afgelast" }, { value: "gespeeld", label: "Gespeeld" }]}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Team" hint={team ? `${FIELD_NEED_META[team.fieldNeed].label} · ${team.matchDuration} min veldtijd` : undefined}>
            <Select value={m.teamId ?? ""} onChange={(e) => set("teamId", e.target.value)}>
              <option value="">Kies een team…</option>
              {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Tegenstander">
            <Input value={m.opponent ?? ""} onChange={(e) => set("opponent", e.target.value)} placeholder="Bijv. VV Rietland JO11-3" />
          </FormField>
          <FormField label="Datum">
            <Input type="date" value={m.date ?? ""} onChange={(e) => set("date", e.target.value)} />
          </FormField>
          <FormField label="Aftrap">
            <Input type="time" step={300} value={fmtTime(m.kickoff ?? 600)} onChange={(e) => set("kickoff", parseTime(e.target.value))} />
          </FormField>
        </div>
        {m.home && (
          <div className="rounded-xl bg-stone-50 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Veld">
                <Select value={m.fieldId ?? ""} onChange={(e) => set("fieldId", e.target.value || undefined)}>
                  <option value="">Nog niet ingedeeld</option>
                  {data.fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Select>
              </FormField>
              <FormField label="Veldgedeelte">
                <Select value={(m.sections ?? []).join(",")} onChange={(e) => set("sections", e.target.value ? e.target.value.split(",").map(Number) : undefined)}>
                  <option value="">–</option>
                  {SECTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </FormField>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={findField} disabled={!team || !m.date}><Wand2 size={14} /> Zoek vrij veld</Button>
              {hint && <span className="text-sm text-stone-600">{hint}</span>}
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Scheidsrechter">
            <Input value={m.referee ?? ""} onChange={(e) => set("referee", e.target.value)} placeholder="Naam of 'KNVB'" />
          </FormField>
          {m.status === "gespeeld" && (
            <FormField label="Uitslag (thuis – uit)">
              <div className="flex items-center gap-2">
                <Input type="number" min={0} value={m.scoreHome ?? ""} onChange={(e) => set("scoreHome", e.target.value === "" ? undefined : Number(e.target.value))} />
                <span>–</span>
                <Input type="number" min={0} value={m.scoreAway ?? ""} onChange={(e) => set("scoreAway", e.target.value === "" ? undefined : Number(e.target.value))} />
              </div>
            </FormField>
          )}
        </div>
      </div>
    </Modal>
  );
}
