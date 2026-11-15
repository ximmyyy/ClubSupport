"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { remapIds } from "@/lib/repository";
import { createSeedData } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { useConfirm } from "./confirm";
import { useToast } from "./toast";
import { Button, Card, cn } from "./ui";

/** Step-by-step guide for a club that is not set up yet. Disappears when every step is done. */
export function GettingStarted() {
  const { data, replace, canEdit, source } = useStore();
  const confirm = useConfirm();
  const toast = useToast();
  if (!canEdit) return null;

  const steps = [
    { done: data.fields.length > 0, title: "Voeg je velden toe", text: "Hoeveel velden heeft het sportpark en welke hebben verlichting?", href: "/app/instellingen#velden", cta: "Velden toevoegen" },
    { done: data.rooms.length > 0, title: "Voeg je kleedkamers toe", text: "Met het aantal plaatsen per kleedkamer.", href: "/app/instellingen#kleedkamers", cta: "Kleedkamers toevoegen" },
    { done: data.teams.length > 0, title: "Voeg je teams toe", text: "Bijvoorbeeld JO11-1 of Heren 1, met de trainer erbij.", href: "/app/teams", cta: "Teams toevoegen" },
    { done: data.bookings.some((b) => b.kind === "training"), title: "Plan de vaste trainingen", text: "Zet per team de wekelijkse training op een veld.", href: "/app/veldbezetting", cta: "Trainingen inplannen" },
    { done: data.matches.length > 0, title: "Zet de wedstrijden erin", text: "Voeg ze één voor één toe of plak het hele programma uit Sportlink of Excel.", href: "/app/wedstrijden", cta: "Wedstrijden toevoegen" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const current = steps.findIndex((s) => !s.done);
  const empty = doneCount === 0;

  const loadSample = async () => {
    const ok = await confirm({
      title: "Voorbeeldgegevens laden?",
      text: "Je krijgt een voorbeeldclub met 21 teams, 4 velden en 10 kleedkamers om mee te oefenen. Je kunt daarna alles aanpassen of weer verwijderen.",
      confirmLabel: "Ja, laden",
      destructive: false,
    });
    if (!ok) return;
    replace({ ...remapIds(createSeedData()), club: data.club });
    toast("Voorbeeldgegevens geladen", { undo: true });
  };

  return (
    <Card className="mb-6 overflow-hidden border-brand-200">
      <div className="bg-brand-50 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-stone-900">{empty ? "Welkom! Zo begin je" : "Aan de slag"}</h2>
          <span className="shrink-0 text-sm font-semibold text-brand-800">{doneCount} van {steps.length} klaar</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-100" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={steps.length}>
          <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="divide-y divide-stone-100">
        {steps.map((s, i) => {
          const isCurrent = i === current;
          return (
            <li key={s.title} className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5", isCurrent && "bg-white py-4")}>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    s.done ? "bg-brand-600 text-white" : isCurrent ? "bg-stone-900 text-white" : "bg-stone-200 text-stone-600",
                  )}
                >
                  {s.done ? <Check size={18} /> : i + 1}
                </span>
                <div className="min-w-0">
                  <p className={cn("text-base font-semibold", s.done ? "text-stone-500 line-through" : "text-stone-900")}>{s.title}</p>
                  {!s.done && <p className="text-sm text-stone-600">{s.text}</p>}
                </div>
              </div>
              {!s.done && (
                <Link
                  href={s.href}
                  className={cn(
                    "inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-4 font-semibold sm:min-h-10 sm:text-sm",
                    isCurrent ? "bg-brand-600 text-white shadow-sm hover:bg-brand-700" : "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50",
                  )}
                >
                  {s.cta} <ArrowRight size={18} />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      {empty && source.kind === "cloud" && (
        <div className="flex flex-col gap-2 border-t border-stone-100 bg-stone-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm text-stone-700">Liever eerst rondkijken met een ingevulde voorbeeldclub?</p>
          <Button onClick={loadSample}><Sparkles size={18} /> Voorbeeldgegevens laden</Button>
        </div>
      )}
    </Card>
  );
}
