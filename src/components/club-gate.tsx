"use client";

import { ArrowRight, Loader2, LogOut, Mail, MailCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { createClub, saveChanges } from "@/lib/cloud";
import { emptyData, remapIds } from "@/lib/repository";
import { createSeedData } from "@/lib/seed";
import { loadDemoData, StoreProvider } from "@/lib/store";
import type { Club } from "@/lib/types";
import { useAccount } from "./account";
import { LogoMark } from "./logo";
import { Button, FormField, Input } from "./ui";

export function Loading({ dark }: { dark?: boolean }) {
  return (
    <div className={`flex min-h-screen items-center justify-center ${dark ? "bg-brand-950 text-brand-200" : "text-stone-500"}`}>
      <div className="flex animate-pulse items-center gap-3">
        <LogoMark size={36} /> Club Support laden…
      </div>
    </div>
  );
}

/** Decides what the visitor sees: login, club onboarding, or the app on demo or cloud data. */
export function ClubGate({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  const { state } = useAccount();
  switch (state.status) {
    case "loading":
      return <Loading dark={dark} />;
    case "signedOut":
      return <LoginScreen />;
    case "error":
      return <AuthShell><p className="text-sm text-red-700">Er ging iets mis: {state.message}</p></AuthShell>;
    case "noClub":
      return <Onboarding email={state.email} />;
    case "demo":
      return (
        <StoreProvider source={{ kind: "demo", me: { id: "demo-user", name: state.role === "trainer" ? "Trainer (demo)" : "Wedstrijdsecretaris (demo)", role: state.role, teamIds: state.teamIds } }} fallback={<Loading dark={dark} />}>
          {children}
        </StoreProvider>
      );
    case "club":
      return (
        <StoreProvider
          key={state.active.clubId}
          source={{ kind: "cloud", clubId: state.active.clubId, me: { id: state.userId, name: state.email, role: state.active.role, teamIds: state.active.teamIds } }}
          fallback={<Loading dark={dark} />}
        >
          {children}
        </StoreProvider>
      );
  }
}

function AuthShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="grass flex min-h-screen items-center justify-center p-4">
      <div className={`w-full ${wide ? "max-w-lg" : "max-w-md"} rounded-3xl bg-white p-6 shadow-2xl sm:p-8`}>
        <Link href="/" className="mb-6 flex items-center gap-2">
          <LogoMark size={36} />
          <span className="text-xl font-bold tracking-tight">Club<span className="text-brand-600">Support</span></span>
        </Link>
        {children}
      </div>
    </div>
  );
}

function LoginScreen() {
  const { sb, startDemo } = useAccount();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sb) return;
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/app`, shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setError(error.message.includes("rate") ? "Er zijn net te veel inloglinks verstuurd. Probeer het over een paar minuten opnieuw." : error.message);
    else setSent(true);
  };

  return (
    <AuthShell>
      {sent ? (
        <div>
          <div className="mb-4 inline-flex rounded-2xl bg-brand-50 p-3 text-brand-600"><MailCheck size={28} /></div>
          <h1 className="text-2xl font-bold tracking-tight">Check je inbox</h1>
          <p className="mt-2 text-stone-600">
            We hebben een inloglink gestuurd naar <b>{email}</b>. Klik op de link in de mail om in te loggen. Je kunt dit venster sluiten.
          </p>
          <button className="mt-6 text-sm font-medium text-brand-700 hover:underline" onClick={() => setSent(false)}>Ander e-mailadres gebruiken</button>
        </div>
      ) : (
        <form onSubmit={send}>
          <h1 className="text-2xl font-bold tracking-tight">Inloggen</h1>
          <p className="mt-1 text-stone-600">Geen wachtwoord nodig: je krijgt een inloglink per e-mail.</p>
          <div className="mt-6">
            <FormField label="E-mailadres">
              <Input type="email" required autoComplete="email" placeholder="secretaris@jouwclub.nl" value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormField>
          </div>
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          <Button type="submit" variant="primary" className="mt-4 w-full" disabled={busy || !email}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} Stuur inloglink
          </Button>
          <div className="my-6 flex items-center gap-3 text-xs text-stone-400"><span className="h-px flex-1 bg-stone-200" /> of <span className="h-px flex-1 bg-stone-200" /></div>
          <Button type="button" className="w-full" onClick={startDemo}><Sparkles size={16} /> Bekijk de demo zonder account</Button>
        </form>
      )}
    </AuthShell>
  );
}

type StartWith = "leeg" | "voorbeeld" | "demo";

function Onboarding({ email }: { email: string }) {
  const { sb, signOut, refreshClubs } = useAccount();
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [shortTouched, setShortTouched] = useState(false);
  const [city, setCity] = useState("");
  const [start, setStart] = useState<StartWith>("voorbeeld");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLocal] = useState(() => loadDemoData() !== null);

  const onName = (v: string) => {
    setName(v);
    if (!shortTouched) setShortName(v.replace(/^(v\.?v\.?|s\.?v\.?|r\.?k\.?s\.?v\.?|fc|sc|vv|sv|rksv)\s+/i, "").split(/\s+/).slice(-1)[0] ?? "");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sb) return;
    setBusy(true);
    setError(null);
    try {
      const clubId = await createClub(sb, name, shortName || name, city);
      const club: Club = { name, shortName: shortName || name, city, sport: "voetbal", roomBefore: 45, roomAfter: 30, roomBuffer: 10, fieldBuffer: 10, roomsFromAge: 10 };
      if (start !== "leeg") {
        const source = start === "demo" ? loadDemoData() ?? createSeedData() : createSeedData();
        const data = { ...remapIds(source), club: start === "demo" ? { ...source.club, name, shortName: club.shortName, city } : club };
        await saveChanges(sb, clubId, emptyData(club), data);
      }
      await refreshClubs(clubId);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const option = (value: StartWith, title: string, text: string) => (
    <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${start === value ? "border-brand-300 bg-brand-50/60" : "border-stone-200"}`}>
      <input type="radio" name="start" checked={start === value} onChange={() => setStart(value)} className="mt-1 accent-brand-600" />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="text-xs text-stone-500">{text}</span>
      </span>
    </label>
  );

  return (
    <AuthShell wide>
      <form onSubmit={submit}>
        <h1 className="text-2xl font-bold tracking-tight">Welkom! Maak je club aan</h1>
        <p className="mt-1 text-sm text-stone-600">
          Ingelogd als <b>{email}</b>. Je wordt beheerder van de club en kunt daarna anderen uitnodigen. Ben je al uitgenodigd? Vraag de beheerder dan om dit e-mailadres te gebruiken.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Naam van de club"><Input required minLength={2} value={name} onChange={(e) => onName(e.target.value)} placeholder="VV De Zwaluwen" /></FormField>
          </div>
          <FormField label="Korte naam" hint="Zo heten je teams in het programma">
            <Input required value={shortName} onChange={(e) => { setShortTouched(true); setShortName(e.target.value); }} placeholder="Zwaluwen" />
          </FormField>
          <FormField label="Plaats"><Input value={city} onChange={(e) => setCity(e.target.value)} /></FormField>
        </div>
        <p className="mt-6 mb-2 text-sm font-medium text-stone-700">Waarmee wil je beginnen?</p>
        <div className="grid gap-2">
          {option("voorbeeld", "Met voorbeelddata", "21 teams, 4 velden en 10 kleedkamers om mee te oefenen. Je kunt alles aanpassen of verwijderen.")}
          {hasLocal && option("demo", "Mijn demo-gegevens uit deze browser", "Neemt de velden, teams en planning over die je in de demo hebt aangepast.")}
          {option("leeg", "Een lege club", "Je voert zelf velden, kleedkamers en teams in via Instellingen en Teams.")}
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={signOut} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800"><LogOut size={14} /> Uitloggen</button>
          <Button type="submit" variant="primary" disabled={busy || name.length < 2}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Club aanmaken
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
