"use client";

import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { useState } from "react";
import { uid } from "@/lib/id";
import { currentSituation, requestConflicts } from "@/lib/requests";
import { useStore } from "@/lib/store";
import { fmtTime, formatDate, parseTime, WEEKDAYS, weekdayOf } from "@/lib/time";
import type { ChangeRequest } from "@/lib/types";
import { SECTION_OPTIONS } from "./booking-modal";
import { useToast } from "./toast";
import { Button, FormField, Input, Modal, Segmented, Select } from "./ui";

export type RequestDraft = Pick<ChangeRequest, "teamId" | "bookingId" | "matchId" | "scope" | "date" | "fieldId" | "sections" | "start" | "end">;

export function RequestModal({ draft, onClose }: { draft: RequestDraft | null; onClose: () => void }) {
  if (!draft) return null;
  return <RequestForm key={`${draft.bookingId ?? draft.matchId ?? "new"}-${draft.start}-${draft.fieldId}`} initial={draft} onClose={onClose} />;
}

function RequestForm({ initial, onClose }: { initial: RequestDraft; onClose: () => void }) {
  const { data, updateRequests, me, source, canEdit } = useStore();
  const toast = useToast();
  const [r, setR] = useState<RequestDraft>(initial);
  const [note, setNote] = useState("");
  const set = <K extends keyof RequestDraft>(k: K, v: RequestDraft[K]) => setR((x) => ({ ...x, [k]: v }));

  const myTeams = canEdit ? data.teams : data.teams.filter((t) => me.teamIds.includes(t.id));
  const team = data.teams.find((t) => t.id === r.teamId);
  const booking = r.bookingId ? data.bookings.find((b) => b.id === r.bookingId) : undefined;
  const isMatch = !!r.matchId;
  const isNew = !r.bookingId && !r.matchId;
  const recurring = !!booking?.weekday || isNew;
  const duration = r.end - r.start;

  const full: ChangeRequest = {
    ...r, id: "preview", note, status: "open",
    createdByName: source.kind === "demo" && me.role === "trainer" ? team?.trainer ?? me.name : me.name,
  };
  const conflicts = requestConflicts(data, full);
  const current = currentSituation(data, full);
  const match = r.matchId ? data.matches.find((m) => m.id === r.matchId) : undefined;
  // A move must actually change something (an "eenmalig" request for a series still has to differ in place or time)
  const unchanged =
    (booking && booking.fieldId === r.fieldId && booking.sections.join() === r.sections.join() && booking.start === r.start && booking.end === r.end) ||
    (match && match.fieldId === r.fieldId && match.sections?.join() === r.sections.join() && match.kickoff === r.start);
  const valid = !!(r.teamId && r.fieldId && r.end > r.start && !unchanged);

  const submit = () => {
    if (!valid) return;
    updateRequests((reqs) => [...reqs, { ...full, id: uid(), createdBy: me.id, createdAt: new Date().toISOString() }]);
    toast("Verzoek verstuurd naar de wedstrijdsecretaris");
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isMatch ? "Andere tijd of veld aanvragen" : isNew ? "Extra training aanvragen" : "Training verplaatsen aanvragen"}
      footer={<Button variant="primary" onClick={submit} disabled={!valid}><Send size={16} /> Verzoek versturen</Button>}
    >
      <div className="grid gap-4">
        {current && <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">{current}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Team">
            <Select value={r.teamId} onChange={(e) => set("teamId", e.target.value)} disabled={!isNew}>
              {myTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Datum">
            <Input type="date" value={r.date} disabled={isMatch} onChange={(e) => e.target.value && set("date", e.target.value)} />
          </FormField>
          <FormField label="Veld">
            <Select value={r.fieldId} onChange={(e) => set("fieldId", e.target.value)}>
              {data.fields.map((f) => <option key={f.id} value={f.id}>{f.name} · {f.surface}{f.lit ? "" : " (geen licht)"}</option>)}
            </Select>
          </FormField>
          <FormField label="Veldgedeelte">
            <Select value={r.sections.join(",")} onChange={(e) => set("sections", e.target.value.split(",").map(Number))}>
              {SECTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FormField>
          <FormField label={isMatch ? "Aftrap" : "Van"}>
            <Input
              type="time"
              step={300}
              value={fmtTime(r.start)}
              onChange={(e) => {
                const start = parseTime(e.target.value);
                setR((x) => ({ ...x, start, end: start + duration }));
              }}
            />
          </FormField>
          {!isMatch && (
            <FormField label="Tot">
              <Input type="time" step={300} value={fmtTime(r.end)} onChange={(e) => set("end", parseTime(e.target.value))} />
            </FormField>
          )}
        </div>
        {recurring && !isMatch && (
          <FormField label="Voor wanneer?">
            <Segmented
              value={r.scope}
              onChange={(v) => set("scope", v)}
              options={[
                { value: "eenmalig", label: `Alleen ${formatDate(r.date)}` },
                { value: "reeks", label: `Elke ${WEEKDAYS[weekdayOf(r.date) - 1]}` },
              ]}
            />
          </FormField>
        )}
        <FormField label="Toelichting voor de wedstrijdsecretaris">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Bijv. schoolreisje, bekerwedstrijd, keeperstraining…"
            className="w-full rounded-lg border border-stone-300 p-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          />
        </FormField>
        {unchanged ? (
          <p className="text-sm text-stone-500">Kies een ander veld, veldgedeelte of tijdstip om een verzoek te kunnen versturen.</p>
        ) : conflicts.length ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="flex items-center gap-1.5 font-medium"><AlertTriangle size={15} /> Let op, dit botst met de planning:</p>
            <ul className="mt-1 ml-5 list-disc">{conflicts.map((c) => <li key={c}>{c}</li>)}</ul>
            <p className="mt-1 text-xs">Je kunt het verzoek toch versturen; de wedstrijdsecretaris beslist.</p>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-brand-700"><CheckCircle2 size={15} /> Dit plekje is vrij.</p>
        )}
      </div>
    </Modal>
  );
}
