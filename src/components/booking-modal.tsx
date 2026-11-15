"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { sectionsLabel } from "@/lib/planning";
import { uid } from "@/lib/seed";
import { fmtTime, formatDate, parseTime, WEEKDAYS, weekdayOf } from "@/lib/time";
import type { Booking, BookingKind } from "@/lib/types";
import { useToast } from "./toast";
import { Button, FormField, Input, Modal, Segmented, Select } from "./ui";

export const SECTION_OPTIONS: { value: string; label: string }[] = [
  { value: "0,1,2,3", label: "Heel veld" },
  { value: "0,1", label: "Half veld (A+B)" },
  { value: "2,3", label: "Half veld (C+D)" },
  { value: "0", label: "Kwart A" },
  { value: "1", label: "Kwart B" },
  { value: "2", label: "Kwart C" },
  { value: "3", label: "Kwart D" },
];

export interface BookingDraft {
  id?: string;
  kind: BookingKind;
  teamId?: string;
  label?: string;
  fieldId: string;
  sections: number[];
  start: number;
  end: number;
  recurring: boolean;
}

export function BookingModal({ open, onClose, draft, date }: { open: boolean; onClose: () => void; draft: BookingDraft | null; date: string }) {
  if (!open || !draft) return null;
  return <BookingForm key={draft.id ?? `${draft.fieldId}-${draft.start}`} onClose={onClose} draft={draft} date={date} />;
}

function BookingForm({ onClose, draft, date }: { onClose: () => void; draft: BookingDraft; date: string }) {
  const { data, update } = useStore();
  const toast = useToast();
  const [form, setForm] = useState(draft);
  const existing = draft.id ? data.bookings.find((b) => b.id === draft.id) : undefined;
  const wd = weekdayOf(date);
  const set = <K extends keyof BookingDraft>(k: K, v: BookingDraft[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    if (form.end <= form.start) return;
    const base: Omit<Booking, "id"> = {
      kind: form.kind,
      teamId: form.teamId || undefined,
      label: form.label || undefined,
      fieldId: form.fieldId,
      sections: form.sections,
      start: form.start,
      end: form.end,
      ...(form.recurring ? { weekday: existing?.weekday ?? wd, exceptions: existing?.exceptions } : { date: existing?.date ?? date }),
    };
    update((d) => ({
      ...d,
      bookings: existing
        ? d.bookings.map((b) => (b.id === existing.id ? { id: b.id, ...base } : b))
        : [...d.bookings, { id: uid("b"), ...base }],
    }));
    toast(existing ? "Reservering bijgewerkt" : "Reservering toegevoegd", { undo: true });
    onClose();
  };

  const skipThisWeek = () => {
    if (!existing) return;
    update((d) => ({
      ...d,
      bookings: d.bookings.map((b) => (b.id === existing.id ? { ...b, exceptions: [...(b.exceptions ?? []), date] } : b)),
    }));
    toast(`Training op ${formatDate(date)} vervalt`, { undo: true });
    onClose();
  };

  const remove = () => {
    if (!existing) return;
    update((d) => ({ ...d, bookings: d.bookings.filter((b) => b.id !== existing.id) }));
    toast(existing.weekday ? "Wekelijkse reeks verwijderd" : "Reservering verwijderd", { undo: true });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? "Reservering bewerken" : "Nieuwe reservering"}
      footer={
        <>
          {existing?.weekday && <Button variant="ghost" onClick={skipThisWeek}>Alleen deze week laten vervallen</Button>}
          {existing && <Button variant="danger" onClick={remove}>{existing.weekday ? "Reeks verwijderen" : "Verwijderen"}</Button>}
          <Button variant="primary" onClick={save} disabled={form.end <= form.start || (form.kind === "training" && !form.teamId)}>
            Opslaan
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Segmented
          value={form.kind}
          onChange={(v) => set("kind", v)}
          options={[{ value: "training", label: "Training" }, { value: "overig", label: "Overig (toernooi, clinic…)" }]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Team">
            <Select value={form.teamId ?? ""} onChange={(e) => set("teamId", e.target.value || undefined)}>
              <option value="">{form.kind === "training" ? "Kies een team…" : "Geen team"}</option>
              {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Omschrijving">
            <Input value={form.label ?? ""} placeholder={form.kind === "training" ? "Optioneel" : "Bijv. Keeperstraining"} onChange={(e) => set("label", e.target.value)} />
          </FormField>
          <FormField label="Veld">
            <Select value={form.fieldId} onChange={(e) => set("fieldId", e.target.value)}>
              {data.fields.map((f) => <option key={f.id} value={f.id}>{f.name} · {f.surface}{f.lit ? "" : " (geen verlichting)"}</option>)}
            </Select>
          </FormField>
          <FormField label="Veldgedeelte">
            <Select value={form.sections.join(",")} onChange={(e) => set("sections", e.target.value.split(",").map(Number))}>
              {SECTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Van">
            <Input type="time" step={900} value={fmtTime(form.start)} onChange={(e) => set("start", parseTime(e.target.value))} />
          </FormField>
          <FormField label="Tot">
            <Input type="time" step={900} value={fmtTime(form.end)} onChange={(e) => set("end", parseTime(e.target.value))} />
          </FormField>
        </div>
        <FormField label="Herhaling">
          <Segmented
            value={form.recurring ? "w" : "o"}
            onChange={(v) => set("recurring", v === "w")}
            options={[
              { value: "w", label: `Elke ${WEEKDAYS[(existing?.weekday ?? wd) - 1]}` },
              { value: "o", label: `Alleen ${formatDate(existing?.date ?? date)}` },
            ]}
          />
        </FormField>
        {form.end <= form.start && <p className="text-sm text-red-600">De eindtijd moet na de begintijd liggen.</p>}
        <p className="text-xs text-stone-500">
          {data.fields.find((f) => f.id === form.fieldId)?.name}, {sectionsLabel(form.sections)}, {fmtTime(form.start)}–{fmtTime(form.end)}
        </p>
      </div>
    </Modal>
  );
}
