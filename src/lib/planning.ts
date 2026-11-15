import { FIELD_NEED_META, SECTION_LABELS, teamAge } from "./meta";
import type {
  AppData, Booking, Duty, FieldClosure, FieldNeed, Match, RoomAssignment, RoomRole, Team,
} from "./types";
import { fmtTime, overlaps, weekdayOf } from "./time";

/* ------------------------------------------------------------------ */
/* Field sections                                                       */
/* ------------------------------------------------------------------ */

/** Allowed section combinations. A+B is the left half, C+D the right half. */
export const SECTION_SETS: Record<FieldNeed, number[][]> = {
  heel: [[0, 1, 2, 3]],
  half: [[0, 1], [2, 3]],
  kwart: [[0], [1], [2], [3]],
};

export function needForSections(sections: number[]): FieldNeed {
  if (sections.length >= 4) return "heel";
  if (sections.length >= 2) return "half";
  return "kwart";
}

/** Snap a lane index to a valid section set for a given need. */
export function sectionsForLane(need: FieldNeed, lane: number): number[] {
  if (need === "heel") return [0, 1, 2, 3];
  if (need === "half") return lane < 2 ? [0, 1] : [2, 3];
  return [Math.max(0, Math.min(3, lane))];
}

export function sectionsLabel(sections: number[]): string {
  if (sections.length >= 4) return "heel veld";
  return sections.map((s) => SECTION_LABELS[s]).join("+");
}

/* ------------------------------------------------------------------ */
/* Field slots                                                          */
/* ------------------------------------------------------------------ */

export interface FieldSlot {
  key: string;
  source: "booking" | "match";
  id: string;
  fieldId: string;
  sections: number[];
  start: number;
  end: number;
  kind: "training" | "wedstrijd" | "overig";
  teamId?: string;
  title: string;
  subtitle?: string;
  recurring?: boolean;
}

export function bookingOccursOn(b: Booking, date: string): boolean {
  if (b.date) return b.date === date;
  if (b.weekday) return b.weekday === weekdayOf(date) && !(b.exceptions ?? []).includes(date);
  return false;
}

export function matchEnd(m: Match, teams: Map<string, Team> | Team[]): number {
  const team = Array.isArray(teams) ? teams.find((t) => t.id === m.teamId) : teams.get(m.teamId);
  return m.kickoff + (team?.matchDuration ?? 105);
}

export function fieldSlotsForDate(data: AppData, date: string): FieldSlot[] {
  const teams = new Map(data.teams.map((t) => [t.id, t]));
  const slots: FieldSlot[] = [];
  for (const b of data.bookings) {
    if (!bookingOccursOn(b, date)) continue;
    const team = b.teamId ? teams.get(b.teamId) : undefined;
    slots.push({
      key: `b:${b.id}`,
      source: "booking",
      id: b.id,
      fieldId: b.fieldId,
      sections: b.sections,
      start: b.start,
      end: b.end,
      kind: b.kind,
      teamId: b.teamId,
      title: team?.name ?? b.label ?? "Reservering",
      subtitle: b.kind === "training" ? "Training" : b.label && team ? b.label : undefined,
      recurring: !!b.weekday,
    });
  }
  for (const m of data.matches) {
    if (m.date !== date || !m.home || m.status === "afgelast" || !m.fieldId || !m.sections) continue;
    const team = teams.get(m.teamId);
    slots.push({
      key: `m:${m.id}`,
      source: "match",
      id: m.id,
      fieldId: m.fieldId,
      sections: m.sections,
      start: m.kickoff,
      end: matchEnd(m, teams),
      kind: "wedstrijd",
      teamId: m.teamId,
      title: team?.name ?? "Wedstrijd",
      subtitle: `vs ${m.opponent}`,
    });
  }
  return slots.sort((a, b) => a.start - b.start);
}

export interface Conflict {
  keys: string[];
  message: string;
}

export function findFieldConflicts(
  slots: FieldSlot[],
  data: Pick<AppData, "fields" | "closures">,
  date: string,
): Conflict[] {
  const conflicts: Conflict[] = [];
  const fieldName = (id: string) => data.fields.find((f) => f.id === id)?.name ?? "veld";
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      if (a.fieldId !== b.fieldId) continue;
      if (!a.sections.some((s) => b.sections.includes(s))) continue;
      if (!overlaps(a.start, a.end, b.start, b.end)) continue;
      conflicts.push({
        keys: [a.key, b.key],
        message: `${a.title} en ${b.title} overlappen op ${fieldName(a.fieldId)} (${fmtTime(Math.max(a.start, b.start))}–${fmtTime(Math.min(a.end, b.end))})`,
      });
    }
  }
  const closed = data.closures.filter((c) => c.date === date);
  for (const c of closed) {
    const affected = slots.filter((s) => s.fieldId === c.fieldId);
    if (affected.length) {
      conflicts.push({
        keys: affected.map((s) => s.key),
        message: `${fieldName(c.fieldId)} is afgekeurd (${c.reason}) maar heeft nog ${affected.length} activiteit(en)`,
      });
    }
  }
  return conflicts;
}

export function isFieldClosed(closures: FieldClosure[], fieldId: string, date: string) {
  return closures.find((c) => c.fieldId === fieldId && c.date === date);
}

/** Find the first field/section combination that is free for the given window. */
export function findFreePlacement(
  slots: Pick<FieldSlot, "fieldId" | "sections" | "start" | "end">[],
  data: Pick<AppData, "fields" | "closures">,
  date: string,
  need: FieldNeed,
  start: number,
  end: number,
  buffer = 0,
): { fieldId: string; sections: number[] } | null {
  for (const field of data.fields) {
    if (isFieldClosed(data.closures, field.id, date)) continue;
    for (const sections of SECTION_SETS[need]) {
      const clash = slots.some(
        (s) =>
          s.fieldId === field.id &&
          s.sections.some((x) => sections.includes(x)) &&
          overlaps(start - buffer, end + buffer, s.start, s.end),
      );
      if (!clash) return { fieldId: field.id, sections };
    }
  }
  return null;
}

/** Assign a field to every planned home match on `date` that has none (or all of them when `replanAll`). */
export function autoPlanMatchFields(data: AppData, date: string, replanAll = false) {
  const teams = new Map(data.teams.map((t) => [t.id, t]));
  const targets = data.matches
    .filter((m) => m.date === date && m.home && m.status === "gepland" && (replanAll || !m.fieldId))
    .sort((a, b) => a.kickoff - b.kickoff);
  const targetIds = new Set(targets.map((m) => m.id));
  const slots = fieldSlotsForDate(data, date).filter((s) => !(s.source === "match" && targetIds.has(s.id)));
  const updates = new Map<string, Partial<Match>>();
  const failed: Match[] = [];
  for (const m of targets) {
    const team = teams.get(m.teamId);
    if (!team) continue;
    const end = m.kickoff + team.matchDuration;
    const place = findFreePlacement(slots, data, date, team.fieldNeed, m.kickoff, end, data.club.fieldBuffer);
    if (!place) {
      failed.push(m);
      continue;
    }
    updates.set(m.id, place);
    slots.push({ key: `m:${m.id}`, source: "match", id: m.id, kind: "wedstrijd", title: team.name, start: m.kickoff, end, ...place });
  }
  return { updates, failed };
}

/**
 * Re-plan kick-off times for all home matches of a day: youngest teams first,
 * each match on the earliest free spot. Packs the day as tight as possible.
 */
export function optimizeKickoffs(data: AppData, date: string, dayStart = 8 * 60 + 30, dayEnd = 18 * 60) {
  const teams = new Map(data.teams.map((t) => [t.id, t]));
  const targets = data.matches
    .filter((m) => m.date === date && m.home && m.status === "gepland")
    .sort((a, b) => {
      const ta = teams.get(a.teamId);
      const tb = teams.get(b.teamId);
      return (ta ? teamAge(ta) : 99) - (tb ? teamAge(tb) : 99);
    });
  const targetIds = new Set(targets.map((m) => m.id));
  const slots: Pick<FieldSlot, "fieldId" | "sections" | "start" | "end">[] = fieldSlotsForDate(data, date).filter((s) => !(s.source === "match" && targetIds.has(s.id)));

  // Changing rooms are often the real bottleneck: keep track of how many are in use.
  const totalRooms = data.rooms.length;
  const roomsNeeded = (team: Team) => (teamAge(team) >= data.club.roomsFromAge ? 2 : 0) + (teamAge(team) >= 13 ? 1 : 0);
  const { roomBefore, roomAfter, roomBuffer } = data.club;
  const roomIntervals: [number, number][] = data.matches
    .filter((m) => m.date === date && m.home && m.status === "gepland" && !targetIds.has(m.id))
    .flatMap((m) => {
      const tm = teams.get(m.teamId);
      const iv: [number, number] = [m.kickoff - roomBefore, matchEnd(m, teams) + roomAfter + roomBuffer];
      return tm ? Array.from({ length: roomsNeeded(tm) }, () => iv) : [];
    });
  const roomsFit = (start: number, end: number, needed: number) => {
    const points = [start, ...roomIntervals.map(([s]) => s).filter((s) => s > start && s < end)];
    return points.every((p) => roomIntervals.filter(([s, e]) => s <= p && p < e).length + needed <= totalRooms);
  };

  const updates = new Map<string, Partial<Match>>();
  const failed: Match[] = [];
  for (const m of targets) {
    const team = teams.get(m.teamId);
    if (!team) continue;
    const needed = roomsNeeded(team);
    let placed = false;
    for (let t = dayStart; t + team.matchDuration <= dayEnd; t += 15) {
      const roomStart = t - roomBefore;
      const roomEnd = t + team.matchDuration + roomAfter + roomBuffer;
      if (needed && !roomsFit(roomStart, roomEnd, needed)) continue;
      const place = findFreePlacement(slots, data, date, team.fieldNeed, t, t + team.matchDuration, data.club.fieldBuffer);
      if (place) {
        updates.set(m.id, { kickoff: t, ...place });
        slots.push({ ...place, start: t, end: t + team.matchDuration });
        for (let i = 0; i < needed; i++) roomIntervals.push([roomStart, roomEnd]);
        placed = true;
        break;
      }
    }
    if (!placed) failed.push(m);
  }
  return { updates, failed };
}

/** Share of available field-time that is booked within the day's window (0–1). */
export function fieldOccupancy(data: AppData, date: string): number {
  const wd = weekdayOf(date);
  const [from, to] = wd >= 6 ? [8 * 60 + 30, 17 * 60 + 30] : [17 * 60, 22 * 60];
  const slots = fieldSlotsForDate(data, date);
  const open = data.fields.filter((f) => !isFieldClosed(data.closures, f.id, date));
  if (!open.length) return 0;
  let used = 0;
  for (const s of slots) {
    const a = Math.max(from, s.start);
    const b = Math.min(to, s.end);
    if (b > a) used += ((b - a) * s.sections.length) / 4;
  }
  return Math.min(1, used / (open.length * (to - from)));
}

/* ------------------------------------------------------------------ */
/* Changing rooms                                                       */
/* ------------------------------------------------------------------ */

export interface RoomDemand {
  key: string;
  role: RoomRole;
  start: number;
  end: number;
  label: string;
  teamId?: string;
  matchId?: string;
  players: number;
}

export function roomDemandsForDate(data: AppData, date: string): RoomDemand[] {
  const teams = new Map(data.teams.map((t) => [t.id, t]));
  const { roomBefore, roomAfter } = data.club;
  const demands: RoomDemand[] = [];
  for (const m of data.matches) {
    if (m.date !== date || !m.home || m.status === "afgelast") continue;
    const team = teams.get(m.teamId);
    if (!team || teamAge(team) < data.club.roomsFromAge) continue;
    const start = m.kickoff - roomBefore;
    const end = m.kickoff + team.matchDuration + roomAfter;
    demands.push({ key: `${m.id}:thuis`, role: "thuis", start, end, label: team.name, teamId: team.id, matchId: m.id, players: team.players });
    demands.push({ key: `${m.id}:uit`, role: "uit", start, end, label: m.opponent, matchId: m.id, players: team.players });
    if (teamAge(team) >= 13) {
      demands.push({ key: `${m.id}:scheidsrechter`, role: "scheidsrechter", start, end, label: `Scheids ${team.name}`, matchId: m.id, players: 1 });
    }
  }
  for (const b of data.bookings) {
    if (b.kind !== "training" || !b.teamId || !bookingOccursOn(b, date)) continue;
    const team = teams.get(b.teamId);
    if (!team?.roomForTraining) continue;
    demands.push({
      key: `${b.id}:training`, role: "training", start: b.start - 15, end: b.end + 30,
      label: team.name, teamId: team.id, players: team.players,
    });
  }
  return demands.sort((a, b) => a.start - b.start || a.role.localeCompare(b.role));
}

export function demandKey(a: RoomAssignment): string {
  if (a.matchId) return `${a.matchId}:${a.role}`;
  return a.id;
}

/**
 * Greedy interval scheduling: earliest demand first, best-fitting free room
 * (smallest room that fits the squad, referee rooms for referees).
 */
export function autoAssignRooms(data: AppData, date: string) {
  const demands = roomDemandsForDate(data, date);
  const buffer = data.club.roomBuffer;
  const result: RoomAssignment[] = [];
  const unassigned: RoomDemand[] = [];
  const isFree = (roomId: string, start: number, end: number) =>
    !result.some((a) => a.roomId === roomId && overlaps(start - buffer, end + buffer, a.start, a.end));

  for (const d of demands) {
    const preferred = data.rooms.filter((r) => (d.role === "scheidsrechter" ? r.kind === "scheidsrechter" : r.kind === "team"));
    const fallback = d.role === "scheidsrechter" ? data.rooms.filter((r) => r.kind === "team") : [];
    const ordered = [...preferred].sort((a, b) => {
      const fa = a.capacity >= d.players ? 0 : 1;
      const fb = b.capacity >= d.players ? 0 : 1;
      return fa - fb || a.capacity - b.capacity;
    });
    const room = [...ordered, ...fallback].find((r) => isFree(r.id, d.start, d.end));
    if (!room) {
      unassigned.push(d);
      continue;
    }
    result.push({
      id: `ra-${date}-${d.key}`,
      roomId: room.id, date, start: d.start, end: d.end, role: d.role,
      teamId: d.teamId, matchId: d.matchId, label: d.label,
    });
  }
  return { assignments: result, unassigned };
}

export function findRoomConflicts(assignments: RoomAssignment[], buffer: number): Conflict[] {
  const conflicts: Conflict[] = [];
  for (let i = 0; i < assignments.length; i++) {
    for (let j = i + 1; j < assignments.length; j++) {
      const a = assignments[i];
      const b = assignments[j];
      if (a.roomId !== b.roomId || a.date !== b.date) continue;
      if (overlaps(a.start - buffer, a.end + buffer, b.start, b.end)) {
        const tight = !overlaps(a.start, a.end, b.start, b.end);
        conflicts.push({
          keys: [a.id, b.id],
          message: tight
            ? `${a.label} en ${b.label}: te weinig schoonmaaktijd tussen wissel`
            : `${a.label} en ${b.label} zitten tegelijk in dezelfde kleedkamer`,
        });
      }
    }
  }
  return conflicts;
}

/* ------------------------------------------------------------------ */
/* Volunteers                                                           */
/* ------------------------------------------------------------------ */

/** Create standard duties for a match day (bar shifts, secretariat, referees for youth matches). */
export function generateDuties(data: AppData, date: string, uid: () => string): Duty[] {
  const teams = new Map(data.teams.map((t) => [t.id, t]));
  const existing = data.duties.filter((d) => d.date === date);
  const created: Duty[] = [];
  const home = data.matches.filter((m) => m.date === date && m.home && m.status === "gepland");
  if (!home.length) return created;
  const first = Math.min(...home.map((m) => m.kickoff)) - 45;
  const last = Math.max(...home.map((m) => matchEnd(m, teams))) + 30;
  const shiftLen = 180;
  const shifts: [number, number][] = [];
  for (let t = first; t < last; t += shiftLen) shifts.push([t, Math.min(last + 30, t + shiftLen)]);

  const has = (role: string, start: number) => existing.some((d) => d.role === role && d.start === start);
  for (const [s, e] of shifts) {
    if (!has("bardienst", s)) {
      created.push({ id: uid(), date, start: s, end: e, role: "bardienst" });
      created.push({ id: uid(), date, start: s, end: e, role: "bardienst" });
    }
    if (!has("wedstrijdsecretariaat", s)) created.push({ id: uid(), date, start: s, end: e, role: "wedstrijdsecretariaat" });
  }
  if (!has("veldopbouw", first)) created.push({ id: uid(), date, start: first, end: first + 45, role: "veldopbouw" });
  for (const m of home) {
    const team = teams.get(m.teamId);
    if (!team || existing.some((d) => d.matchId === m.id)) continue;
    created.push({ id: uid(), date, start: m.kickoff - 15, end: matchEnd(m, teams), role: "scheidsrechter", matchId: m.id });
  }
  return created;
}

/**
 * Hand out open duties to teams fairly: the team with the fewest duties so far
 * that is not playing at that moment gets the next duty.
 */
export function distributeDuties(data: AppData, date: string): Map<string, string> {
  const teams = new Map(data.teams.map((t) => [t.id, t]));
  const eligible = data.teams.filter((t) => t.category === "senioren" || t.category === "junioren" || (t.category === "vrouwen" && teamAge(t) >= 15));
  const load = new Map<string, number>(eligible.map((t) => [t.id, 0]));
  for (const d of data.duties) if (d.teamId && load.has(d.teamId)) load.set(d.teamId, (load.get(d.teamId) ?? 0) + 1);
  const busy = (teamId: string, start: number, end: number) =>
    data.matches.some((m) => m.date === date && m.teamId === teamId && m.status !== "afgelast" &&
      overlaps(start - 60, end + 30, m.kickoff, matchEnd(m, teams)));

  const result = new Map<string, string>();
  const open = data.duties.filter((d) => d.date === date && !d.teamId && !d.person).sort((a, b) => a.start - b.start);
  for (const d of open) {
    const playing = d.matchId ? data.matches.find((m) => m.id === d.matchId) : undefined;
    const playingTeam = playing ? teams.get(playing.teamId) : undefined;
    const candidates = eligible
      .filter((t) => !busy(t.id, d.start, d.end))
      // referees must be older than the players they whistle
      .filter((t) => !playingTeam || teamAge(t) > teamAge(playingTeam) + 1)
      .sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0) || teamAge(b) - teamAge(a));
    const pick = candidates[0];
    if (!pick) continue;
    result.set(d.id, pick.id);
    load.set(pick.id, (load.get(pick.id) ?? 0) + 1);
  }
  return result;
}

export { FIELD_NEED_META };
