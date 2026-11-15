import { defaultsForAge, teamAge } from "./meta";
import { autoAssignRooms, distributeDuties, findFreePlacement, generateDuties, optimizeKickoffs } from "./planning";
import { addDays, nextWeekday, todayISO } from "./time";
import type { AppData, Booking, Category, Field, FieldNeed, Match, Room, Team } from "./types";

let counter = 0;
export function uid(prefix = "id"): string {
  counter += 1;
  const rnd = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rnd}${counter}`;
}

const FIELDS: Field[] = [
  { id: "f1", name: "Veld 1", surface: "kunstgras", lit: true },
  { id: "f2", name: "Veld 2", surface: "kunstgras", lit: true },
  { id: "f3", name: "Veld 3", surface: "natuurgras", lit: true },
  { id: "f4", name: "Veld 4", surface: "natuurgras", lit: false },
];

const ROOMS: Room[] = [
  { id: "k1", name: "Kleedkamer 1", capacity: 18, kind: "team" },
  { id: "k2", name: "Kleedkamer 2", capacity: 18, kind: "team" },
  { id: "k3", name: "Kleedkamer 3", capacity: 18, kind: "team" },
  { id: "k4", name: "Kleedkamer 4", capacity: 18, kind: "team" },
  { id: "k5", name: "Kleedkamer 5", capacity: 22, kind: "team" },
  { id: "k6", name: "Kleedkamer 6", capacity: 22, kind: "team" },
  { id: "k7", name: "Kleedkamer 7", capacity: 12, kind: "team" },
  { id: "k8", name: "Kleedkamer 8", capacity: 12, kind: "team" },
  { id: "s1", name: "Scheidsrechters 1", capacity: 3, kind: "scheidsrechter" },
  { id: "s2", name: "Scheidsrechters 2", capacity: 3, kind: "scheidsrechter" },
];

type Spec = {
  name: string; category: Category; trainer: string; players: number;
  days: number[]; start: string; duration: number; trainNeed: FieldNeed; room: boolean;
};

const SPECS: Spec[] = [
  { name: "JO8-1", category: "pupillen", trainer: "Sanne de Vries", players: 8, days: [1, 3], start: "17:30", duration: 60, trainNeed: "kwart", room: false },
  { name: "JO8-2", category: "pupillen", trainer: "Joris Bakker", players: 8, days: [1, 3], start: "17:30", duration: 60, trainNeed: "kwart", room: false },
  { name: "JO9-1", category: "pupillen", trainer: "Mehmet Yilmaz", players: 9, days: [2, 4], start: "17:30", duration: 60, trainNeed: "kwart", room: false },
  { name: "JO9-2", category: "pupillen", trainer: "Lotte Jansen", players: 9, days: [2, 4], start: "17:30", duration: 60, trainNeed: "kwart", room: false },
  { name: "JO10-1", category: "pupillen", trainer: "Pieter Smit", players: 10, days: [1, 3], start: "17:30", duration: 75, trainNeed: "kwart", room: false },
  { name: "JO11-1", category: "pupillen", trainer: "Fatima El Amrani", players: 11, days: [2, 4], start: "17:45", duration: 75, trainNeed: "kwart", room: false },
  { name: "JO11-2", category: "pupillen", trainer: "Tom Visser", players: 10, days: [1, 4], start: "18:30", duration: 75, trainNeed: "kwart", room: false },
  { name: "JO12-1", category: "pupillen", trainer: "Kees Mulder", players: 12, days: [2, 4], start: "18:30", duration: 75, trainNeed: "half", room: false },
  { name: "JO13-1", category: "junioren", trainer: "Rachid Bouali", players: 14, days: [1, 3], start: "18:30", duration: 90, trainNeed: "half", room: true },
  { name: "JO13-2", category: "junioren", trainer: "Eva Hendriks", players: 13, days: [2, 4], start: "18:45", duration: 90, trainNeed: "half", room: true },
  { name: "JO15-1", category: "junioren", trainer: "Bas van Dijk", players: 16, days: [1, 3], start: "19:00", duration: 90, trainNeed: "half", room: true },
  { name: "JO17-1", category: "junioren", trainer: "Niels de Boer", players: 17, days: [2, 4], start: "19:30", duration: 90, trainNeed: "half", room: true },
  { name: "JO19-1", category: "junioren", trainer: "Dennis Kok", players: 18, days: [1, 3], start: "19:45", duration: 90, trainNeed: "half", room: true },
  { name: "MO13-1", category: "vrouwen", trainer: "Ilse Peters", players: 12, days: [1, 3], start: "18:00", duration: 75, trainNeed: "kwart", room: false },
  { name: "MO17-1", category: "vrouwen", trainer: "Anouk Willems", players: 15, days: [2, 4], start: "19:00", duration: 90, trainNeed: "half", room: true },
  { name: "Vrouwen 1", category: "vrouwen", trainer: "Marloes Vos", players: 18, days: [1, 3], start: "20:30", duration: 90, trainNeed: "half", room: true },
  { name: "Heren 1", category: "senioren", trainer: "Frank Meijer", players: 20, days: [2, 4], start: "20:00", duration: 105, trainNeed: "heel", room: true },
  { name: "Heren 2", category: "senioren", trainer: "Ruud Brouwer", players: 18, days: [2, 4], start: "20:30", duration: 90, trainNeed: "half", room: true },
  { name: "Heren 3", category: "senioren", trainer: "Gert de Groot", players: 16, days: [3], start: "20:30", duration: 90, trainNeed: "half", room: true },
  { name: "Heren 35+", category: "recreatief", trainer: "Henk Koster", players: 16, days: [5], start: "20:00", duration: 90, trainNeed: "half", room: true },
  { name: "Walking Football", category: "recreatief", trainer: "Joop Prins", players: 12, days: [3], start: "10:00", duration: 75, trainNeed: "half", room: true },
];

const OPPONENTS = [
  "SV Zuidwijk", "VV Heidebloem", "RKSV Oranje Noord", "FC Polderzicht", "SC Botervliet", "VV Rietland",
  "DOS '52", "SV Kanaalzone", "VV Lindehoeve", "Sparta Westdorp", "SV Molenbeek", "VV Ons Dorp",
];

const t = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

export function createSeedData(): AppData {
  const today = todayISO();
  const teams: Team[] = SPECS.map((s, i) => {
    const base = { id: `t${i + 1}`, name: s.name, category: s.category, trainer: s.trainer, players: s.players, roomForTraining: s.room };
    const age = teamAge(base as Team);
    return { ...base, ...defaultsForAge(age) };
  });

  // Weekly trainings, placed conflict-free; unlit fields only before dark (18:00 in winter).
  const bookings: Booking[] = [];
  SPECS.forEach((s, i) => {
    for (const day of s.days) {
      const start = t(s.start);
      const end = start + s.duration;
      const slots = bookings.filter((b) => b.weekday === day);
      const fields = end > 18 * 60 ? FIELDS.filter((f) => f.lit) : FIELDS;
      let place = null;
      for (let shift = 0; shift <= 90 && !place; shift += 15) {
        place = findFreePlacement(slots, { fields, closures: [] }, "", s.trainNeed, start + shift, end + shift);
        if (place) {
          bookings.push({ id: uid("b"), kind: "training", teamId: `t${i + 1}`, weekday: day, start: start + shift, end: end + shift, ...place });
        }
      }
    }
  });

  const saturday = nextWeekday(addDays(today, 1), 6);
  const sunday = addDays(saturday, 1);
  const lastSaturday = addDays(saturday, -7);
  const nextSaturday = addDays(saturday, 7);
  const thisSunday = nextWeekday(today, 7);

  // A deliberate double booking on Wednesday to show conflict detection.
  const wednesday = nextWeekday(today, 3);
  const wedTraining = bookings.find((b) => b.weekday === 3 && b.start >= t("18:30"));
  if (wedTraining) {
    bookings.push({
      id: uid("b"), kind: "overig", label: "Keeperstraining", date: wednesday, fieldId: wedTraining.fieldId,
      sections: [wedTraining.sections[0]], start: wedTraining.start + 15, end: wedTraining.start + 75,
    });
  }

  const matches: Match[] = [];
  const opp = (i: number, team: Team) => `${OPPONENTS[i % OPPONENTS.length]} ${team.name.replace("Heren", "").replace("Vrouwen", "VR").trim() || "1"}`;
  const youth = teams.filter((tm) => tm.category !== "senioren" && tm.name !== "Walking Football" && tm.name !== "Vrouwen 1" && tm.name !== "Heren 35+");
  youth.forEach((team, i) => {
    const home = i % 3 !== 2;
    matches.push({
      id: uid("m"), teamId: team.id, opponent: opp(i, team), date: saturday, kickoff: t("09:00") + (i % 6) * 30,
      home, status: "gepland",
    });
    matches.push({
      id: uid("m"), teamId: team.id, opponent: opp(i + 5, team), date: lastSaturday, kickoff: t("09:00") + (i % 6) * 30,
      home: !home, status: "gespeeld", scoreHome: (i * 7) % 5, scoreAway: (i * 3) % 4,
    });
    if (i % 2 === 0) {
      matches.push({
        id: uid("m"), teamId: team.id, opponent: opp(i + 3, team), date: nextSaturday, kickoff: t("10:00") + (i % 4) * 45,
        home: !home, status: "gepland",
      });
    }
  });
  const byName = (n: string) => teams.find((tm) => tm.name === n)!;
  matches.push(
    { id: uid("m"), teamId: byName("Heren 1").id, opponent: "VV Rietland 1", date: thisSunday, kickoff: t("14:00"), home: true, status: "gepland", fieldId: "f1", sections: [0, 1, 2, 3] },
    { id: uid("m"), teamId: byName("Vrouwen 1").id, opponent: "SV Molenbeek VR1", date: thisSunday, kickoff: t("11:00"), home: true, status: "gepland", fieldId: "f2", sections: [0, 1, 2, 3] },
    { id: uid("m"), teamId: byName("Heren 2").id, opponent: "SC Botervliet 3", date: thisSunday, kickoff: t("11:30"), home: false, status: "gepland" },
    { id: uid("m"), teamId: byName("Heren 3").id, opponent: "FC Polderzicht 5", date: saturday, kickoff: t("14:30"), home: true, status: "gepland" },
    { id: uid("m"), teamId: byName("Heren 1").id, opponent: "DOS '52 1", date: addDays(sunday, 0), kickoff: t("14:00"), home: false, status: "gepland" },
    { id: uid("m"), teamId: byName("Heren 1").id, opponent: "SV Kanaalzone 1", date: addDays(thisSunday, -7), kickoff: t("14:00"), home: true, status: "gespeeld", scoreHome: 2, scoreAway: 1 },
  );

  const data: AppData = {
    version: 1,
    club: {
      name: "VV De Zwaluwen", shortName: "Zwaluwen", city: "Veldhoven aan Zee", sport: "voetbal",
      roomBefore: 45, roomAfter: 30, roomBuffer: 10, fieldBuffer: 10, roomsFromAge: 10,
    },
    fields: FIELDS,
    rooms: ROOMS,
    teams,
    bookings,
    matches,
    roomAssignments: [],
    duties: [],
    closures: [{ id: uid("c"), fieldId: "f4", date: saturday, reason: "Afgekeurd door regen" }],
  };

  // Let the planner do the work for the upcoming match day: kick-off times, fields, changing rooms.
  for (const day of [saturday]) {
    const { updates } = optimizeKickoffs(data, day);
    data.matches = data.matches.map((m) => (updates.has(m.id) ? { ...m, ...updates.get(m.id) } : m));
  }
  for (const day of [saturday, thisSunday]) {
    data.roomAssignments.push(...autoAssignRooms(data, day).assignments);
  }

  // Volunteer duties for Saturday, partly handed out.
  data.duties = generateDuties(data, saturday, () => uid("d"));
  const dist = distributeDuties(data, saturday);
  const names = ["Wim (ouder JO9-1)", "Ingrid Smit", "Mark de Jong", "Petra Leeuw"];
  let n = 0;
  data.duties = data.duties.map((d, i) => {
    if (i % 3 === 0 && d.role === "bardienst") return { ...d, person: names[n++ % names.length] };
    if (i % 4 === 1 && dist.has(d.id)) return { ...d, teamId: dist.get(d.id) };
    return d;
  });

  return data;
}
