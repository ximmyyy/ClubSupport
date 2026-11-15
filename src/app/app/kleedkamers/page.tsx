"use client";

import { AlertTriangle, ClipboardCopy, DoorOpen, Plus, Printer, ShowerHead, Users, Wand2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useSelectedDate } from "@/components/app-shell";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, CardHeader, cn, DateNavigator, EmptyState, FormField, Input, Modal, PageHeader, Select } from "@/components/ui";
import { ROOM_ROLE_META } from "@/lib/meta";
import { autoAssignRooms, demandKey, findRoomConflicts, roomDemandsForDate, RoomDemand } from "@/lib/planning";
import { uid } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { fmtTime, formatDate, overlaps, parseTime } from "@/lib/time";
import type { RoomAssignment, RoomRole } from "@/lib/types";

const PX = 1.6;
const ROW = 58;

export default function KleedkamersPage() {
  const { data, update, canEdit } = useStore();
  const toast = useToast();
  const [date, setDate] = useSelectedDate();
  const [edit, setEdit] = useState<Partial<RoomAssignment> | null>(null);

  const assignments = useMemo(() => data.roomAssignments.filter((a) => a.date === date), [data.roomAssignments, date]);
  const demands = useMemo(() => roomDemandsForDate(data, date), [data, date]);
  const covered = new Set(assignments.map(demandKey));
  const open = demands.filter((d) => !covered.has(d.key));
  const conflicts = useMemo(() => findRoomConflicts(assignments, data.club.roomBuffer), [assignments, data.club.roomBuffer]);
  const conflictIds = new Set(conflicts.flatMap((c) => c.keys));

  const range = useMemo(() => {
    let from = 8 * 60;
    let to = 18 * 60;
    if (assignments.length || demands.length) {
      const all = [...assignments, ...demands];
      from = Math.floor(Math.min(...all.map((a) => a.start)) / 60) * 60;
      to = Math.ceil(Math.max(...all.map((a) => a.end)) / 60) * 60;
    }
    return { from, to };
  }, [assignments, demands]);

  const autoAssign = () => {
    const { assignments: next, unassigned } = autoAssignRooms(data, date);
    update((d) => ({ ...d, roomAssignments: [...d.roomAssignments.filter((a) => a.date !== date), ...next] }));
    toast(unassigned.length ? `${next.length} ingedeeld, ${unassigned.length} passen niet` : `${next.length} kleedkamers ingedeeld`, { undo: true });
  };

  const assignDemand = (d: RoomDemand, roomId: string) => {
    update((x) => ({
      ...x,
      roomAssignments: [...x.roomAssignments, { id: uid("ra"), roomId, date, start: d.start, end: d.end, role: d.role, teamId: d.teamId, matchId: d.matchId, label: d.label }],
    }));
    toast(`${d.label} → ${data.rooms.find((r) => r.id === roomId)?.name}`, { undo: true });
  };

  const moveTo = (a: RoomAssignment, roomId: string) => {
    update((x) => ({ ...x, roomAssignments: x.roomAssignments.map((r) => (r.id === a.id ? { ...r, roomId } : r)) }));
    toast(`${a.label} → ${data.rooms.find((r) => r.id === roomId)?.name}`, { undo: true });
  };

  const copyText = async () => {
    const lines = [`*Kleedkamers ${formatDate(date, { long: true })}* – ${data.club.name}`, ""];
    for (const a of [...assignments].sort((x, y) => x.start - y.start || x.label.localeCompare(y.label))) {
      lines.push(`${fmtTime(a.start)}–${fmtTime(a.end)}  ${a.label} (${ROOM_ROLE_META[a.role].label.toLowerCase()}) → ${data.rooms.find((r) => r.id === a.roomId)?.name}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast("Overzicht gekopieerd, plak het in de teamapp of WhatsApp");
    } catch {
      toast("Kopiëren lukte niet in deze browser");
    }
  };

  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow="Planning"
          title="Kleedkamers"
          description={`Elk team krijgt ${data.club.roomBefore} min vóór de aftrap een kleedkamer en houdt die tot ${data.club.roomAfter} min na afloop. Tussen twee wissels zit ${data.club.roomBuffer} min schoonmaaktijd.`}
          actions={<DateNavigator value={date} onChange={setDate} />}
        />
        <div className="mb-4 flex flex-wrap gap-2">
          {canEdit && <Button variant="primary" onClick={autoAssign} disabled={!demands.length}><Wand2 size={16} /> Automatisch indelen</Button>}
          {canEdit && <Button onClick={() => setEdit({ date, start: 18 * 60, end: 19 * 60 + 30, role: "overig", label: "", roomId: data.rooms[0]?.id })}><Plus size={16} /> Handmatig</Button>}
          <Button onClick={copyText} disabled={!assignments.length}><ClipboardCopy size={16} /> Kopieer voor WhatsApp</Button>
          <Button onClick={() => window.print()} disabled={!assignments.length}><Printer size={16} /> Deurbordjes printen</Button>
        </div>

        {conflicts.length > 0 && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> {conflicts.length} probleem/problemen</p>
            <ul className="ml-6 list-disc">{conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden">
            {data.rooms.length === 0 ? (
              <EmptyState icon={<DoorOpen />} title="Nog geen kleedkamers">Voeg kleedkamers toe bij Instellingen.</EmptyState>
            ) : (
              <Gantt
                range={range}
                assignments={assignments}
                conflictIds={conflictIds}
                onOpen={(a) => canEdit && setEdit(a)}
                onMove={(a, roomId) => canEdit && moveTo(a, roomId)}
              />
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-100 px-4 py-3 text-xs text-stone-600">
              {(Object.keys(ROOM_ROLE_META) as RoomRole[]).map((r) => (
                <span key={r} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: ROOM_ROLE_META[r].color }} />
                  {ROOM_ROLE_META[r].label}
                </span>
              ))}
              <span className="ml-auto text-stone-400">Sleep een blok naar een andere kleedkamer</span>
            </div>
          </Card>

          <div className="grid content-start gap-4">
            <Card>
              <CardHeader title="Nog in te delen" subtitle={open.length ? `${open.length} team(s) zonder kleedkamer` : "Iedereen heeft een plek"} />
              <div className="divide-y divide-stone-100">
                {open.length === 0 && <p className="px-5 py-4 text-sm text-stone-500">✅ Alle wedstrijden en trainingen hebben een kleedkamer.</p>}
                {open.map((d) => {
                  const free = data.rooms.filter((r) => !assignments.some((a) => a.roomId === r.id && overlaps(d.start - data.club.roomBuffer, d.end + data.club.roomBuffer, a.start, a.end)));
                  return (
                    <div key={d.key} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-stone-800">{d.label}</p>
                        <Badge color={ROOM_ROLE_META[d.role].color} soft={ROOM_ROLE_META[d.role].soft}>{ROOM_ROLE_META[d.role].label}</Badge>
                      </div>
                      <p className="text-xs text-stone-500 tabular-nums">{fmtTime(d.start)}–{fmtTime(d.end)} · {d.players} pers.</p>
                      <Select className="mt-2 h-9" value="" disabled={!canEdit} onChange={(e) => e.target.value && assignDemand(d, e.target.value)}>
                        <option value="">{free.length ? `Kies kleedkamer (${free.length} vrij)…` : "Geen kleedkamer vrij"}</option>
                        {free.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.capacity} pl.</option>)}
                      </Select>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card>
              <CardHeader title="Wie zit waar?" subtitle="Per team, op aftraptijd" />
              <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto">
                {[...assignments].sort((a, b) => a.start - b.start).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-5 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{a.label}</span>
                      <span className="text-xs text-stone-500 tabular-nums">{fmtTime(a.start)} · {ROOM_ROLE_META[a.role].label}</span>
                    </span>
                    <span className="shrink-0 rounded-lg bg-stone-100 px-2 py-1 text-xs font-semibold">{data.rooms.find((r) => r.id === a.roomId)?.name.replace("Kleedkamer", "KK")}</span>
                  </li>
                ))}
                {!assignments.length && <li className="px-5 py-4 text-sm text-stone-500">Nog niets ingedeeld voor deze dag.</li>}
              </ul>
            </Card>
          </div>
        </div>
      </div>

      <DoorSigns date={date} assignments={assignments} />
      <AssignmentModal value={edit} onClose={() => setEdit(null)} date={date} />
    </>
  );
}

function Gantt({ range, assignments, conflictIds, onOpen, onMove }: {
  range: { from: number; to: number };
  assignments: RoomAssignment[];
  conflictIds: Set<string>;
  onOpen: (a: RoomAssignment) => void;
  onMove: (a: RoomAssignment, roomId: string) => void;
}) {
  const { data } = useStore();
  const body = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ a: RoomAssignment; y0: number; dy: number; moved: boolean; row: number } | null>(null);
  const width = (range.to - range.from) * PX;
  const hours: number[] = [];
  for (let h = range.from; h <= range.to; h += 60) hours.push(h);
  const rowAt = (clientY: number) => {
    const r = body.current?.getBoundingClientRect();
    if (!r) return -1;
    return Math.floor((clientY - r.top) / ROW);
  };

  const targetRoom = drag?.moved ? data.rooms[Math.max(0, Math.min(data.rooms.length - 1, drag.row))] : undefined;

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <div className="min-w-max select-none" style={{ width: width + 190 }}>
        <div className="flex border-b border-stone-200 bg-white">
          <div className="sticky left-0 z-20 w-[190px] shrink-0 bg-white px-4 py-2 text-xs font-semibold tracking-wider text-stone-400 uppercase">Kleedkamer</div>
          <div className="relative h-8" style={{ width }}>
            {hours.map((h) => (
              <span key={h} className={cn("absolute top-2 text-xs text-stone-400 tabular-nums", h > range.from && "-translate-x-1/2")} style={{ left: (h - range.from) * PX + (h === range.from ? 4 : 0) }}>{fmtTime(h)}</span>
            ))}
          </div>
        </div>
        <div
          ref={body}
          className="relative"
          onPointerMove={(e) => drag && setDrag({ ...drag, dy: e.clientY - drag.y0, row: rowAt(e.clientY), moved: drag.moved || Math.abs(e.clientY - drag.y0) > 6 })}
          onPointerUp={() => {
            if (!drag) return;
            setDrag(null);
            if (!drag.moved) return onOpen(drag.a);
            if (targetRoom && targetRoom.id !== drag.a.roomId) onMove(drag.a, targetRoom.id);
          }}
          onPointerCancel={() => setDrag(null)}
        >
          {data.rooms.map((room) => {
            const items = assignments.filter((a) => a.roomId === room.id);
            const isTarget = targetRoom?.id === room.id && targetRoom.id !== drag?.a.roomId;
            return (
              <div key={room.id} className={cn("flex border-b border-stone-100", isTarget && "bg-brand-50")} style={{ height: ROW }}>
                <div className="sticky left-0 z-10 flex w-[190px] shrink-0 items-center gap-2.5 border-r border-stone-100 bg-white px-4">
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", room.kind === "scheidsrechter" ? "bg-stone-800 text-white" : "bg-brand-50 text-brand-700")}>
                    {room.kind === "scheidsrechter" ? <ShowerHead size={16} /> : <DoorOpen size={16} />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{room.name}</p>
                    <p className="flex items-center gap-1 text-xs text-stone-400"><Users size={11} /> {room.capacity}</p>
                  </div>
                </div>
                <div className="relative" style={{ width }}>
                  {hours.map((h) => (
                    <div key={h} className="pointer-events-none absolute inset-y-0 border-l border-stone-100" style={{ left: (h - range.from) * PX }} />
                  ))}
                  {items.map((a) => {
                    const meta = ROOM_ROLE_META[a.role];
                    const isDragging = drag?.a.id === a.id && drag.moved;
                    return (
                      <div
                        key={a.id}
                        role="button"
                        tabIndex={0}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                          setDrag({ a, y0: e.clientY, dy: 0, moved: false, row: rowAt(e.clientY) });
                        }}
                        onKeyDown={(e) => e.key === "Enter" && onOpen(a)}
                        className={cn(
                          "absolute top-1.5 bottom-1.5 cursor-grab touch-none overflow-hidden rounded-lg border-l-4 px-2 py-1 text-xs shadow-sm hover:shadow-md",
                          conflictIds.has(a.id) && "conflict-ring",
                        )}
                        style={{
                          left: (a.start - range.from) * PX + 1,
                          width: (a.end - a.start) * PX - 2,
                          backgroundColor: meta.soft,
                          borderLeftColor: meta.color,
                          transform: isDragging ? `translateY(${drag.dy}px)` : undefined,
                          zIndex: isDragging ? 30 : undefined,
                          opacity: isDragging ? 0.85 : 1,
                        }}
                        title={`${a.label} · ${meta.label} · ${fmtTime(a.start)}–${fmtTime(a.end)}`}
                      >
                        <p className="truncate font-semibold text-stone-900">{a.label}</p>
                        <p className="truncate text-stone-600 tabular-nums">{meta.label} · {fmtTime(a.start)}–{fmtTime(a.end)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AssignmentModal({ value, onClose, date }: { value: Partial<RoomAssignment> | null; onClose: () => void; date: string }) {
  if (!value) return null;
  return <AssignmentForm key={value.id ?? "new"} initial={value} onClose={onClose} date={date} />;
}

function AssignmentForm({ initial, onClose, date }: { initial: Partial<RoomAssignment>; onClose: () => void; date: string }) {
  const { data, update } = useStore();
  const toast = useToast();
  const [a, setA] = useState(initial);
  const valid = !!(a.roomId && a.label && a.start != null && a.end != null && a.end > a.start);
  const save = () => {
    if (!valid) return;
    const full = { ...a, id: a.id ?? uid("ra"), date } as RoomAssignment;
    update((d) => ({
      ...d,
      roomAssignments: a.id ? d.roomAssignments.map((x) => (x.id === a.id ? full : x)) : [...d.roomAssignments, full],
    }));
    toast("Kleedkamer opgeslagen", { undo: true });
    onClose();
  };
  const remove = () => {
    update((d) => ({ ...d, roomAssignments: d.roomAssignments.filter((x) => x.id !== a.id) }));
    toast("Indeling verwijderd", { undo: true });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={a.id ? "Kleedkamer bewerken" : "Kleedkamer reserveren"}
      footer={<>{a.id && <Button variant="danger" onClick={remove}>Verwijderen</Button>}<Button variant="primary" onClick={save} disabled={!valid}>Opslaan</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Naam / team">
          <Input value={a.label ?? ""} onChange={(e) => setA({ ...a, label: e.target.value })} placeholder="Bijv. Scheidsrechterscursus" />
        </FormField>
        <FormField label="Soort">
          <Select value={a.role} onChange={(e) => setA({ ...a, role: e.target.value as RoomRole })}>
            {(Object.keys(ROOM_ROLE_META) as RoomRole[]).map((r) => <option key={r} value={r}>{ROOM_ROLE_META[r].label}</option>)}
          </Select>
        </FormField>
        <FormField label="Kleedkamer">
          <Select value={a.roomId} onChange={(e) => setA({ ...a, roomId: e.target.value })}>
            {data.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Van"><Input type="time" step={300} value={fmtTime(a.start ?? 0)} onChange={(e) => setA({ ...a, start: parseTime(e.target.value) })} /></FormField>
          <FormField label="Tot"><Input type="time" step={300} value={fmtTime(a.end ?? 0)} onChange={(e) => setA({ ...a, end: parseTime(e.target.value) })} /></FormField>
        </div>
      </div>
    </Modal>
  );
}

/** Printable A4 signs for each changing-room door. */
function DoorSigns({ date, assignments }: { date: string; assignments: RoomAssignment[] }) {
  const { data } = useStore();
  return (
    <div className="print-only">
      {data.rooms.map((room) => {
        const items = assignments.filter((a) => a.roomId === room.id).sort((a, b) => a.start - b.start);
        if (!items.length) return null;
        return (
          <section key={room.id} style={{ breakAfter: "page", padding: "24px" }}>
            <p style={{ fontSize: 16, color: "#555" }}>{data.club.name} · {formatDate(date, { long: true })}</p>
            <h1 style={{ fontSize: 56, fontWeight: 800, margin: "8px 0 24px" }}>{room.name}</h1>
            <table style={{ width: "100%", fontSize: 26, borderCollapse: "collapse" }}>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} style={{ borderBottom: "2px solid #ddd" }}>
                    <td style={{ padding: "14px 0", width: "34%", fontVariantNumeric: "tabular-nums" }}>{fmtTime(a.start)} – {fmtTime(a.end)}</td>
                    <td style={{ padding: "14px 0", fontWeight: 700 }}>{a.label}</td>
                    <td style={{ padding: "14px 0", textAlign: "right", color: "#555" }}>{ROOM_ROLE_META[a.role].label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ marginTop: 32, fontSize: 14, color: "#777" }}>Laat de kleedkamer netjes achter. Waardevolle spullen niet onbeheerd laten.</p>
          </section>
        );
      })}
    </div>
  );
}
