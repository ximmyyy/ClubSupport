import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  autoAssignRooms, distributeDuties, fieldSlotsForDate, findFieldConflicts, findFreePlacement, findRoomConflicts,
  generateDuties, optimizeKickoffs, roomDemandsForDate, sectionsForLane,
} from "./planning";
import { createSeedData } from "./seed";
import { addDays, nextWeekday, todayISO } from "./time";

const saturday = () => nextWeekday(addDays(todayISO(), 1), 6);

describe("field sections", () => {
  it("snaps lanes to valid section sets", () => {
    assert.deepEqual(sectionsForLane("heel", 2), [0, 1, 2, 3]);
    assert.deepEqual(sectionsForLane("half", 1), [0, 1]);
    assert.deepEqual(sectionsForLane("half", 3), [2, 3]);
    assert.deepEqual(sectionsForLane("kwart", 5), [3]);
  });

  it("finds a free quarter next to an occupied half", () => {
    const data = { fields: [{ id: "f", name: "Veld", surface: "kunstgras" as const, lit: true }], closures: [] };
    const slots = [{ fieldId: "f", sections: [0, 1], start: 600, end: 660 }];
    assert.deepEqual(findFreePlacement(slots, data, "2026-01-01", "kwart", 600, 660), { fieldId: "f", sections: [2] });
    assert.equal(findFreePlacement(slots, data, "2026-01-01", "heel", 600, 660), null);
    // buffer pushes a back-to-back booking into a clash
    assert.equal(findFreePlacement(slots, data, "2026-01-01", "half", 665, 700, 10)?.sections.join(), "2,3");
  });

  it("skips closed fields", () => {
    const data = { fields: [{ id: "f", name: "Veld", surface: "kunstgras" as const, lit: true }], closures: [{ id: "c", fieldId: "f", date: "d", reason: "regen" }] };
    assert.equal(findFreePlacement([], data, "d", "kwart", 600, 660), null);
  });
});

describe("demo season", () => {
  it("has exactly one deliberate field conflict in the coming week", () => {
    const data = createSeedData();
    const conflicts = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(todayISO(), i);
      conflicts.push(...findFieldConflicts(fieldSlotsForDate(data, date), data, date).filter((c) => !c.message.includes("afgekeurd")));
    }
    assert.equal(conflicts.length, 1);
    assert.match(conflicts[0].message, /Keeperstraining/);
  });

  it("plans the match day without field or changing-room conflicts", () => {
    const data = createSeedData();
    const date = saturday();
    assert.equal(findFieldConflicts(fieldSlotsForDate(data, date), data, date).filter((c) => !c.message.includes("afgekeurd")).length, 0);
    const { assignments, unassigned } = autoAssignRooms(data, date);
    assert.equal(unassigned.length, 0);
    assert.equal(findRoomConflicts(assignments, data.club.roomBuffer).length, 0);
    assert.equal(assignments.length, roomDemandsForDate(data, date).length);
  });

  it("keeps kick-offs inside the day and never uses the closed field", () => {
    const data = createSeedData();
    const date = saturday();
    const { updates, failed } = optimizeKickoffs(data, date);
    assert.equal(failed.length, 0);
    const closed = data.closures.find((c) => c.date === date)!.fieldId;
    for (const u of updates.values()) {
      assert.ok(u.kickoff! >= 8 * 60 + 30);
      assert.notEqual(u.fieldId, closed);
    }
  });

  it("gives referee duties only to teams older than the players", () => {
    const data = createSeedData();
    const date = saturday();
    data.duties = generateDuties({ ...data, duties: [] }, date, (() => { let i = 0; return () => `d${i++}`; })());
    const result = distributeDuties(data, date);
    assert.ok(result.size > 0);
    const age = (name: string) => Number(name.match(/O(\d+)/)?.[1] ?? 99);
    for (const [dutyId, teamId] of result) {
      const duty = data.duties.find((d) => d.id === dutyId)!;
      if (!duty.matchId) continue;
      const match = data.matches.find((m) => m.id === duty.matchId)!;
      const players = data.teams.find((t) => t.id === match.teamId)!;
      const ref = data.teams.find((t) => t.id === teamId)!;
      assert.ok(age(ref.name) > age(players.name) + 1, `${ref.name} fluit ${players.name}`);
    }
  });
});
