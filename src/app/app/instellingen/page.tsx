"use client";

import { Download, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { MembersCard } from "@/components/members-card";
import { useToast } from "@/components/toast";
import { Button, Card, CardHeader, FormField, Input, PageHeader, Select } from "@/components/ui";
import { remapIds } from "@/lib/repository";
import { uid } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { todayISO } from "@/lib/time";
import type { AppData, Club, Field, Room } from "@/lib/types";

export default function InstellingenPage() {
  const { data, update, reset, replace, source, canEdit } = useStore();
  const cloud = source.kind === "cloud";
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const setClub = <K extends keyof Club>(k: K, v: Club[K]) => update((d) => ({ ...d, club: { ...d.club, [k]: v } }));
  const setField = (id: string, patch: Partial<Field>) => update((d) => ({ ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  const setRoom = (id: string, patch: Partial<Room>) => update((d) => ({ ...d, rooms: d.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  const removeField = (id: string) => {
    update((d) => ({
      ...d,
      fields: d.fields.filter((f) => f.id !== id),
      bookings: d.bookings.filter((b) => b.fieldId !== id),
      matches: d.matches.map((m) => (m.fieldId === id ? { ...m, fieldId: undefined, sections: undefined } : m)),
      closures: d.closures.filter((c) => c.fieldId !== id),
    }));
    toast("Veld verwijderd", { undo: true });
  };
  const removeRoom = (id: string) => {
    update((d) => ({ ...d, rooms: d.rooms.filter((r) => r.id !== id), roomAssignments: d.roomAssignments.filter((a) => a.roomId !== id) }));
    toast("Kleedkamer verwijderd", { undo: true });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clubsupport-${data.club.shortName.toLowerCase()}-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as AppData;
      if (parsed.version !== 1 || !Array.isArray(parsed.teams)) throw new Error("bad");
      replace(cloud ? { ...remapIds(parsed), club: data.club } : parsed);
      toast("Gegevens geïmporteerd", { undo: true });
    } catch {
      toast("Dit bestand is geen geldige Club Support-export");
    }
  };

  return (
    <>
      <PageHeader eyebrow="Beheer" title="Instellingen" description="Clubgegevens, velden, kleedkamers, planningsregels en leden." />
      {!canEdit && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Alleen beheerders en planners kunnen instellingen wijzigen. Vraag een beheerder als je meer rechten nodig hebt.</p>}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Club" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <FormField label="Naam"><Input value={data.club.name} onChange={(e) => setClub("name", e.target.value)} /></FormField>
            <FormField label="Korte naam" hint="Wordt gebruikt om je teams te herkennen bij import"><Input value={data.club.shortName} onChange={(e) => setClub("shortName", e.target.value)} /></FormField>
            <FormField label="Plaats"><Input value={data.club.city} onChange={(e) => setClub("city", e.target.value)} /></FormField>
            <FormField label="Sport" hint="Hockey, korfbal en handbal volgen">
              <Select value="voetbal" disabled><option value="voetbal">Voetbal</option></Select>
            </FormField>
          </div>
        </Card>

        <Card>
          <CardHeader title="Planningsregels" subtitle="Gebruikt door de automatische planners" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <FormField label="Kleedkamer vóór aftrap (min)"><Input type="number" min={0} step={5} value={data.club.roomBefore} onChange={(e) => setClub("roomBefore", Number(e.target.value))} /></FormField>
            <FormField label="Kleedkamer na afloop (min)"><Input type="number" min={0} step={5} value={data.club.roomAfter} onChange={(e) => setClub("roomAfter", Number(e.target.value))} /></FormField>
            <FormField label="Schoonmaaktijd tussen wissels (min)"><Input type="number" min={0} step={5} value={data.club.roomBuffer} onChange={(e) => setClub("roomBuffer", Number(e.target.value))} /></FormField>
            <FormField label="Wisseltijd op het veld (min)"><Input type="number" min={0} step={5} value={data.club.fieldBuffer} onChange={(e) => setClub("fieldBuffer", Number(e.target.value))} /></FormField>
            <FormField label="Kleedkamer vanaf leeftijd" hint="Jongere teams komen omgekleed (bijv. JO8/JO9)">
              <Input type="number" min={6} max={20} value={data.club.roomsFromAge} onChange={(e) => setClub("roomsFromAge", Number(e.target.value))} />
            </FormField>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Velden"
            subtitle="Elk veld is verdeeld in vier kwarten (A–D)"
            action={<Button size="sm" onClick={() => update((d) => ({ ...d, fields: [...d.fields, { id: uid("f"), name: `Veld ${d.fields.length + 1}`, surface: "kunstgras", lit: true }] }))}><Plus size={14} /> Veld</Button>}
          />
          <div className="divide-y divide-stone-100">
            {data.fields.map((f) => (
              <div key={f.id} className="grid grid-cols-[1fr_130px_auto_32px] items-center gap-2 px-5 py-2.5">
                <Input className="h-9" value={f.name} onChange={(e) => setField(f.id, { name: e.target.value })} />
                <Select className="h-9" value={f.surface} onChange={(e) => setField(f.id, { surface: e.target.value as Field["surface"] })}>
                  <option value="kunstgras">Kunstgras</option>
                  <option value="natuurgras">Natuurgras</option>
                </Select>
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.lit} onChange={(e) => setField(f.id, { lit: e.target.checked })} className="accent-brand-600" /> Licht</label>
                <button onClick={() => removeField(f.id)} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label={`${f.name} verwijderen`}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Kleedkamers"
            action={<Button size="sm" onClick={() => update((d) => ({ ...d, rooms: [...d.rooms, { id: uid("k"), name: `Kleedkamer ${d.rooms.filter((r) => r.kind === "team").length + 1}`, capacity: 18, kind: "team" }] }))}><Plus size={14} /> Kleedkamer</Button>}
          />
          <div className="divide-y divide-stone-100">
            {data.rooms.map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_80px_150px_32px] items-center gap-2 px-5 py-2.5">
                <Input className="h-9" value={r.name} onChange={(e) => setRoom(r.id, { name: e.target.value })} />
                <Input className="h-9" type="number" min={1} value={r.capacity} onChange={(e) => setRoom(r.id, { capacity: Number(e.target.value) })} aria-label="Capaciteit" />
                <Select className="h-9" value={r.kind} onChange={(e) => setRoom(r.id, { kind: e.target.value as Room["kind"] })}>
                  <option value="team">Teams</option>
                  <option value="scheidsrechter">Scheidsrechters</option>
                </Select>
                <button onClick={() => removeRoom(r.id)} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label={`${r.name} verwijderen`}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </Card>

        {cloud && <MembersCard />}

        <Card className="xl:col-span-2">
          <CardHeader title="Gegevens" subtitle={cloud ? "Opgeslagen in de cloud (EU). Een export is handig als eigen back-up." : "In de demo worden gegevens alleen in je eigen browser bewaard"} />
          <div className="flex flex-wrap gap-2 p-5">
            <Button onClick={exportData}><Download size={16} /> Exporteren (JSON)</Button>
            <Button onClick={() => fileRef.current?.click()}><Upload size={16} /> Importeren</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
            {!cloud && <Button variant="danger" onClick={() => { reset(); toast("Demogegevens opnieuw geladen"); }}><RotateCcw size={16} /> Demo opnieuw laden</Button>}
          </div>
        </Card>
      </div>
    </>
  );
}
