"use client";

import { ChevronDown, Clock, Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteInvite, inviteMember, listMembers, removeMember, ROLE_LABELS, setMemberRole, setMemberTeams, type Invite, type Member, type Role } from "@/lib/cloud";
import { teamAge } from "@/lib/meta";
import { useStore } from "@/lib/store";
import { useAccount } from "./account";
import { useToast } from "./toast";
import { Badge, Button, Card, CardHeader, Input, Select } from "./ui";

const ROLES: Role[] = ["admin", "planner", "trainer", "viewer"];
const ROLE_HELP: Record<Role, string> = {
  admin: "Alles, inclusief leden beheren",
  planner: "Planning en instellingen bewerken",
  trainer: "Alles bekijken, wijzigingen aanvragen voor eigen team(s)",
  viewer: "Alles bekijken, niets wijzigen (bijv. trainers, kantine-tv)",
};

export function MembersCard() {
  const { state, sb } = useAccount();
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("planner");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const { data } = useStore();
  const teamName = (id: string) => data.teams.find((t) => t.id === id)?.name;
  const [error, setError] = useState<string | null>(null);
  const club = state.status === "club" ? state.active : null;
  const isAdmin = club?.role === "admin";

  const refresh = useCallback(async () => {
    if (!sb || !club) return;
    try {
      const r = await listMembers(sb, club.clubId);
      setMembers(r.members);
      setInvites(r.invites);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [sb, club]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from Supabase
    refresh();
  }, [refresh]);

  if (!club || !sb || state.status !== "club") return null;

  const run = async (fn: () => Promise<void>, ok: string) => {
    setError(null);
    try {
      await fn();
      toast(ok);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Card className="xl:col-span-2">
      <CardHeader
        title="Leden & rechten"
        subtitle={isAdmin ? "Nodig bestuursleden, planners en trainers uit. Ze loggen in met een inloglink op hun eigen e-mailadres." : "Alleen beheerders kunnen leden beheren."}
      />
      <div className="divide-y divide-stone-100">
        {members.map((m) => (
          <div key={m.userId} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.email || "Onbekend"} {m.userId === state.userId && <span className="text-stone-400">(jij)</span>}</p>
              <p className="text-xs text-stone-500">
                {m.role === "trainer" && m.teamIds.length ? `Trainer van ${m.teamIds.map(teamName).filter(Boolean).join(", ")}` : ROLE_HELP[m.role]}
              </p>
            </div>
            {isAdmin ? (
              <>
                {m.role === "trainer" && (
                  <TeamPicker value={m.teamIds} onChange={(ids) => run(() => setMemberTeams(sb, club.clubId, m.userId, ids), "Teams bijgewerkt")} />
                )}
                <Select className="h-9 w-40" value={m.role} onChange={(e) => run(() => setMemberRole(sb, club.clubId, m.userId, e.target.value as Role), "Rol aangepast")}>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </Select>
                <button
                  onClick={() => run(() => removeMember(sb, club.clubId, m.userId), "Lid verwijderd")}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`${m.email} verwijderen`}
                >
                  <Trash2 size={16} />
                </button>
              </>
            ) : (
              <Badge>{ROLE_LABELS[m.role]}</Badge>
            )}
          </div>
        ))}
        {invites.map((i) => (
          <div key={i.email} className="flex flex-wrap items-center gap-3 bg-amber-50/40 px-5 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium"><Clock size={14} className="text-amber-600" /> {i.email}</p>
              <p className="text-xs text-stone-500">
                Uitgenodigd als {ROLE_LABELS[i.role].toLowerCase()}
                {i.teamIds.length ? ` van ${i.teamIds.map(teamName).filter(Boolean).join(", ")}` : ""} · wordt lid zodra deze persoon inlogt
              </p>
            </div>
            <button onClick={() => run(() => deleteInvite(sb, club.clubId, i.email), "Uitnodiging ingetrokken")} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label={`Uitnodiging ${i.email} intrekken`}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      {isAdmin && (
        <form
          className="flex flex-wrap items-end gap-2 border-t border-stone-100 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.includes("@") || (role === "trainer" && !teamIds.length)) return;
            run(async () => {
              await inviteMember(sb, club.clubId, email, role, state.userId, teamIds);
              setEmail("");
              setTeamIds([]);
            }, `Uitnodiging klaargezet voor ${email}`);
          }}
        >
          <div className="min-w-56 flex-1">
            <Input type="email" required placeholder="naam@voorbeeld.nl" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mailadres" />
          </div>
          <Select className="w-40" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Rol">
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
          {role === "trainer" && <TeamPicker value={teamIds} onChange={setTeamIds} />}
          <Button type="submit" variant="primary" disabled={role === "trainer" && !teamIds.length}><UserPlus size={16} /> Uitnodigen</Button>
          <p className="w-full text-xs text-stone-500">
            Laat de persoon daarna inloggen via deze site met dit e-mailadres; de uitnodiging wordt dan automatisch omgezet in een lidmaatschap.
          </p>
        </form>
      )}
      {error && <p className="px-5 pb-4 text-sm text-red-700">{error.includes("beheerder") ? "Een club heeft minimaal één beheerder nodig." : error}</p>}
    </Card>
  );
}

/** Compact multi-select for the teams a trainer coaches. */
export function TeamPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { data } = useStore();
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLDetailsElement>(null);
  const teams = [...data.teams].sort((a, b) => teamAge(a) - teamAge(b) || a.name.localeCompare(b.name));
  const label = value.length ? value.map((id) => data.teams.find((t) => t.id === id)?.name).filter(Boolean).join(", ") : "Kies team(s)";
  return (
    <details
      ref={ref}
      className="relative"
      onToggle={(e) => {
        const open = (e.currentTarget as HTMLDetailsElement).open;
        if (open) setDraft(value);
        else if (draft.join() !== value.join()) onChange(draft);
      }}
    >
      <summary className="flex h-9 max-w-52 cursor-pointer list-none items-center gap-1 truncate rounded-lg border border-stone-300 bg-white px-3 text-sm shadow-sm">
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className="ml-auto shrink-0 text-stone-400" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-xl border border-stone-200 bg-white p-2 shadow-xl">
        {teams.map((t) => (
          <label key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-stone-50">
            <input
              type="checkbox"
              className="accent-brand-600"
              checked={draft.includes(t.id)}
              onChange={(e) => setDraft((d) => (e.target.checked ? [...d, t.id] : d.filter((x) => x !== t.id)))}
            />
            {t.name}
          </label>
        ))}
        <Button size="sm" variant="primary" className="mt-2 w-full" onClick={() => ref.current && (ref.current.open = false)}>Klaar</Button>
      </div>
    </details>
  );
}
