import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeChanges, emptyData, remapIds, rowsToData, sameData, SPECS, clubToRow } from "./repository";
import { createSeedData } from "./seed";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CLUB = "11111111-1111-4111-8111-111111111111";

describe("repository mapping", () => {
  it("round-trips the whole demo season through database rows", () => {
    const data = remapIds(createSeedData());
    const tables = Object.fromEntries(
      SPECS.map((s) => [s.table, (data[s.key] as { id: string }[]).map((x, i) => s.toRow(x, i, CLUB))]),
    );
    const back = rowsToData({ id: CLUB, ...clubToRow(data.club) }, tables);
    assert.ok(sameData(data, back));
    assert.deepEqual(back.bookings, data.bookings);
    assert.deepEqual(back.matches, data.matches);
  });

  it("remaps every id to a UUID without dangling references", () => {
    const data = remapIds(createSeedData());
    const ids = new Set<string>();
    for (const s of SPECS) for (const x of data[s.key] as { id: string }[]) {
      assert.match(x.id, UUID);
      ids.add(x.id);
    }
    const refs = [
      ...data.bookings.flatMap((b) => [b.fieldId, b.teamId]),
      ...data.matches.flatMap((m) => [m.teamId, m.fieldId]),
      ...data.roomAssignments.flatMap((a) => [a.roomId, a.teamId, a.matchId]),
      ...data.duties.flatMap((d) => [d.teamId, d.matchId]),
      ...data.closures.map((c) => c.fieldId),
    ].filter((x): x is string => !!x);
    for (const r of refs) assert.ok(ids.has(r), `dangling reference ${r}`);
  });
});

describe("computeChanges", () => {
  const base = remapIds(createSeedData());

  it("writes nothing when nothing changed", () => {
    const c = computeChanges(CLUB, base, { ...base });
    assert.equal(c.club, undefined);
    assert.equal(c.upserts.length, 0);
    assert.equal(c.deletes.length, 0);
  });

  it("upserts only the moved booking", () => {
    const moved = { ...base, bookings: base.bookings.map((b, i) => (i === 0 ? { ...b, start: b.start + 15, end: b.end + 15 } : b)) };
    const c = computeChanges(CLUB, base, moved);
    assert.deepEqual(c.upserts.map((u) => [u.table, u.rows.length]), [["bookings", 1]]);
    assert.equal(c.upserts[0].rows[0].start_min, base.bookings[0].start + 15);
  });

  it("deletes children before parents and inserts parents before children", () => {
    const team = base.teams[0];
    const without = {
      ...base,
      teams: base.teams.filter((t) => t.id !== team.id),
      bookings: base.bookings.filter((b) => b.teamId !== team.id),
      matches: base.matches.filter((m) => m.teamId !== team.id),
    };
    const del = computeChanges(CLUB, base, without).deletes.map((d) => d.table);
    assert.ok(del.indexOf("bookings") < del.indexOf("teams"));
    assert.ok(del.indexOf("matches") < del.indexOf("teams"));

    const ins = computeChanges(CLUB, emptyData(base.club), base).upserts.map((u) => u.table);
    assert.ok(ins.indexOf("fields") < ins.indexOf("bookings"));
    assert.ok(ins.indexOf("matches") < ins.indexOf("room_assignments"));
  });

  it("detects club setting changes", () => {
    const c = computeChanges(CLUB, base, { ...base, club: { ...base.club, roomBuffer: 15 } });
    assert.equal(c.club?.room_buffer, 15);
  });
});
