import { uid } from "./id";
import { fieldSlotsForDate, isFieldClosed, sectionsLabel } from "./planning";
import { fmtTime, formatDate, overlaps, WEEKDAYS, weekdayOf } from "./time";
import type { AppData, ChangeRequest } from "./types";

/** What the request asks for, in one human sentence. */
export function describeRequest(data: AppData, r: ChangeRequest): string {
  const team = data.teams.find((t) => t.id === r.teamId)?.name ?? "Team";
  const field = data.fields.find((f) => f.id === r.fieldId)?.name ?? "veld";
  const where = `${field} ${sectionsLabel(r.sections)}, ${fmtTime(r.start)}–${fmtTime(r.end)}`;
  const when = r.scope === "reeks" ? `elke ${WEEKDAYS[weekdayOf(r.date) - 1]} vanaf ${formatDate(r.date)}` : formatDate(r.date, { long: true });
  if (r.matchId) return `${team}: wedstrijd op ${formatDate(r.date)} verplaatsen naar ${where}`;
  if (r.bookingId) return `${team}: training ${when} verplaatsen naar ${where}`;
  return `${team}: extra training ${when}, ${where}`;
}

/** The current situation the request would replace, if any. */
export function currentSituation(data: AppData, r: ChangeRequest): string | null {
  if (r.matchId) {
    const m = data.matches.find((x) => x.id === r.matchId);
    if (!m) return null;
    const field = m.fieldId ? data.fields.find((f) => f.id === m.fieldId)?.name : "nog geen veld";
    return `Nu: ${field}${m.sections ? ` ${sectionsLabel(m.sections)}` : ""}, aftrap ${fmtTime(m.kickoff)}`;
  }
  if (r.bookingId) {
    const b = data.bookings.find((x) => x.id === r.bookingId);
    if (!b) return null;
    return `Nu: ${data.fields.find((f) => f.id === b.fieldId)?.name} ${sectionsLabel(b.sections)}, ${fmtTime(b.start)}–${fmtTime(b.end)}`;
  }
  return null;
}

/** Conflicts the requested slot would cause on its date (ignoring the slot that is being moved). */
export function requestConflicts(data: AppData, r: ChangeRequest): string[] {
  const issues: string[] = [];
  const closure = isFieldClosed(data.closures, r.fieldId, r.date);
  if (closure) issues.push(`Veld is afgekeurd op ${formatDate(r.date)} (${closure.reason})`);
  const own = r.matchId ? `m:${r.matchId}` : r.bookingId ? `b:${r.bookingId}` : null;
  for (const s of fieldSlotsForDate(data, r.date)) {
    if (s.key === own || s.fieldId !== r.fieldId) continue;
    if (!s.sections.some((x) => r.sections.includes(x)) || !overlaps(s.start, s.end, r.start, r.end)) continue;
    issues.push(`Overlapt met ${s.title}${s.subtitle ? ` (${s.subtitle})` : ""} ${fmtTime(s.start)}–${fmtTime(s.end)}`);
  }
  const field = data.fields.find((f) => f.id === r.fieldId);
  if (field && !field.lit && r.end > 18 * 60) issues.push(`${field.name} heeft geen verlichting`);
  return issues;
}

/** Apply an approved request to the planning and mark it approved. */
export function applyRequest(data: AppData, r: ChangeRequest, decidedByName: string, note?: string): AppData {
  const decided: ChangeRequest = { ...r, status: "goedgekeurd", decidedByName, decidedAt: new Date().toISOString(), decisionNote: note || undefined };
  let next: AppData = { ...data, requests: data.requests.map((x) => (x.id === r.id ? decided : x)) };
  const slot = { fieldId: r.fieldId, sections: r.sections, start: r.start, end: r.end };

  if (r.matchId) {
    const m = next.matches.find((x) => x.id === r.matchId);
    if (!m) return next;
    const shift = r.start - m.kickoff;
    next = {
      ...next,
      matches: next.matches.map((x) => (x.id === m.id ? { ...x, kickoff: r.start, fieldId: r.fieldId, sections: r.sections } : x)),
      roomAssignments: next.roomAssignments.map((a) => (a.matchId === m.id ? { ...a, start: a.start + shift, end: a.end + shift } : a)),
    };
    return next;
  }

  const booking = r.bookingId ? next.bookings.find((b) => b.id === r.bookingId) : undefined;
  if (booking && (r.scope === "reeks" || booking.date)) {
    // Move the whole weekly series (or the one-off booking itself)
    next = { ...next, bookings: next.bookings.map((b) => (b.id === booking.id ? { ...b, ...slot } : b)) };
  } else if (booking) {
    // Only this week: skip the series on that date and add a one-off booking
    next = {
      ...next,
      bookings: [
        ...next.bookings.map((b) => (b.id === booking.id ? { ...b, exceptions: [...(b.exceptions ?? []), r.date] } : b)),
        { id: uid(), kind: "training", teamId: r.teamId, date: r.date, ...slot, label: booking.label },
      ],
    };
  } else {
    // Extra training
    next = {
      ...next,
      bookings: [
        ...next.bookings,
        r.scope === "reeks"
          ? { id: uid(), kind: "training", teamId: r.teamId, weekday: weekdayOf(r.date), ...slot }
          : { id: uid(), kind: "training", teamId: r.teamId, date: r.date, ...slot },
      ],
    };
  }
  return next;
}

export function rejectRequest(data: AppData, r: ChangeRequest, decidedByName: string, note?: string): AppData {
  return {
    ...data,
    requests: data.requests.map((x) =>
      x.id === r.id ? { ...x, status: "afgewezen", decidedByName, decidedAt: new Date().toISOString(), decisionNote: note || undefined } : x,
    ),
  };
}
