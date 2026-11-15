"use client";

import {
  AlertTriangle, Ban, CloudRain, Lightbulb, LightbulbOff, Map as MapIcon, Pause, Play, Plus, Repeat, Rows3, Trophy, Wand2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useSelectedDate } from "@/components/app-shell";
import { BookingDraft, BookingModal } from "@/components/booking-modal";
import { MatchModal } from "@/components/match-modal";
import { RequestDraft, RequestModal } from "@/components/request-modal";
import { Pitch } from "@/components/pitch";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, cn, DateNavigator, FormField, Input, Modal, PageHeader, Segmented, Select } from "@/components/ui";
import { CATEGORY_META, CATEGORIES, SECTION_LABELS } from "@/lib/meta";
import {
  autoPlanMatchFields, FieldSlot, fieldSlotsForDate, findFieldConflicts, isFieldClosed, needForSections, sectionsForLane,
} from "@/lib/planning";
import { uid } from "@/lib/seed";
import { useLookups, useStore } from "@/lib/store";
import { addDays, fmtTime, nowMinutes, startOfWeek, todayISO, WEEKDAYS_SHORT, weekdayOf } from "@/lib/time";
import type { ChangeRequest, Match } from "@/lib/types";

const PX = 1.25; // pixels per minute
const SNAP = 15;

type Preview = { fieldId: string; sections: number[]; start: number; end: number };
type DragState = {
  slot: FieldSlot;
  /** Not allowed to move this block: a click still opens it */
  locked: boolean;
  grabMinute: number;
  grabLaneOffset: number;
  startX: number;
  startY: number;
  moved: boolean;
  preview: Preview;
};

export default function VeldbezettingPage() {
  const { data, update, canEdit, canRequest, me } = useStore();
  const lookups = useLookups();
  const toast = useToast();
  const [date, setDate] = useSelectedDate();
  const [requestDraft, setRequestDraft] = useState<RequestDraft | null>(null);
  const isOwn = (teamId?: string) => !!teamId && me.teamIds.includes(teamId);
  const trainerOnly = !canEdit && canRequest;
  const pending = data.requests.filter(
    (r) => r.status === "open" && (r.date === date || (r.scope === "reeks" && r.date <= date && weekdayOf(r.date) === weekdayOf(date))),
  );
  const draftFromSlot = (slot: FieldSlot, p?: Preview): RequestDraft => ({
    teamId: slot.teamId!, bookingId: slot.source === "booking" ? slot.id : undefined, matchId: slot.source === "match" ? slot.id : undefined,
    scope: "eenmalig", date, fieldId: p?.fieldId ?? slot.fieldId, sections: p?.sections ?? slot.sections, start: p?.start ?? slot.start, end: p?.end ?? slot.end,
  });
  const [view, setView] = useState<"tijdlijn" | "kaart">("tijdlijn");
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [editMatch, setEditMatch] = useState<Partial<Match> | null>(null);
  const [closureOpen, setClosureOpen] = useState(false);

  const slots = useMemo(() => fieldSlotsForDate(data, date), [data, date]);
  const conflicts = useMemo(() => findFieldConflicts(slots, data, date), [slots, data, date]);
  const conflictKeys = useMemo(() => new Set(conflicts.flatMap((c) => c.keys)), [conflicts]);
  const unplanned = data.matches.filter((m) => m.date === date && m.home && m.status === "gepland" && !m.fieldId);

  const weekend = weekdayOf(date) >= 6;
  const range = useMemo(() => {
    let from = weekend ? 8 * 60 : 16 * 60;
    let to = weekend ? 18 * 60 : 23 * 60;
    for (const s of slots) {
      from = Math.min(from, Math.floor((s.start - 30) / 60) * 60);
      to = Math.max(to, Math.ceil((s.end + 30) / 60) * 60);
    }
    return { from: Math.max(0, from), to: Math.min(24 * 60, to) };
  }, [slots, weekend]);

  const openSlot = (slot: FieldSlot) => {
    if (!canEdit) {
      if (trainerOnly && isOwn(slot.teamId)) setRequestDraft(draftFromSlot(slot));
      else toast(trainerOnly ? "Je kunt alleen wijzigingen aanvragen voor je eigen team" : "Je hebt alleen leesrechten");
      return;
    }
    if (slot.source === "match") {
      setEditMatch(data.matches.find((m) => m.id === slot.id) ?? null);
    } else {
      const b = data.bookings.find((x) => x.id === slot.id);
      if (b) setDraft({ id: b.id, kind: b.kind, teamId: b.teamId, label: b.label, fieldId: b.fieldId, sections: b.sections, start: b.start, end: b.end, recurring: !!b.weekday });
    }
  };

  const commitMove = (slot: FieldSlot, p: Preview) => {
    if (!canEdit) {
      setRequestDraft(draftFromSlot(slot, p));
      return;
    }
    if (slot.source === "match") {
      update((d) => ({
        ...d,
        matches: d.matches.map((m) => (m.id === slot.id ? { ...m, kickoff: p.start, fieldId: p.fieldId, sections: p.sections } : m)),
        roomAssignments: d.roomAssignments.map((a) => (a.matchId === slot.id ? { ...a, start: a.start + (p.start - slot.start), end: a.end + (p.start - slot.start) } : a)),
      }));
      toast(`${slot.title}: aftrap ${fmtTime(p.start)}`, { undo: true });
    } else {
      update((d) => ({ ...d, bookings: d.bookings.map((b) => (b.id === slot.id ? { ...b, ...p } : b)) }));
      toast(slot.recurring ? `${slot.title} verplaatst (elke week)` : `${slot.title} verplaatst`, { undo: true });
    }
  };

  const autoPlan = () => {
    const { updates, failed } = autoPlanMatchFields(data, date);
    update((d) => ({ ...d, matches: d.matches.map((m) => (updates.has(m.id) ? { ...m, ...updates.get(m.id) } : m)) }));
    toast(failed.length ? `${updates.size} ingedeeld, ${failed.length} passen niet` : `${updates.size} wedstrijd(en) ingedeeld`, { undo: true });
  };

  const weekStart = startOfWeek(date);

  return (
    <>
      <PageHeader
        eyebrow="Planning"
        title="Veldbezetting"
        description={
          canEdit
            ? "Sleep blokken om te verplaatsen, klik op een lege plek om te reserveren. Velden zijn opgedeeld in kwarten A–D."
            : trainerOnly
              ? "Klik op een training van je team of sleep het blok naar een andere plek om een wijziging aan te vragen. Klik op een lege plek voor een extra training."
              : "Overzicht van alle velden. Velden zijn opgedeeld in kwarten A–D."
        }
        actions={
          <>
            <DateNavigator value={date} onChange={setDate} />
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "tijdlijn", label: <span className="flex items-center gap-1.5"><Rows3 size={15} /> Tijdlijn</span> },
                { value: "kaart", label: <span className="flex items-center gap-1.5"><MapIcon size={15} /> Veldkaart</span> },
              ]}
            />
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm ring-1 ring-stone-200">
          {WEEKDAYS_SHORT.map((wd, i) => {
            const d = addDays(weekStart, i);
            const count = fieldSlotsForDate(data, d).length;
            return (
              <button
                key={wd}
                onClick={() => setDate(d)}
                className={cn(
                  "flex min-w-12 flex-col items-center rounded-lg px-2.5 py-1 text-xs font-medium",
                  d === date ? "bg-brand-600 text-white" : "text-stone-600 hover:bg-stone-100",
                )}
              >
                <span className="uppercase">{wd}</span>
                <span className={cn("tabular-nums", d === date ? "text-brand-100" : "text-stone-400")}>{count || "–"}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {trainerOnly && me.teamIds.length > 0 && (
            <Button
              variant="primary"
              onClick={() => setRequestDraft({ teamId: me.teamIds[0], scope: "eenmalig", date, fieldId: data.fields[0]?.id ?? "", sections: [0, 1], start: 18 * 60, end: 19 * 60 + 30 })}
              disabled={!data.fields.length}
            >
              <Plus size={16} /> Training aanvragen
            </Button>
          )}
          {canEdit && unplanned.length > 0 && (
            <Button variant="primary" onClick={autoPlan}><Wand2 size={16} /> {unplanned.length} wedstrijd(en) automatisch indelen</Button>
          )}
          {canEdit && <Button onClick={() => setClosureOpen(true)}><CloudRain size={16} /> Veld afkeuren</Button>}
          {canEdit && <Button
            variant="primary"
            disabled={!data.fields.length}
            title={data.fields.length ? undefined : "Voeg eerst een veld toe bij Instellingen"}
            onClick={() => setDraft({ kind: "training", fieldId: data.fields[0]?.id ?? "", sections: [0, 1], start: weekend ? 600 : 1080, end: weekend ? 660 : 1170, recurring: !weekend })}
          >
            <Plus size={16} /> Reservering
          </Button>}
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> {conflicts.length} conflict{conflicts.length > 1 ? "en" : ""} op deze dag</p>
          <ul className="ml-6 list-disc space-y-0.5">
            {conflicts.map((c, i) => (
              <li key={i}>
                <button
                  className="text-left underline-offset-2 hover:underline"
                  onClick={() => {
                    setView("tijdlijn");
                    requestAnimationFrame(() =>
                      document.querySelector(`[data-slot="${c.keys[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }),
                    );
                  }}
                >
                  {c.message} →
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Legend />

      {view === "tijdlijn" ? (
        <Timeline
          date={date}
          range={range}
          slots={slots}
          conflictKeys={conflictKeys}
          onOpen={openSlot}
          onMove={commitMove}
          onCreate={(fieldId, lane, start) => {
            if (canEdit) setDraft({ kind: "training", fieldId, sections: sectionsForLane("half", lane), start, end: start + 90, recurring: !weekend });
            else if (trainerOnly && me.teamIds.length)
              setRequestDraft({ teamId: me.teamIds[0], scope: "eenmalig", date, fieldId, sections: sectionsForLane("half", lane), start, end: start + 90 });
          }}
          draggable={(s) => canEdit || (trainerOnly && isOwn(s.teamId))}
          pending={pending}
          lookups={lookups}
        />
      ) : (
        <PitchMap date={date} range={range} slots={slots} />
      )}

      <BookingModal open={!!draft} draft={draft} date={date} onClose={() => setDraft(null)} />
      <MatchModal match={editMatch} onClose={() => setEditMatch(null)} />
      <RequestModal draft={requestDraft} onClose={() => setRequestDraft(null)} />
      <ClosureModal open={closureOpen} onClose={() => setClosureOpen(false)} date={date} />
    </>
  );
}

function Legend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-600">
      {CATEGORIES.map((c) => (
        <span key={c} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: CATEGORY_META[c].color }} />
          {CATEGORY_META[c].label}
        </span>
      ))}
      <span className="flex items-center gap-1.5"><Trophy size={13} /> Wedstrijd (gearceerd)</span>
      <span className="flex items-center gap-1.5"><Repeat size={13} /> Wekelijks</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border-2 border-dashed border-amber-500" /> Aangevraagd</span>
    </div>
  );
}

function slotColors(slot: FieldSlot, lookups: ReturnType<typeof useLookups>) {
  const team = slot.teamId ? lookups.team.get(slot.teamId) : undefined;
  if (!team) return { color: "#78716c", soft: "#f0eeec", text: "#292524" };
  return CATEGORY_META[team.category];
}

function Timeline({ date, range, slots, conflictKeys, onOpen, onMove, onCreate, lookups, draggable, pending }: {
  date: string;
  range: { from: number; to: number };
  slots: FieldSlot[];
  conflictKeys: Set<string>;
  onOpen: (s: FieldSlot) => void;
  onMove: (s: FieldSlot, p: Preview) => void;
  onCreate: (fieldId: string, lane: number, start: number) => void;
  lookups: ReturnType<typeof useLookups>;
  draggable: (s: FieldSlot) => boolean;
  pending: ChangeRequest[];
}) {
  const { data } = useStore();
  const colRefs = useRef(new Map<string, HTMLDivElement>());
  const [drag, setDrag] = useState<DragState | null>(null);
  const height = (range.to - range.from) * PX;
  const hours: number[] = [];
  for (let h = Math.ceil(range.from / 60) * 60; h <= range.to; h += 60) hours.push(h);
  const now = nowMinutes();
  const showNow = date === todayISO() && now > range.from && now < range.to;

  const locate = (clientX: number, clientY: number) => {
    for (const [fieldId, el] of colRefs.current) {
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX < r.right) {
        const lane = Math.max(0, Math.min(3, Math.floor(((clientX - r.left) / r.width) * 4)));
        const minute = range.from + (clientY - r.top) / PX;
        return { fieldId, lane, minute };
      }
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent, slot: FieldSlot) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const loc = locate(e.clientX, e.clientY);
    if (!loc) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      slot,
      locked: !draggable(slot),
      grabMinute: loc.minute - slot.start,
      grabLaneOffset: loc.lane - Math.min(...slot.sections),
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      preview: { fieldId: slot.fieldId, sections: slot.sections, start: slot.start, end: slot.end },
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || drag.locked) return;
    const moved = drag.moved || Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 5;
    const loc = locate(e.clientX, e.clientY);
    if (!loc) return setDrag({ ...drag, moved });
    const dur = drag.slot.end - drag.slot.start;
    let start = Math.round((loc.minute - drag.grabMinute) / SNAP) * SNAP;
    start = Math.max(range.from, Math.min(range.to - dur, start));
    const need = needForSections(drag.slot.sections);
    const sections = sectionsForLane(need, loc.lane - drag.grabLaneOffset);
    setDrag({ ...drag, moved, preview: { fieldId: loc.fieldId, sections, start, end: start + dur } });
  };

  const onPointerUp = () => {
    if (!drag) return;
    const { slot, preview, moved } = drag;
    setDrag(null);
    if (!moved) return onOpen(slot);
    const same = preview.fieldId === slot.fieldId && preview.start === slot.start && preview.sections.join() === slot.sections.join();
    if (!same) onMove(slot, preview);
  };

  const previewClash = drag?.moved
    ? slots.some(
        (s) =>
          s.key !== drag.slot.key &&
          s.fieldId === drag.preview.fieldId &&
          s.sections.some((x) => drag.preview.sections.includes(x)) &&
          s.start < drag.preview.end && drag.preview.start < s.end,
      ) || !!isFieldClosed(data.closures, drag.preview.fieldId, date)
    : false;

  return (
    <Card className="overflow-hidden">
      <div className="scrollbar-thin overflow-x-auto">
        <div
          className="grid min-w-max select-none"
          style={{ gridTemplateColumns: `56px repeat(${data.fields.length}, minmax(240px, 1fr))` }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
        >
          {/* header */}
          <div className="sticky left-0 z-20 border-b border-stone-200 bg-white" />
          {data.fields.map((f) => {
            const closed = isFieldClosed(data.closures, f.id, date);
            return (
              <div key={f.id} className="border-b border-l border-stone-200 bg-white px-3 pt-3 pb-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-stone-900">{f.name}</p>
                  <div className="flex items-center gap-1.5 text-stone-400">
                    {f.lit ? <span title="Verlicht"><Lightbulb size={14} /></span> : <span title="Geen verlichting"><LightbulbOff size={14} /></span>}
                    <Badge className={f.surface === "kunstgras" ? "bg-brand-50 text-brand-800" : "bg-lime-50 text-lime-800"}>{f.surface}</Badge>
                  </div>
                </div>
                {closed ? (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-700"><Ban size={12} /> Afgekeurd · {closed.reason}</p>
                ) : (
                  <p className="mt-1 text-xs text-stone-400">Beschikbaar</p>
                )}
                <div className="mt-2 grid grid-cols-4 text-center text-[10px] font-semibold tracking-wider text-stone-400">
                  {SECTION_LABELS.map((l) => <span key={l}>{l}</span>)}
                </div>
              </div>
            );
          })}

          {/* time gutter */}
          <div className="sticky left-0 z-10 bg-white" style={{ height }}>
            {hours.map((h) => (
              <div key={h} className="absolute right-2 -translate-y-1/2 text-xs text-stone-400 tabular-nums" style={{ top: Math.max(8, (h - range.from) * PX) }}>
                {fmtTime(h)}
              </div>
            ))}
          </div>

          {data.fields.map((f) => {
            const closed = isFieldClosed(data.closures, f.id, date);
            const fieldSlots = slots.filter((s) => s.fieldId === f.id);
            return (
              <div
                key={f.id}
                ref={(el) => {
                  if (el) colRefs.current.set(f.id, el);
                  else colRefs.current.delete(f.id);
                }}
                className={cn("relative border-l border-stone-200", closed ? "bg-stone-100" : "bg-white")}
                style={{
                  height,
                  backgroundImage: closed
                    ? "repeating-linear-gradient(135deg, rgba(120,113,108,0.12) 0 8px, transparent 8px 16px)"
                    : undefined,
                }}
                onClick={(e) => {
                  if (drag || closed) return;
                  const loc = locate(e.clientX, e.clientY);
                  if (loc) onCreate(f.id, loc.lane, Math.floor(loc.minute / SNAP) * SNAP);
                }}
              >
                {/* grid lines */}
                {hours.map((h) => (
                  <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-stone-100" style={{ top: (h - range.from) * PX }} />
                ))}
                {hours.map((h) => (
                  <div key={`h${h}`} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-stone-100/70" style={{ top: (h + 30 - range.from) * PX }} />
                ))}
                {[1, 2, 3].map((i) => (
                  <div key={i} className={cn("pointer-events-none absolute inset-y-0", i === 2 ? "border-l border-stone-200" : "border-l border-dotted border-stone-100")} style={{ left: `${i * 25}%` }} />
                ))}

                {fieldSlots.map((s) => {
                  const dragging = drag?.moved && drag.slot.key === s.key;
                  return (
                    <SlotBlock
                      key={s.key}
                      slot={s}
                      top={(s.start - range.from) * PX}
                      conflict={conflictKeys.has(s.key)}
                      faded={!!dragging}
                      colors={slotColors(s, lookups)}
                      onPointerDown={(e) => onPointerDown(e, s)}
                    />
                  );
                })}

                {pending.filter((r) => r.fieldId === f.id).map((r) => (
                  <div
                    key={r.id}
                    className="pointer-events-none absolute z-[6] rounded-lg border-2 border-dashed border-amber-500 bg-amber-50/70 px-1.5 py-1 text-[11px] font-semibold text-amber-900"
                    style={{
                      top: (r.start - range.from) * PX + 1,
                      height: (r.end - r.start) * PX - 2,
                      left: `calc(${Math.min(...r.sections) * 25}% + 2px)`,
                      width: `calc(${r.sections.length * 25}% - 4px)`,
                    }}
                    title="Aangevraagd, wacht op goedkeuring"
                  >
                    <span className="block truncate">⏳ {lookups.team.get(r.teamId)?.name}</span>
                    {(r.end - r.start) * PX > 34 && <span className="block truncate font-normal">aangevraagd</span>}
                  </div>
                ))}

                {drag?.moved && drag.preview.fieldId === f.id && (
                  <div
                    className={cn(
                      "pointer-events-none absolute z-20 rounded-lg border-2 border-dashed p-1.5 text-xs font-semibold",
                      previewClash ? "border-red-500 bg-red-50/80 text-red-800" : "border-brand-500 bg-brand-50/80 text-brand-800",
                    )}
                    style={{
                      top: (drag.preview.start - range.from) * PX,
                      height: (drag.preview.end - drag.preview.start) * PX,
                      left: `calc(${Math.min(...drag.preview.sections) * 25}% + 2px)`,
                      width: `calc(${drag.preview.sections.length * 25}% - 4px)`,
                    }}
                  >
                    {fmtTime(drag.preview.start)}–{fmtTime(drag.preview.end)}
                    {previewClash && <span className="block font-normal">Bezet!</span>}
                  </div>
                )}

                {showNow && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: (now - range.from) * PX }}>
                    <span className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function SlotBlock({ slot, top, conflict, faded, colors, onPointerDown }: {
  slot: FieldSlot; top: number; conflict: boolean; faded: boolean;
  colors: { color: string; soft: string; text: string };
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const h = (slot.end - slot.start) * PX;
  const isMatch = slot.kind === "wedstrijd";
  return (
    <div
      role="button"
      tabIndex={0}
      data-slot={slot.key}
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "absolute z-[5] cursor-grab touch-none overflow-hidden rounded-lg border-l-4 py-1 text-xs shadow-sm transition-[opacity,box-shadow] hover:shadow-md active:cursor-grabbing",
        conflict && "conflict-ring",
        faded && "opacity-30",
        slot.sections.length > 1 ? "px-2" : "px-1.5",
      )}
      style={{
        top: top + 1,
        height: h - 2,
        left: `calc(${Math.min(...slot.sections) * 25}% + 2px)`,
        width: `calc(${slot.sections.length * 25}% - 4px)`,
        backgroundColor: colors.soft,
        borderLeftColor: colors.color,
        color: colors.text,
        backgroundImage: isMatch ? `repeating-linear-gradient(135deg, ${colors.color}26 0 6px, transparent 6px 12px)` : undefined,
      }}
      title={`${slot.title} ${slot.subtitle ?? ""} · ${fmtTime(slot.start)}–${fmtTime(slot.end)}`}
    >
      <div className="flex items-center gap-1 font-semibold">
        {isMatch && slot.sections.length > 1 && <Trophy size={12} className="shrink-0" />}
        {conflict && <AlertTriangle size={12} className="shrink-0 text-red-600" />}
        <span className="truncate">{slot.title}</span>
        {slot.recurring && slot.sections.length > 1 && <Repeat size={11} className="ml-auto shrink-0 opacity-60" />}
      </div>
      {h > 34 && <p className="truncate opacity-80">{slot.subtitle ?? ""}</p>}
      {h > 52 && <p className="tabular-nums opacity-70">{fmtTime(slot.start)}–{fmtTime(slot.end)}</p>}
    </div>
  );
}

function PitchMap({ date, range, slots }: { date: string; range: { from: number; to: number }; slots: FieldSlot[] }) {
  const { data } = useStore();
  const lookups = useLookups();
  const initial = (() => {
    const now = nowMinutes();
    if (date === todayISO() && now >= range.from && now <= range.to) return Math.floor(now / 15) * 15;
    return slots[0]?.start ?? range.from;
  })();
  const [time, setTime] = useState(initial);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggle = () => {
    if (playing) {
      if (timer.current) clearInterval(timer.current);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    timer.current = setInterval(() => {
      setTime((t) => {
        if (t + 15 > range.to) {
          if (timer.current) clearInterval(timer.current);
          setPlaying(false);
          return range.to;
        }
        return t + 15;
      });
    }, 500);
  };

  const active = slots.filter((s) => s.start <= time && time < s.end);

  return (
    <div>
      <Card className="mb-4 flex flex-wrap items-center gap-4 p-4">
        <button onClick={toggle} className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700" aria-label={playing ? "Pauzeren" : "Afspelen"}>
          {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <div className="min-w-48 flex-1">
          <input
            type="range"
            min={range.from}
            max={range.to}
            step={15}
            value={time}
            onChange={(e) => setTime(Number(e.target.value))}
            className="w-full accent-brand-600"
            aria-label="Tijdstip"
          />
          <div className="flex justify-between text-xs text-stone-400 tabular-nums">
            <span>{fmtTime(range.from)}</span>
            <span>{fmtTime(range.to)}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums text-stone-900">{fmtTime(time)}</p>
          <p className="text-xs text-stone-500">{active.length} activiteit(en) op het park</p>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {data.fields.map((f) => {
          const closed = isFieldClosed(data.closures, f.id, date);
          const occ = active.filter((s) => s.fieldId === f.id);
          return (
            <Card key={f.id} className="overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <p className="font-semibold">{f.name}</p>
                <span className="text-xs text-stone-500">{f.surface} · {occ.length ? `${occ.length} bezet` : "vrij"}</span>
              </div>
              <div className="px-3 pb-3">
                <Pitch
                  className="w-full"
                  closed={closed?.reason}
                  occupants={occ.map((s) => {
                    const team = s.teamId ? lookups.team.get(s.teamId) : undefined;
                    return {
                      key: s.key,
                      sections: s.sections,
                      title: s.title,
                      subtitle: `${s.subtitle ? `${s.subtitle} · ` : ""}tot ${fmtTime(s.end)}`,
                      color: team ? CATEGORY_META[team.category].color : "#78716c",
                      match: s.kind === "wedstrijd",
                    };
                  })}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ClosureModal({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const { data, update } = useStore();
  const toast = useToast();
  const [fieldId, setFieldId] = useState("");
  const [reason, setReason] = useState("Afgekeurd i.v.m. weersomstandigheden");
  const [cancelMatches, setCancelMatches] = useState(true);
  if (!open) return null;
  const closures = data.closures.filter((c) => c.date === date);
  const target = fieldId || data.fields.find((f) => !closures.some((c) => c.fieldId === f.id))?.id || "";
  const affected = data.matches.filter((m) => m.date === date && m.fieldId === target && m.status === "gepland" && m.home);

  const save = () => {
    if (!target) return;
    update((d) => ({
      ...d,
      closures: [...d.closures, { id: uid("c"), fieldId: target, date, reason }],
      matches: cancelMatches ? d.matches.map((m) => (affected.some((a) => a.id === m.id) ? { ...m, status: "afgelast" as const } : m)) : d.matches,
      roomAssignments: cancelMatches ? d.roomAssignments.filter((a) => !affected.some((m) => m.id === a.matchId)) : d.roomAssignments,
    }));
    toast(`Veld afgekeurd${cancelMatches && affected.length ? `, ${affected.length} wedstrijd(en) afgelast` : ""}`, { undo: true });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Veld afkeuren" footer={<Button variant="primary" onClick={save} disabled={!target}>Afkeuren</Button>}>
      <div className="grid gap-4">
        {closures.length > 0 && (
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="mb-2 text-sm font-medium">Al afgekeurd op deze dag</p>
            {closures.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-1 text-sm">
                <span>{data.fields.find((f) => f.id === c.fieldId)?.name} · {c.reason}</span>
                <Button size="sm" variant="ghost" onClick={() => { update((d) => ({ ...d, closures: d.closures.filter((x) => x.id !== c.id) })); toast("Veld weer goedgekeurd", { undo: true }); }}>
                  Weer openen
                </Button>
              </div>
            ))}
          </div>
        )}
        <FormField label="Veld">
          <Select value={target} onChange={(e) => setFieldId(e.target.value)}>
            {data.fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Reden">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
        {affected.length > 0 && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={cancelMatches} onChange={(e) => setCancelMatches(e.target.checked)} className="mt-0.5 accent-brand-600" />
            <span>
              {affected.length} thuiswedstrijd(en) op dit veld direct afgelasten en kleedkamers vrijgeven
              <span className="block text-xs text-stone-500">Je kunt ze ook verplaatsen naar een ander veld in de tijdlijn.</span>
            </span>
          </label>
        )}
      </div>
    </Modal>
  );
}
