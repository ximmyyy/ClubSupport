import { uid } from "./id";
import type {
  AppData, Booking, Club, Duty, Field, FieldClosure, Match, Room, RoomAssignment, Team,
} from "./types";

/* ------------------------------------------------------------------ */
/* Row mapping (app model <-> Postgres tables)                          */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;
type CollectionKey = "fields" | "rooms" | "teams" | "bookings" | "matches" | "roomAssignments" | "duties" | "closures";

const u = <T,>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);
const n = <T,>(v: T | undefined): T | null => (v === undefined ? null : v);

/** Drop undefined keys so objects from the server and from the app compare equal. */
function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

interface Spec<T> {
  key: CollectionKey;
  table: string;
  toRow: (x: T, index: number, clubId: string) => Row;
  fromRow: (r: Row) => T;
  order: string[];
}

const fieldSpec: Spec<Field> = {
  key: "fields", table: "fields", order: ["position", "name"],
  toRow: (f, i, club_id) => ({ id: f.id, club_id, name: f.name, surface: f.surface, lit: f.lit, position: i }),
  fromRow: (r) => ({ id: r.id as string, name: r.name as string, surface: r.surface as Field["surface"], lit: r.lit as boolean }),
};
const roomSpec: Spec<Room> = {
  key: "rooms", table: "rooms", order: ["position", "name"],
  toRow: (x, i, club_id) => ({ id: x.id, club_id, name: x.name, capacity: x.capacity, kind: x.kind, position: i }),
  fromRow: (r) => ({ id: r.id as string, name: r.name as string, capacity: r.capacity as number, kind: r.kind as Room["kind"] }),
};
const teamSpec: Spec<Team> = {
  key: "teams", table: "teams", order: ["position", "name"],
  toRow: (t, i, club_id) => ({
    id: t.id, club_id, name: t.name, category: t.category, trainer: t.trainer, players: t.players,
    field_need: t.fieldNeed, match_duration: t.matchDuration, room_for_training: t.roomForTraining, position: i,
  }),
  fromRow: (r) => ({
    id: r.id as string, name: r.name as string, category: r.category as Team["category"], trainer: r.trainer as string,
    players: r.players as number, fieldNeed: r.field_need as Team["fieldNeed"], matchDuration: r.match_duration as number,
    roomForTraining: r.room_for_training as boolean,
  }),
};
const bookingSpec: Spec<Booking> = {
  key: "bookings", table: "bookings", order: ["start_min"],
  toRow: (b, _i, club_id) => ({
    id: b.id, club_id, kind: b.kind, field_id: b.fieldId, sections: b.sections, start_min: b.start, end_min: b.end,
    team_id: n(b.teamId), label: n(b.label), weekday: n(b.weekday), date: n(b.date), exceptions: b.exceptions ?? [],
  }),
  fromRow: (r) => clean({
    id: r.id as string, kind: r.kind as Booking["kind"], fieldId: r.field_id as string, sections: r.sections as number[],
    start: r.start_min as number, end: r.end_min as number, teamId: u(r.team_id as string | null), label: u(r.label as string | null),
    weekday: u(r.weekday as number | null), date: u(r.date as string | null),
    exceptions: (r.exceptions as string[] | null)?.length ? (r.exceptions as string[]) : undefined,
  }),
};
const matchSpec: Spec<Match> = {
  key: "matches", table: "matches", order: ["date", "kickoff"],
  toRow: (m, _i, club_id) => ({
    id: m.id, club_id, team_id: m.teamId, opponent: m.opponent, date: m.date, kickoff: m.kickoff, home: m.home,
    field_id: n(m.fieldId), sections: n(m.sections), status: m.status, referee: n(m.referee),
    score_home: n(m.scoreHome), score_away: n(m.scoreAway),
  }),
  fromRow: (r) => clean({
    id: r.id as string, teamId: r.team_id as string, opponent: r.opponent as string, date: r.date as string,
    kickoff: r.kickoff as number, home: r.home as boolean, fieldId: u(r.field_id as string | null),
    sections: u(r.sections as number[] | null), status: r.status as Match["status"], referee: u(r.referee as string | null),
    scoreHome: u(r.score_home as number | null), scoreAway: u(r.score_away as number | null),
  }),
};
const assignmentSpec: Spec<RoomAssignment> = {
  key: "roomAssignments", table: "room_assignments", order: ["date", "start_min"],
  toRow: (a, _i, club_id) => ({
    id: a.id, club_id, room_id: a.roomId, date: a.date, start_min: a.start, end_min: a.end, role: a.role,
    team_id: n(a.teamId), match_id: n(a.matchId), label: a.label,
  }),
  fromRow: (r) => clean({
    id: r.id as string, roomId: r.room_id as string, date: r.date as string, start: r.start_min as number, end: r.end_min as number,
    role: r.role as RoomAssignment["role"], teamId: u(r.team_id as string | null), matchId: u(r.match_id as string | null), label: r.label as string,
  }),
};
const dutySpec: Spec<Duty> = {
  key: "duties", table: "duties", order: ["date", "start_min"],
  toRow: (d, _i, club_id) => ({
    id: d.id, club_id, date: d.date, start_min: d.start, end_min: d.end, role: d.role,
    person: n(d.person), team_id: n(d.teamId), match_id: n(d.matchId),
  }),
  fromRow: (r) => clean({
    id: r.id as string, date: r.date as string, start: r.start_min as number, end: r.end_min as number, role: r.role as Duty["role"],
    person: u(r.person as string | null), teamId: u(r.team_id as string | null), matchId: u(r.match_id as string | null),
  }),
};
const closureSpec: Spec<FieldClosure> = {
  key: "closures", table: "closures", order: ["date"],
  toRow: (c, _i, club_id) => ({ id: c.id, club_id, field_id: c.fieldId, date: c.date, reason: c.reason }),
  fromRow: (r) => ({ id: r.id as string, fieldId: r.field_id as string, date: r.date as string, reason: r.reason as string }),
};

/** Parents before children: upserts run in this order, deletes in reverse. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SPECS: Spec<any>[] = [fieldSpec, roomSpec, teamSpec, matchSpec, bookingSpec, assignmentSpec, dutySpec, closureSpec];

export function clubToRow(c: Club): Row {
  return {
    name: c.name, short_name: c.shortName, city: c.city, sport: c.sport, room_before: c.roomBefore, room_after: c.roomAfter,
    room_buffer: c.roomBuffer, field_buffer: c.fieldBuffer, rooms_from_age: c.roomsFromAge,
  };
}

export function clubFromRow(r: Row): Club {
  return {
    name: r.name as string, shortName: r.short_name as string, city: r.city as string, sport: "voetbal",
    roomBefore: r.room_before as number, roomAfter: r.room_after as number, roomBuffer: r.room_buffer as number,
    fieldBuffer: r.field_buffer as number, roomsFromAge: r.rooms_from_age as number,
  };
}

export function emptyData(club: Club): AppData {
  return { version: 1, club, fields: [], rooms: [], teams: [], bookings: [], matches: [], roomAssignments: [], duties: [], closures: [] };
}

/* ------------------------------------------------------------------ */
/* Diffing                                                              */
/* ------------------------------------------------------------------ */

export interface Changes {
  club?: Row;
  upserts: { table: string; rows: Row[] }[];
  deletes: { table: string; ids: string[] }[];
}

/** Translate an in-memory state change into the minimal set of database writes. */
export function computeChanges(clubId: string, prev: AppData, next: AppData): Changes {
  const changes: Changes = { upserts: [], deletes: [] };
  if (JSON.stringify(clubToRow(prev.club)) !== JSON.stringify(clubToRow(next.club))) changes.club = clubToRow(next.club);
  for (const spec of SPECS) {
    const before = new Map<string, string>();
    (prev[spec.key] as { id: string }[]).forEach((x, i) => before.set(x.id, JSON.stringify(spec.toRow(x, i, clubId))));
    const after = new Set<string>();
    const rows: Row[] = [];
    (next[spec.key] as { id: string }[]).forEach((x, i) => {
      after.add(x.id);
      const row = spec.toRow(x, i, clubId);
      if (before.get(x.id) !== JSON.stringify(row)) rows.push(row);
    });
    if (rows.length) changes.upserts.push({ table: spec.table, rows });
    const removed = [...before.keys()].filter((id) => !after.has(id));
    if (removed.length) changes.deletes.unshift({ table: spec.table, ids: removed });
  }
  return changes;
}

/** Give every entity a fresh UUID and rewrite all references (used when importing demo data into a club). */
export function remapIds(data: AppData): AppData {
  const map = new Map<string, string>();
  const id = (old: string) => {
    if (!map.has(old)) map.set(old, uid());
    return map.get(old)!;
  };
  const ref = (old?: string) => (old === undefined ? undefined : id(old));
  return {
    ...data,
    fields: data.fields.map((f) => ({ ...f, id: id(f.id) })),
    rooms: data.rooms.map((r) => ({ ...r, id: id(r.id) })),
    teams: data.teams.map((t) => ({ ...t, id: id(t.id) })),
    matches: data.matches.map((m) => clean({ ...m, id: id(m.id), teamId: id(m.teamId), fieldId: ref(m.fieldId) })),
    bookings: data.bookings.map((b) => clean({ ...b, id: id(b.id), fieldId: id(b.fieldId), teamId: ref(b.teamId) })),
    roomAssignments: data.roomAssignments.map((a) => clean({ ...a, id: id(a.id), roomId: id(a.roomId), teamId: ref(a.teamId), matchId: ref(a.matchId) })),
    duties: data.duties.map((d) => clean({ ...d, id: id(d.id), teamId: ref(d.teamId), matchId: ref(d.matchId) })),
    closures: data.closures.map((c) => ({ ...c, id: id(c.id), fieldId: id(c.fieldId) })),
  };
}

/** Order-insensitive equality, used to ignore realtime echoes of our own writes. */
export function sameData(a: AppData, b: AppData): boolean {
  if (JSON.stringify(clubToRow(a.club)) !== JSON.stringify(clubToRow(b.club))) return false;
  return SPECS.every((spec) => {
    const norm = (d: AppData) =>
      JSON.stringify([...(d[spec.key] as { id: string }[])].map((x): Row => ({ ...spec.toRow(x, 0, ""), position: 0 })).sort((x, y) => String(x.id).localeCompare(String(y.id))));
    return norm(a) === norm(b);
  });
}

export function rowsToData(club: Row, tables: Record<string, Row[]>): AppData {
  const data = emptyData(clubFromRow(club));
  for (const spec of SPECS) (data[spec.key] as unknown[]) = (tables[spec.table] ?? []).map(spec.fromRow);
  return data;
}
