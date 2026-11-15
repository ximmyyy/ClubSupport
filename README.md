# Club Support

**Het digitale wedstrijdsecretariaat voor amateurverenigingen.** Veldbezetting, kleedkamerindeling, wedstrijden en vrijwilligersroosters in één visuele app, zodat clubs niet langer met Excel-sheets en whiteboards hoeven te werken. We beginnen met voetbal; het datamodel is opgezet om later hockey, korfbal, handbal en andere veldsporten te ondersteunen.

## Wat zit er in deze eerste versie

| Module | Wat het doet |
| --- | --- |
| **Dashboard** | Wat er nu op het park gebeurt (live veldkaarten), bezetting per weekdag, aandachtspunten voor de komende 14 dagen (conflicten, wedstrijden zonder veld of kleedkamer, open diensten, afgekeurde velden), komende wedstrijden en uitslagen. |
| **Veldbezetting** | Tijdlijn per dag met elk veld opgedeeld in kwarten A–D. Blokken verslepen naar een ander veld, deel of tijdstip (met live check op "bezet"), klikken op een lege plek om te reserveren, wekelijkse trainingen met uitzonderingen ("alleen deze week laten vervallen"). Conflicten worden rood gemarkeerd. De **Veldkaart** toont bovenaanzichten van de velden met een tijdschuif en afspeelknop. |
| **Veld afkeuren** | Veld afkeuren voor een dag; de thuiswedstrijden op dat veld worden direct afgelast en hun kleedkamers vrijgegeven. |
| **Kleedkamers** | Gantt per kleedkamer. Automatisch indelen (thuis, uit en scheidsrechter) met tijd vóór en na de wedstrijd en schoonmaaktijd tussen wissels. Slepen naar een andere kleedkamer, lijst "nog in te delen", overzicht **Wie zit waar?**, **deurbordjes printen** en **kopiëren voor WhatsApp**. |
| **Wedstrijden** | Programma en uitslagen per wedstrijddag, afgelasten met bevestiging (veld en kleedkamers komen vrij), **programma importeren** (plakken uit Sportlink of Excel) en de **wedstrijddag-assistent**: aftraptijden plannen (jongste teams eerst, velden zo vol mogelijk, nooit meer teams dan kleedkamers), velden en kleedkamers indelen en vrijwilligersdiensten aanmaken, allemaal in één keer. |
| **Verzoeken** | Trainers vragen een ander veld, een andere tijd of een extra training aan: door op hun eigen training te klikken, het blok te verslepen of op een lege plek te klikken. De wedstrijdsecretaris ziet direct of het verzoek botst met de planning en keurt goed of af; bij goedkeuren wordt de planning aangepast (alleen die week of de hele reeks). Openstaande verzoeken staan gestippeld in de veldplanner. |
| **Teams** | Teamkaarten met trainer, aantal spelers, veldbehoefte (kwart, half of heel veld), wedstrijdduur en trainingstijden. Typ je een KNVB-teamnaam (bijv. `JO11-2`), dan worden categorie, veldgrootte en speelduur automatisch voorgesteld. |
| **Vrijwilligers** | Bardiensten, wedstrijdsecretariaat, veld opbouwen en scheidsrechters, automatisch aangemaakt per wedstrijddag en eerlijk verdeeld over teams. Een team fluit nooit een even oud of ouder team en krijgt geen dienst als het zelf speelt. Inclusief een overzicht van het aantal diensten per team. |
| **TV-scherm** (`/scherm`) | Groot scherm voor de kantine: programma van vandaag met velden en kleedkamers, live veldkaarten en een melding als een veld is afgekeurd. |
| **Instellingen** | Club, velden (ondergrond, verlichting), kleedkamers (capaciteit, scheidsrechters) en planningsregels. Gegevens exporteren en importeren als JSON. |

Overal: **ongedaan maken** via de melding na elke actie, en een mobielvriendelijke layout met een navigatiebalk onderin.

## Twee manieren om de app te gebruiken

**Met je club (Supabase).** Inloggen gaat met een inloglink per e-mail, zonder wachtwoord. Na de eerste keer inloggen maak je een club aan (leeg, met voorbeelddata of met je demo-gegevens) en word je beheerder. Via *Instellingen → Leden & rechten* nodig je anderen uit als **beheerder**, **planner**, **trainer** (gekoppeld aan één of meer teams) of **alleen lezen**. Ze worden automatisch lid zodra ze inloggen met dat e-mailadres. Wijzigingen worden direct opgeslagen; andere geopende schermen (zoals het TV-scherm) werken realtime bij.

**Demo.** Via */demo* of de knop op het inlogscherm, zonder account. Linksonder kies je *Bekijk de demo als*: wedstrijdsecretaris, trainer van een team of alleen lezen. Je krijgt een fictieve club (*VV De Zwaluwen*: 21 teams, 4 velden, 10 kleedkamers) met een volledig ingepland seizoen. Er zit bewust één dubbele boeking in (keeperstraining op woensdag) om de conflictdetectie te laten zien. Alles blijft in de `localStorage` van je browser.

## Backend: Supabase

- Project **clubsupport**, regio `eu-central-1` (Frankfurt). Gegevens van leden en jeugdspelers blijven in de EU.
- **Multi-tenant:** alle clubs in één database; elke tabel heeft een `club_id`. Row level security bepaalt op basis van de tabel `memberships` wie wat mag:

  | Rol | Lezen | Verzoeken indienen | Planning en instellingen wijzigen, verzoeken beoordelen | Leden beheren |
  | --- | :-: | :-: | :-: | :-: |
  | Beheerder | ✅ | ✅ | ✅ | ✅ |
  | Planner | ✅ | ✅ | ✅ | – |
  | Trainer | ✅ | eigen teams | – | – |
  | Alleen lezen | ✅ | – | – | – |

  Verwijzingen tussen tabellen zijn samengestelde foreign keys op `(club_id, id)`, zodat een rij nooit naar data van een andere club kan wijzen. De laatste beheerder van een club kan niet worden verwijderd.
- **Schema:** `supabase/migrations/`. Tests voor de beveiligingsregels staan in `supabase/tests/` (isolatie tussen clubs en de trainerrol); ze draaien volledig in een transactie die wordt teruggedraaid.
- **App-koppeling:** `src/lib/cloud.ts` (laden, opslaan, leden) en `src/lib/repository.ts` (vertaling tussen app-model en tabellen, en het omzetten van een wijziging naar de minimale set inserts, updates en deletes). Pagina's praten nooit rechtstreeks met Supabase.
- **Configuratie:** `.env.example` bevat de project-URL en de *publishable key*. Die key is bedoeld voor de browser; de beveiliging zit in RLS. Zonder deze variabelen draait de app alleen in demomodus.

## Hosting: Vercel

- Project **clubsupport** in het team *ximmyyy's projects*, gekoppeld aan deze GitHub-repository. Functies draaien in Frankfurt (`fra1`).
- Productie: **https://clubsupport-eight.vercel.app** (tijdelijk adres tot er een eigen domein is).
- Elke push naar `main` wordt automatisch de nieuwe productieversie. Pushes naar andere branches worden *previews*; die zijn alleen te openen met een Vercel-account van het team.
- Omgevingsvariabelen (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) staan in de projectinstellingen van Vercel.

### Nog in te stellen in het Supabase-dashboard

1. **Authentication → URL Configuration:** zet de *Site URL* op `https://clubsupport-eight.vercel.app` (later het eigen domein) en voeg `https://clubsupport-eight.vercel.app/**` en `http://localhost:3000/**` toe aan *Redirect URLs*. Tot die tijd komt een inloglink op de Site URL uit; de landingspagina stuurt hem dan door naar `/app`.
2. **Authentication → Emails → SMTP Settings:** de ingebouwde mailserver van Supabase verstuurt maar enkele mails per uur en alleen naar leden van je Supabase-organisatie. Koppel voor echte clubs een eigen SMTP-dienst (bijv. Resend, Postmark of Brevo) en pas de e-mailtemplate aan naar het Nederlands.

## Ontwikkelen

```bash
npm install
cp .env.example .env.local   # Supabase-koppeling (weglaten = alleen demo)
npm run dev        # http://localhost:3000 (landingspagina), /app (applicatie), /demo, /scherm (TV)
npm test           # unit tests voor de planningslogica
npm run lint
npm run build
```

Stack: [Next.js 16](https://nextjs.org) (App Router), React 19, TypeScript, Tailwind CSS 4, lucide-react en [Supabase](https://supabase.com) (Postgres, Auth, Realtime).

### Structuur

```
src/
  app/
    page.tsx              landingspagina
    app/                  de applicatie (dashboard, veldbezetting, kleedkamers, wedstrijden, teams, vrijwilligers, instellingen)
    scherm/               TV-scherm voor de kantine
  components/             app-shell, UI-bouwstenen, SVG-veld, modals
  lib/
    types.ts              datamodel
    planning.ts           planningslogica: conflictdetectie, vrije plek zoeken, aftraptijden optimaliseren,
                          kleedkamers indelen, diensten genereren en verdelen
    seed.ts               demodata
    store.tsx             state, opslaan (browser of Supabase), realtime en undo
    supabase.ts           Supabase-client
    cloud.ts              laden/opslaan per club, leden en uitnodigingen
    repository.ts         app-model <-> tabellen, wijzigingen als diff
    *.test.ts             tests
supabase/
  migrations/             databaseschema met RLS
  tests/                  isolatietest tussen clubs
```

Alle planningslogica staat los van de UI in `src/lib/planning.ts`. Die kan dus ongewijzigd naar een server of edge function verhuizen.

## Volgende stappen (voorstel)

1. **Livegang:** eigen domein koppelen in Vercel en de redirect-URL's en SMTP in Supabase instellen (zie hierboven).
2. **Meer rollen:** vrijwilliger (diensten inschrijven) en ouder/speler (alleen eigen team). Plus een TV-scherm dat met een geheime link werkt in plaats van een ingelogd account, en meldingen voor trainers wanneer hun verzoek is beoordeeld.
3. **Schaal:** nu wordt bij openen de hele club geladen. Bij meerdere seizoenen alleen een datumvenster laden.
4. **Sportlink-koppeling (geparkeerd, wacht op een client-ID van een club):** het programma, uitslagen en afgelastingen automatisch ophalen via de Sportlink Club.Dataservice (`data.sportlink.com`, één client-ID per club, alleen lezen). Plan: de sleutel opslaan per club (alleen zichtbaar voor beheerders), Sportlink-teams eenmalig koppelen aan eigen teams, en server-side synchroniseren op basis van de Sportlink-wedstrijdcode. Eigen planning (veld, kleedkamers, diensten) wordt nooit overschreven; wijzigingen door de KNVB worden als aandachtspunt getoond. Tot die tijd: handmatig importeren door te plakken.
5. **Notificaties:** push en e-mail bij afgelastingen, gewijzigde kleedkamers of een open dienst.
6. **Kantine en sponsoren:** sponsorlogo's tussendoor op het TV-scherm, uitslagen live bijwerken.
7. **Meer sporten:** sportprofielen (veldindeling, wedstrijdduur, categorieën) voor hockey, korfbal en handbal.
8. **Abonnementen:** prijsmodel per club (bijv. naar aantal teams), proefperiode en facturatie.
