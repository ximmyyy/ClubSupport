"use client";

import { Download, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { useConfirm } from "@/components/confirm";
import { MembersCard } from "@/components/members-card";
import { TextSizeControl } from "@/components/text-size";
import { useToast } from "@/components/toast";
import { Button, Card, CardHeader, Checkbox, CommitInput, FormField, IconButton, PageHeader, Select } from "@/components/ui";
import { remapIds } from "@/lib/repository";
import { uid } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { todayISO } from "@/lib/time";
import type { AppData, Club, Field, Room } from "@/lib/types";

export default function InstellingenPage() {
  const { data, update, reset, replace, source, canEdit } = useStore();
  const cloud = source.kind === "cloud";
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  const setClub = <K extends keyof Club>(k: K, v: Club[K]) => update((d) => ({ ...d, club: { ...d.club, [k]: v } }));
  const setField = (id: string, patch: Partial<Field>) => update((d) => ({ ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  const setRoom = (id: string, patch: Partial<Room>) => update((d) => ({ ...d, rooms: d.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  const removeField = async (f: Field) => {
    const id = f.id;
    const used = data.bookings.filter((b) => b.fieldId === id).length;
    const ok = await confirm({
      title: `${f.name} verwijderen?`,
      text: used
        ? `Op dit veld staan ${used} trainingen of reserveringen. Die worden ook verwijderd. Wedstrijden op dit veld blijven bestaan, maar hebben daarna geen veld meer.`
        : "Dit veld verdwijnt uit de planning.",
    });
    if (!ok) return;
    update((d) => ({
      ...d,
      fields: d.fields.filter((f) => f.id !== id),
      bookings: d.bookings.filter((b) => b.fieldId !== id),
      matches: d.matches.map((m) => (m.fieldId === id ? { ...m, fieldId: undefined, sections: undefined } : m)),
      closures: d.closures.filter((c) => c.fieldId !== id),
      requests: d.requests.filter((r) => r.fieldId !== id),
    }));
    toast("Veld verwijderd", { undo: true });
  };
  const removeRoom = async (r: Room) => {
    const id = r.id;
    const ok = await confirm({ title: `${r.name} verwijderen?`, text: "De kleedkamer verdwijnt uit de indeling. Teams die erin zaten moeten opnieuw worden ingedeeld." });
    if (!ok) return;
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
      const ok = await confirm({
        title: "Kopie terugzetten?",
        text: "De huidige planning wordt vervangen door de gegevens uit dit bestand.",
        confirmLabel: "Ja, terugzetten",
      });
      if (!ok) return;
      replace(cloud ? { ...remapIds(parsed), club: data.club } : { ...parsed, requests: parsed.requests ?? [] });
      toast("Gegevens geïmporteerd", { undo: true });
    } catch {
      toast("Dit bestand is geen geldige Club Support-export");
    }
  };

  const num = (v: string, min = 0) => Math.max(min, Math.round(Number(v) || 0));

  return (
    <>
      <PageHeader eyebrow="Club" title="Instellingen" description="Hier leg je vast hoe je club eruitziet: de velden, de kleedkamers en wie er mag meewerken." />
      {!canEdit && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-amber-900">Je kunt de instellingen bekijken. Alleen beheerders en planners kunnen ze wijzigen.</p>}
      <fieldset disabled={!canEdit} className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Club" subtitle="Naam en plaats van de vereniging" />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <FormField label="Naam van de club"><CommitInput value={data.club.name} onCommit={(v) => v.trim().length > 1 && setClub("name", v.trim())} /></FormField>
            <FormField label="Korte naam" hint="Bijvoorbeeld 'Zwaluwen'. Hiermee herkennen we je teams in een geïmporteerd programma.">
              <CommitInput value={data.club.shortName} onCommit={(v) => v.trim() && setClub("shortName", v.trim())} />
            </FormField>
            <FormField label="Plaats"><CommitInput value={data.club.city} onCommit={(v) => setClub("city", v.trim())} /></FormField>
            <FormField label="Sport" hint="Hockey, korfbal en handbal volgen later.">
              <Select value="voetbal" disabled><option value="voetbal">Voetbal</option></Select>
            </FormField>
          </div>
        </Card>

        <Card id="velden" className="scroll-mt-20">
          <CardHeader title="Velden" subtitle="Elk veld is verdeeld in vier kwarten (A t/m D), zodat meerdere teams tegelijk kunnen trainen." />
          <div className="divide-y divide-stone-100">
            {data.fields.length === 0 && <p className="px-4 py-4 text-stone-600 sm:px-5">Nog geen velden. Voeg het eerste veld toe met de knop hieronder.</p>}
            {data.fields.map((f) => (
              <div key={f.id} className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-2 px-4 py-3 sm:grid-cols-[1fr_150px_auto_auto] sm:px-5">
                <CommitInput compact value={f.name} aria-label="Naam van het veld" onCommit={(v) => v.trim() && setField(f.id, { name: v.trim() })} />
                <IconButton label={`${f.name} verwijderen`} tone="danger" className="sm:order-last" onClick={() => removeField(f)}><Trash2 size={20} /></IconButton>
                <Select compact value={f.surface} aria-label="Ondergrond" onChange={(e) => setField(f.id, { surface: e.target.value as Field["surface"] })}>
                  <option value="kunstgras">Kunstgras</option>
                  <option value="natuurgras">Natuurgras</option>
                </Select>
                <Checkbox className="col-span-2 sm:col-span-1" checked={f.lit} onChange={(e) => setField(f.id, { lit: e.target.checked })} label="Verlichting" />
              </div>
            ))}
          </div>
          <div className="border-t border-stone-100 p-3 sm:px-5">
            <Button onClick={() => update((d) => ({ ...d, fields: [...d.fields, { id: uid("f"), name: `Veld ${d.fields.length + 1}`, surface: "kunstgras", lit: true }] }))}>
              <Plus size={18} /> Veld toevoegen
            </Button>
          </div>
        </Card>

        <Card id="kleedkamers" className="scroll-mt-20">
          <CardHeader title="Kleedkamers" subtitle="Met het aantal plaatsen en of de kamer voor teams of scheidsrechters is." />
          <div className="divide-y divide-stone-100">
            {data.rooms.length === 0 && <p className="px-4 py-4 text-stone-600 sm:px-5">Nog geen kleedkamers. Voeg de eerste toe met de knop hieronder.</p>}
            {data.rooms.map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_auto] items-end gap-x-2 gap-y-2 px-4 py-3 sm:grid-cols-[1fr_90px_170px_auto] sm:items-center sm:px-5">
                <CommitInput compact value={r.name} aria-label="Naam van de kleedkamer" onCommit={(v) => v.trim() && setRoom(r.id, { name: v.trim() })} />
                <IconButton label={`${r.name} verwijderen`} tone="danger" className="sm:order-last" onClick={() => removeRoom(r)}><Trash2 size={20} /></IconButton>
                <div className="col-span-2 grid grid-cols-[110px_1fr] gap-2 sm:contents">
                  <label className="block">
                    <span className="mb-1 block text-sm text-stone-600 sm:sr-only">Plaatsen</span>
                    <CommitInput compact type="number" inputMode="numeric" min={1} value={r.capacity} aria-label="Aantal plaatsen" onCommit={(v) => setRoom(r.id, { capacity: num(v, 1) })} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm text-stone-600 sm:sr-only">Voor</span>
                    <Select compact value={r.kind} aria-label="Voor wie" onChange={(e) => setRoom(r.id, { kind: e.target.value as Room["kind"] })}>
                      <option value="team">Teams</option>
                      <option value="scheidsrechter">Scheidsrechters</option>
                    </Select>
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-stone-100 p-3 sm:px-5">
            <Button onClick={() => update((d) => ({ ...d, rooms: [...d.rooms, { id: uid("k"), name: `Kleedkamer ${d.rooms.filter((r) => r.kind === "team").length + 1}`, capacity: 18, kind: "team" }] }))}>
              <Plus size={18} /> Kleedkamer toevoegen
            </Button>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Regels voor het automatisch indelen" subtitle="De standaardwaarden werken voor de meeste clubs. Pas ze alleen aan als het bij jullie anders gaat." />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
            <FormField label="Kleedkamer open vóór de aftrap" hint="In minuten">
              <CommitInput type="number" inputMode="numeric" min={0} step={5} value={data.club.roomBefore} onCommit={(v) => setClub("roomBefore", num(v))} />
            </FormField>
            <FormField label="Kleedkamer bezet na afloop" hint="In minuten">
              <CommitInput type="number" inputMode="numeric" min={0} step={5} value={data.club.roomAfter} onCommit={(v) => setClub("roomAfter", num(v))} />
            </FormField>
            <FormField label="Schoonmaaktijd tussen twee teams" hint="In minuten">
              <CommitInput type="number" inputMode="numeric" min={0} step={5} value={data.club.roomBuffer} onCommit={(v) => setClub("roomBuffer", num(v))} />
            </FormField>
            <FormField label="Wisseltijd op het veld" hint="Minuten tussen twee wedstrijden op hetzelfde veld">
              <CommitInput type="number" inputMode="numeric" min={0} step={5} value={data.club.fieldBuffer} onCommit={(v) => setClub("fieldBuffer", num(v))} />
            </FormField>
            <FormField label="Kleedkamer vanaf leeftijd" hint="Jongere teams komen omgekleed. Bij 10 krijgen JO8 en JO9 geen kleedkamer.">
              <CommitInput type="number" inputMode="numeric" min={6} max={20} value={data.club.roomsFromAge} onCommit={(v) => setClub("roomsFromAge", Math.min(100, num(v, 5)))} />
            </FormField>
          </div>
        </Card>
      </fieldset>

      <div className="mt-4 grid gap-4">
        {cloud && <MembersCard />}

        <Card>
          <CardHeader title="Weergave" subtitle="Alleen voor jou, op dit apparaat" />
          <div className="p-4 sm:p-5">
            <TextSizeControl />
            <p className="mt-2 text-sm text-stone-600">Kies een grotere letter als je de tekst lastig kunt lezen.</p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Reservekopie" subtitle={cloud ? "Je gegevens staan veilig online (in de EU). Hier kun je een eigen kopie bewaren of terugzetten." : "In de demo blijven gegevens alleen in deze browser bewaard."} />
          <div className="flex flex-wrap gap-2 p-4 sm:p-5">
            <Button onClick={exportData}><Download size={18} /> Kopie downloaden</Button>
            {canEdit && <Button onClick={() => fileRef.current?.click()}><Upload size={18} /> Kopie terugzetten</Button>}
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
            {!cloud && (
              <Button
                variant="danger"
                onClick={async () => {
                  if (await confirm({ title: "Demo opnieuw beginnen?", text: "Alle wijzigingen die je in de demo hebt gemaakt gaan verloren.", confirmLabel: "Ja, opnieuw beginnen" })) {
                    reset();
                    toast("De demo is opnieuw geladen");
                  }
                }}
              >
                <RotateCcw size={18} /> Demo opnieuw beginnen
              </Button>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
