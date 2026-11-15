"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeChanges, rowsToData, SPECS } from "./repository";
import type { AppData } from "./types";

export type Role = "admin" | "planner" | "trainer" | "viewer";
export interface ClubMembership { clubId: string; role: Role; teamIds: string[]; name: string; shortName: string }
export interface Member { userId: string; email: string; role: Role; teamIds: string[] }
export interface Invite { email: string; role: Role; teamIds: string[]; createdAt: string }

const PAGE = 1000;

async function fetchAll(sb: SupabaseClient, table: string, clubId: string, order: string[]) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select("*").eq("club_id", clubId);
    for (const o of order) q = q.order(o);
    const { data, error } = await q.order("id").range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function loadClub(sb: SupabaseClient, clubId: string): Promise<AppData> {
  const { data: club, error } = await sb.from("clubs").select("*").eq("id", clubId).single();
  if (error) throw error;
  const entries = await Promise.all(SPECS.map(async (s) => [s.table, await fetchAll(sb, s.table, clubId, s.order)] as const));
  return rowsToData(club, Object.fromEntries(entries));
}

export async function saveChanges(sb: SupabaseClient, clubId: string, prev: AppData, next: AppData) {
  const changes = computeChanges(clubId, prev, next);
  if (changes.club) {
    const { error } = await sb.from("clubs").update(changes.club).eq("id", clubId);
    if (error) throw error;
  }
  for (const d of changes.deletes) {
    for (let i = 0; i < d.ids.length; i += 200) {
      const { error } = await sb.from(d.table).delete().eq("club_id", clubId).in("id", d.ids.slice(i, i + 200));
      if (error) throw error;
    }
  }
  for (const up of changes.upserts) {
    for (let i = 0; i < up.rows.length; i += 500) {
      const { error } = await sb.from(up.table).upsert(up.rows.slice(i, i + 500));
      if (error) throw error;
    }
  }
}

export async function listMyClubs(sb: SupabaseClient, userId: string): Promise<ClubMembership[]> {
  await sb.rpc("accept_invites");
  const { data, error } = await sb
    .from("memberships")
    .select("club_id, role, team_ids, clubs(name, short_name)")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((r) => {
    const club = (Array.isArray(r.clubs) ? r.clubs[0] : r.clubs) as { name: string; short_name: string } | null;
    return { clubId: r.club_id as string, role: r.role as Role, teamIds: (r.team_ids as string[]) ?? [], name: club?.name ?? "Club", shortName: club?.short_name ?? "" };
  });
}

export async function createClub(sb: SupabaseClient, name: string, shortName: string, city: string): Promise<string> {
  const { data, error } = await sb.rpc("create_club", { p_name: name, p_short_name: shortName, p_city: city });
  if (error) throw error;
  return data as string;
}

export async function listMembers(sb: SupabaseClient, clubId: string): Promise<{ members: Member[]; invites: Invite[] }> {
  const [m, i] = await Promise.all([
    sb.from("memberships").select("user_id, email, role, team_ids").eq("club_id", clubId).order("created_at"),
    sb.from("club_invites").select("email, role, team_ids, created_at").eq("club_id", clubId).order("created_at"),
  ]);
  if (m.error) throw m.error;
  return {
    members: (m.data ?? []).map((r) => ({ userId: r.user_id, email: r.email, role: r.role as Role, teamIds: r.team_ids ?? [] })),
    // Non-admins cannot read invites (RLS): treat as empty
    invites: i.error ? [] : (i.data ?? []).map((r) => ({ email: r.email, role: r.role as Role, teamIds: r.team_ids ?? [], createdAt: r.created_at })),
  };
}

export async function inviteMember(sb: SupabaseClient, clubId: string, email: string, role: Role, invitedBy: string, teamIds: string[] = []) {
  const { error } = await sb
    .from("club_invites")
    .upsert({ club_id: clubId, email: email.trim().toLowerCase(), role, invited_by: invitedBy, team_ids: role === "trainer" ? teamIds : [] });
  if (error) throw error;
}

export async function deleteInvite(sb: SupabaseClient, clubId: string, email: string) {
  const { error } = await sb.from("club_invites").delete().eq("club_id", clubId).eq("email", email);
  if (error) throw error;
}

export async function setMemberRole(sb: SupabaseClient, clubId: string, userId: string, role: Role) {
  const { error } = await sb.from("memberships").update({ role }).eq("club_id", clubId).eq("user_id", userId);
  if (error) throw error;
}

export async function setMemberTeams(sb: SupabaseClient, clubId: string, userId: string, teamIds: string[]) {
  const { error } = await sb.from("memberships").update({ team_ids: teamIds }).eq("club_id", clubId).eq("user_id", userId);
  if (error) throw error;
}

export async function removeMember(sb: SupabaseClient, clubId: string, userId: string) {
  const { error } = await sb.from("memberships").delete().eq("club_id", clubId).eq("user_id", userId);
  if (error) throw error;
}

export const ROLE_LABELS: Record<Role, string> = { admin: "Beheerder", planner: "Planner", trainer: "Trainer", viewer: "Alleen lezen" };
