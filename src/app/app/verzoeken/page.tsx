"use client";

import { AlertTriangle, Check, CheckCircle2, Inbox, MapPin, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSelectedDate } from "@/components/app-shell";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Segmented } from "@/components/ui";
import { CATEGORY_META } from "@/lib/meta";
import { applyRequest, currentSituation, describeRequest, rejectRequest, requestConflicts } from "@/lib/requests";
import { useStore } from "@/lib/store";
import { formatDate } from "@/lib/time";
import type { ChangeRequest } from "@/lib/types";

export default function VerzoekenPage() {
  const { data, me, canEdit } = useStore();
  const [tab, setTab] = useState<"open" | "afgehandeld">("open");
  const visible = data.requests
    .filter((r) => canEdit || me.teamIds.includes(r.teamId))
    .filter((r) => (tab === "open" ? r.status === "open" : r.status !== "open"))
    .sort((a, b) => (tab === "open" ? a.date.localeCompare(b.date) : (b.decidedAt ?? "").localeCompare(a.decidedAt ?? "")));
  const openCount = data.requests.filter((r) => r.status === "open" && (canEdit || me.teamIds.includes(r.teamId))).length;

  return (
    <>
      <PageHeader
        eyebrow="Samenwerken"
        title="Verzoeken"
        description={
          canEdit
            ? "Trainers vragen hier een ander veld, een andere tijd of een extra training aan. Bij goedkeuren wordt de planning direct aangepast."
            : "Jouw aanvragen bij de wedstrijdsecretaris. Een nieuw verzoek doe je door in Veldbezetting op je eigen training te klikken of een blok te verslepen."
        }
      />
      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[{ value: "open", label: `Open${openCount ? ` (${openCount})` : ""}` }, { value: "afgehandeld", label: "Afgehandeld" }]}
        />
      </div>
      <div className="grid gap-3">
        {visible.length === 0 && (
          <Card>
            <EmptyState icon={<Inbox />} title={tab === "open" ? "Geen openstaande verzoeken" : "Nog niets afgehandeld"}>
              {tab === "open" && (canEdit ? "Alles is bijgewerkt." : "Klik in Veldbezetting op een training van je team om een wijziging aan te vragen.")}
            </EmptyState>
          </Card>
        )}
        {visible.map((r) => <RequestCard key={r.id} r={r} />)}
      </div>
    </>
  );
}

function RequestCard({ r }: { r: ChangeRequest }) {
  const { data, update, updateRequests, me, canEdit } = useStore();
  const toast = useToast();
  const router = useRouter();
  const [, setDate] = useSelectedDate();
  const [note, setNote] = useState("");
  const team = data.teams.find((t) => t.id === r.teamId);
  const meta = team ? CATEGORY_META[team.category] : undefined;
  const conflicts = r.status === "open" ? requestConflicts(data, r) : [];
  const current = r.status === "open" ? currentSituation(data, r) : null;
  const mine = r.createdBy === me.id;

  const approve = () => {
    update((d) => applyRequest(d, r, me.name, note));
    toast(`Goedgekeurd: de planning van ${team?.name} is aangepast`, { undo: true });
  };
  const reject = () => {
    update((d) => rejectRequest(d, r, me.name, note));
    toast("Verzoek afgewezen", { undo: true });
  };
  const withdraw = () => {
    updateRequests((reqs) => reqs.filter((x) => x.id !== r.id));
    toast("Verzoek ingetrokken");
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-1 gap-3">
          <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: meta?.color }} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-stone-900">{describeRequest(data, r)}</p>
              {r.status === "goedgekeurd" && <Badge className="bg-brand-50 text-brand-800"><Check size={12} /> Goedgekeurd</Badge>}
              {r.status === "afgewezen" && <Badge className="bg-red-50 text-red-700"><X size={12} /> Afgewezen</Badge>}
            </div>
            {current && <p className="text-sm text-stone-500">{current}</p>}
            {r.note && <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700">“{r.note}”</p>}
            <p className="mt-1 text-xs text-stone-400">
              Aangevraagd door {r.createdByName || "trainer"}{r.createdAt ? ` op ${formatDate(r.createdAt.slice(0, 10))}` : ""}
              {r.decidedByName && ` · ${r.status === "goedgekeurd" ? "goedgekeurd" : "afgewezen"} door ${r.decidedByName}`}
            </p>
            {r.decisionNote && <p className="mt-1 text-sm text-stone-600">Reactie: {r.decisionNote}</p>}
            {r.status === "open" &&
              (conflicts.length ? (
                <div className="mt-2 text-sm text-amber-800">
                  {conflicts.map((c) => <p key={c} className="flex items-center gap-1.5"><AlertTriangle size={14} /> {c}</p>)}
                </div>
              ) : (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-brand-700"><CheckCircle2 size={14} /> Past zonder conflicten</p>
              ))}
          </div>
        </div>
        {r.status === "open" && (
          <div className="flex shrink-0 flex-col gap-2 md:w-72">
            {canEdit ? (
              <>
                <Input className="h-9" placeholder="Reactie aan trainer (optioneel)" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1" onClick={approve}>
                    <Check size={16} /> {conflicts.length ? "Toch goedkeuren" : "Goedkeuren"}
                  </Button>
                  <Button variant="danger" className="flex-1" onClick={reject}><X size={16} /> Afwijzen</Button>
                </div>
              </>
            ) : (
              mine && <Button onClick={withdraw}><Undo2 size={16} /> Intrekken</Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => { setDate(r.date); router.push("/app/veldbezetting"); }}>
              <MapPin size={14} /> Bekijk in planning
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
