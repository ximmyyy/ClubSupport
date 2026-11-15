import {
  ArrowRight, BellRing, CalendarCheck2, CloudRain, DoorOpen, FileSpreadsheet, HandHeart, LayoutGrid, MonitorPlay, Smartphone, Sparkles, Wand2,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Pitch } from "@/components/pitch";

const FEATURES = [
  { icon: LayoutGrid, title: "Visuele veldbezetting", text: "Elk veld in kwarten, een tijdlijn per dag. Sleep trainingen en wedstrijden naar een vrije plek; dubbele boekingen zie je direct in rood." },
  { icon: DoorOpen, title: "Kleedkamers automatisch", text: "Thuis, uit en scheidsrechter in één klik ingedeeld, inclusief schoonmaaktijd tussen wissels. Print deurbordjes of deel het via WhatsApp." },
  { icon: Wand2, title: "Wedstrijddag-assistent", text: "Laat Club Support de aftraptijden plannen: jongste teams eerst, velden zo vol mogelijk en nooit meer teams dan kleedkamers." },
  { icon: CloudRain, title: "Afkeuren & afgelasten", text: "Veld afgekeurd? Eén knop: wedstrijden afgelast, kleedkamers vrijgegeven en het TV-scherm in de kantine laat het meteen zien." },
  { icon: HandHeart, title: "Vrijwilligersrooster", text: "Bardiensten, scheidsrechters en wedstrijdsecretariaat eerlijk verdeeld over teams. Je ziet precies wie al hoe vaak heeft gedraaid." },
  { icon: MonitorPlay, title: "TV-scherm voor de kantine", text: "Programma van de dag, velden en kleedkamers op een groot scherm. Altijd actueel, nooit meer een whiteboard bijwerken." },
];

export default function LandingPage() {
  return (
    <div className="bg-white">
      <header className="sticky top-0 z-30 border-b border-stone-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm font-medium text-stone-600 md:flex">
            <a href="#functies" className="hover:text-stone-900">Functies</a>
            <a href="#hoe" className="hover:text-stone-900">Hoe het werkt</a>
            <a href="#sporten" className="hover:text-stone-900">Sporten</a>
          </nav>
          <Link href="/app" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
            Open de demo <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden bg-brand-950 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-brand-200">
              <Sparkles size={14} /> Voor amateurverenigingen · start met voetbal
            </p>
            <h1 className="text-4xl leading-[1.05] font-extrabold tracking-tight md:text-6xl">
              Velden en kleedkamers plannen <span className="text-brand-300">zonder Excel.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-brand-100/80">
              Club Support is het digitale wedstrijdsecretariaat voor je vereniging. Veldbezetting, kleedkamerindeling, wedstrijden en vrijwilligers in één overzichtelijke app, gemaakt voor vrijwilligers zonder handleiding.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/app" className="inline-flex items-center gap-2 rounded-xl bg-brand-400 px-5 py-3 font-semibold text-brand-950 hover:bg-brand-300">
                Probeer de demo <ArrowRight size={18} />
              </Link>
              <Link href="/scherm" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 font-semibold text-white hover:bg-white/15">
                <MonitorPlay size={18} /> Bekijk het TV-scherm
              </Link>
            </div>
            <p className="mt-4 text-sm text-brand-100/50">Geen account nodig: de demo draait volledig in je browser.</p>
          </div>
          <div className="relative">
            <div className="rotate-1 rounded-3xl bg-white/5 p-4 shadow-2xl ring-1 ring-white/10">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-semibold">Veld 1 · zaterdag 10:00</span>
                <span className="rounded-full bg-brand-400/20 px-2 py-0.5 text-xs text-brand-200">3 teams</span>
              </div>
              <Pitch
                className="w-full"
                occupants={[
                  { key: "a", sections: [0], title: "JO8-1", subtitle: "vs SV Zuidwijk", color: "#2a78d6", match: true },
                  { key: "b", sections: [1], title: "JO8-2", subtitle: "vs VV Heidebloem", color: "#2a78d6", match: true },
                  { key: "c", sections: [2, 3], title: "JO11-1", subtitle: "Training tot 11:15", color: "#eb6834" },
                ]}
              />
            </div>
            <div className="absolute -bottom-6 -left-4 hidden w-64 -rotate-2 rounded-2xl bg-white p-4 text-stone-900 shadow-2xl sm:block">
              <p className="text-xs font-semibold text-stone-400 uppercase">Kleedkamers 09:15</p>
              {[["KK 1", "JO13-2", "#1baf7a"], ["KK 2", "RKSV Oranje Noord", "#eb6834"], ["Scheids 1", "Scheidsrechter", "#52514e"]].map(([room, who, c]) => (
                <div key={room} className="mt-2 flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
                  <span className="w-16 font-semibold">{room}</span>
                  <span className="truncate text-stone-600">{who}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <div className="grid items-center gap-8 rounded-3xl bg-stone-50 p-6 md:grid-cols-2 md:p-10">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-600"><FileSpreadsheet size={16} /> Herkenbaar?</p>
            <ul className="space-y-2 text-stone-700">
              <li>❌ Een Excel-sheet per seizoen die maar één persoon snapt</li>
              <li>❌ Twee teams op hetzelfde halve veld om 18:30</li>
              <li>❌ Op zaterdagochtend kleedkamers indelen op een whiteboard</li>
              <li>❌ Appjes rondsturen omdat veld 3 is afgekeurd</li>
              <li>❌ Altijd dezelfde ouders achter de bar</li>
            </ul>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-700"><CalendarCheck2 size={16} /> Met Club Support</p>
            <ul className="space-y-2 text-stone-700">
              <li>✅ Iedereen ziet dezelfde, actuele planning</li>
              <li>✅ Conflicten worden gemeld vóórdat ze op het veld ontstaan</li>
              <li>✅ Kleedkamers in één klik ingedeeld, deurbordjes geprint</li>
              <li>✅ Afkeuren = automatisch afgelast + TV-scherm bijgewerkt</li>
              <li>✅ Diensten eerlijk verdeeld over alle teams</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="functies" className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Alles voor het wedstrijdsecretariaat</h2>
        <p className="mt-2 max-w-2xl text-stone-500">Gebouwd rond hoe een amateurclub écht werkt: kwart, half en heel veld, KNVB-leeftijdscategorieën, wisselende vrijwilligers.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-stone-200 p-6 transition-shadow hover:shadow-lg">
              <div className="mb-4 inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-700"><Icon size={22} /></div>
              <h3 className="font-semibold text-stone-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="hoe" className="bg-stone-50">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">In drie stappen live</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              ["1", "Richt je club in", "Velden, kleedkamers en teams. Leeftijdscategorieën vullen automatisch veldgrootte en speelduur in."],
              ["2", "Plan het seizoen", "Zet de vaste trainingen in de tijdlijn en importeer het wedstrijdprogramma uit Sportlink of Excel."],
              ["3", "Laat de wedstrijddag lopen", "Eén klik voor velden, kleedkamers en diensten. Het TV-scherm en de WhatsApp-tekst doen de rest."],
            ].map(([n, t, d]) => (
              <div key={n} className="rounded-2xl bg-white p-6 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{n}</span>
                <h3 className="mt-4 font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-stone-600">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="sporten" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Begint bij voetbal. Groeit mee.</h2>
            <p className="mt-3 text-stone-600">Het model achter Club Support (velden in delen, kleedkamers, wedstrijdduur per categorie) werkt voor elke veldsport. Na voetbal volgen:</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["⚽ Voetbal: nu", "🏑 Hockey", "🏐 Korfbal", "🤾 Handbal", "🏉 Rugby", "🥍 Lacrosse"].map((s, i) => (
                <span key={s} className={`rounded-full px-3 py-1.5 text-sm font-medium ${i === 0 ? "bg-brand-600 text-white" : "bg-stone-100 text-stone-700"}`}>{s}</span>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            {[
              [Smartphone, "Mobiel eerst", "Trainers checken op hun telefoon waar ze vanavond staan."],
              [BellRing, "Op de roadmap", "Pushmeldingen bij afgelastingen, koppeling met Sportlink, ouder-app en ledenlogin per rol."],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof Smartphone;
              return (
                <div key={t as string} className="flex gap-4 rounded-2xl border border-stone-200 p-5">
                  <I className="mt-0.5 shrink-0 text-brand-600" size={22} />
                  <div>
                    <p className="font-semibold">{t as string}</p>
                    <p className="text-sm text-stone-600">{d as string}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 md:px-6">
        <div className="grass mx-auto max-w-6xl rounded-3xl px-6 py-14 text-center text-white">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Klaar met de Excel-sheet?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">Speel met de demo van een fictieve club met 21 teams, 4 velden en 10 kleedkamers.</p>
          <Link href="/app" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-brand-800 hover:bg-brand-50">
            Open de demo <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-stone-100 py-8 text-center text-sm text-stone-500">
        <div className="flex justify-center"><Logo /></div> <p className="mt-2">© {"2026"} Club Support · Gemaakt voor de vrijwilligers die de club draaiende houden.</p>
      </footer>
    </div>
  );
}
