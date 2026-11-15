import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fieldSlotsForDate } from "./planning";
import { applyRequest, rejectRequest, requestConflicts } from "./requests";
import { createSeedData } from "./seed";
import { addDays, nextWeekday, todayISO, weekdayOf } from "./time";
import type { ChangeRequest } from "./types";

const data = createSeedData();
const training = data.bookings.find((b) => b.kind === "training" && b.weekday === 2 && b.teamId)!;
const date = nextWeekday(addDays(todayISO(), 1), 2);
const base = (over: Partial<ChangeRequest>): ChangeRequest => ({
  id: "req-1", teamId: training.teamId!, bookingId: training.id, scope: "eenmalig", date,
  fieldId: training.fieldId, sections: training.sections, start: training.start + 30, end: training.end + 30,
  note: "", status: "open", createdByName: "Trainer", ...over,
});
const withReq = (r: ChangeRequest) => ({ ...data, requests: [r] });

describe("applyRequest", () => {
  it("moves only one week of a recurring training", () => {
    const r = base({});
    const next = applyRequest(withReq(r), r, "Secretaris");
    const series = next.bookings.find((b) => b.id === training.id)!;
    assert.ok(series.exceptions?.includes(date));
    assert.equal(series.start, training.start);
    const slots = fieldSlotsForDate(next, date).filter((s) => s.teamId === training.teamId && s.kind === "training");
    assert.deepEqual(slots.map((s) => s.start), [training.start + 30]);
    // the week after is untouched
    const later = fieldSlotsForDate(next, addDays(date, 7)).filter((s) => s.teamId === training.teamId && s.kind === "training");
    assert.deepEqual(later.map((s) => s.start), [training.start]);
    assert.equal(next.requests[0].status, "goedgekeurd");
    assert.equal(next.requests[0].decidedByName, "Secretaris");
  });

  it("moves the whole series", () => {
    const r = base({ scope: "reeks" });
    const next = applyRequest(withReq(r), r, "S");
    assert.equal(next.bookings.find((b) => b.id === training.id)!.start, training.start + 30);
    assert.equal(next.bookings.length, data.bookings.length);
  });

  it("adds an extra training", () => {
    const r = base({ bookingId: undefined, scope: "reeks" });
    const next = applyRequest(withReq(r), r, "S");
    const added = next.bookings.at(-1)!;
    assert.equal(next.bookings.length, data.bookings.length + 1);
    assert.equal(added.weekday, weekdayOf(date));
    assert.equal(added.teamId, training.teamId);
  });

  it("moves a home match and shifts its changing rooms", () => {
    const match = data.matches.find((m) => m.home && m.fieldId && data.roomAssignments.some((a) => a.matchId === m.id))!;
    const room = data.roomAssignments.find((a) => a.matchId === match.id)!;
    const r = base({ bookingId: undefined, matchId: match.id, teamId: match.teamId, date: match.date, fieldId: match.fieldId!, sections: match.sections!, start: match.kickoff + 60, end: match.kickoff + 120 });
    const next = applyRequest(withReq(r), r, "S");
    assert.equal(next.matches.find((m) => m.id === match.id)!.kickoff, match.kickoff + 60);
    assert.equal(next.roomAssignments.find((a) => a.id === room.id)!.start, room.start + 60);
  });

  it("rejects without touching the planning", () => {
    const r = base({});
    const next = rejectRequest(withReq(r), r, "S", "Helaas vol");
    assert.equal(next.bookings, data.bookings);
    assert.equal(next.requests[0].status, "afgewezen");
    assert.equal(next.requests[0].decisionNote, "Helaas vol");
  });
});

describe("requestConflicts", () => {
  it("ignores the training that is being moved", () => {
    const r = base({ start: training.start, end: training.end });
    assert.deepEqual(requestConflicts(withReq(r), r), []);
  });

  it("reports overlap with another team", () => {
    const other = data.bookings.find((b) => b.weekday === 2 && b.teamId !== training.teamId)!;
    const r = base({ fieldId: other.fieldId, sections: other.sections, start: other.start, end: other.end });
    assert.ok(requestConflicts(withReq(r), r).some((c) => c.startsWith("Overlapt met")));
  });
});
