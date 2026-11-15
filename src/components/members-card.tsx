"use client";

import { Clock, Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { deleteInvite, inviteMember, listMembers, removeMember, ROLE_LABELS, setMemberRole, type Invite, type Member, type Role } from "@/lib/cloud";
import { useAccount } from "./account";
import { useToast } from "./toast";
import { Badge, Button, Card, CardHeader, Input, Select } from "./ui";

const ROLES: Role[] = ["admin", "planner", "viewer"];
const ROLE_HELP: Record<Role, string> = {
  admin: "Alles, inclusief leden beheren",
  planner: "Planning en instellingen bewerken",
  viewer: "Alles bekijken, niets wijzigen (bijv. trainers, kantine-tv)",
};

export function MembersCard() {
  const { state, sb } = useAccount();
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("planner");
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
              <p className="text-xs text-stone-500">{ROLE_HELP[m.role]}</p>
            </div>
            {isAdmin ? (
              <>
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
              <p className="text-xs text-stone-500">Uitgenodigd als {ROLE_LABELS[i.role].toLowerCase()} · wordt lid zodra deze persoon inlogt</p>
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
            if (!email.includes("@")) return;
            run(async () => {
              await inviteMember(sb, club.clubId, email, role, state.userId);
              setEmail("");
            }, `Uitnodiging klaargezet voor ${email}`);
          }}
        >
          <div className="min-w-56 flex-1">
            <Input type="email" required placeholder="naam@voorbeeld.nl" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mailadres" />
          </div>
          <Select className="w-40" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Rol">
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
          <Button type="submit" variant="primary"><UserPlus size={16} /> Uitnodigen</Button>
          <p className="w-full text-xs text-stone-500">
            Laat de persoon daarna inloggen via deze site met dit e-mailadres; de uitnodiging wordt dan automatisch omgezet in een lidmaatschap.
          </p>
        </form>
      )}
      {error && <p className="px-5 pb-4 text-sm text-red-700">{error.includes("beheerder") ? "Een club heeft minimaal één beheerder nodig." : error}</p>}
    </Card>
  );
}
