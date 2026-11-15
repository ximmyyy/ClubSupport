# Club Support

**Het digitale wedstrijdsecretariaat voor amateurverenigingen.** Veldbezetting, kleedkamerindeling, wedstrijden en vrijwilligersroosters in één visuele app, zodat clubs niet langer met Excel-sheets en whiteboards hoeven te werken. We beginnen met voetbal; het datamodel is opgezet om later hockey, korfbal, handbal en andere veldsporten te ondersteunen.

## Wat zit er in deze eerste versie

| Module | Wat het doet |
| --- | --- |
| **Dashboard** | Wat er nu op het park gebeurt (live veldkaarten), bezetting per weekdag, aandachtspunten voor de komende 14 dagen (conflicten, wedstrijden zonder veld of kleedkamer, open diensten, afgekeurde velden), komende wedstrijden en uitslagen. |
| **Veldbezetting** | Tijdlijn per dag met elk veld opgedeeld in kwarten A–D. Blokken verslepen naar een ander veld, deel of tijdstip (met live check op "bezet"), klikken op een lege plek om te reserveren, wekelijkse trainingen met uitzonderingen ("alleen deze week laten vervallen"). Conflicten worden rood gemarkeerd. De **Veldkaart** toont bovenaanzichten van de velden met een tijdschuif en afspeelknop. |
| **Veld afkeuren** | Veld afkeuren voor een dag; de thuiswedstrijden op dat veld worden direct afgelast en hun kleedkamers vrijgegeven. |
| **Kleedkamers** | Gantt per kleedkamer. Automatisch indelen (thuis, uit en scheidsrechter) met tijd vóór en na de wedstrijd en schoonmaaktijd tussen wissels. Slepen naar een andere kleedkamer, lijst "nog in te delen", overzicht **Wie zit waar?**, **deurbordjes printen** en **kopiëren voor WhatsApp**. |
| **Wedstrijden** | Programma en uitslagen per wedstrijddag, afgelasten met één klik, **programma importeren** (plakken uit Sportlink of Excel) en de **wedstrijddag-assistent**: aftraptijden plannen (jongste teams eerst, velden zo vol mogelijk, nooit meer teams dan kleedkamers), velden en kleedkamers indelen en vrijwilligersdiensten aanmaken, allemaal in één keer. |
| **Teams** | Teamkaarten met trainer, aantal spelers, veldbehoefte (kwart, half of heel veld), wedstrijdduur en trainingstijden. Typ je een KNVB-teamnaam (bijv. `JO11-2`), dan worden categorie, veldgrootte en speelduur automatisch voorgesteld. |
| **Vrijwilligers** | Bardiensten, wedstrijdsecretariaat, veld opbouwen en scheidsrechters, automatisch aangemaakt per wedstrijddag en eerlijk verdeeld over teams. Een team fluit nooit een even oud of ouder team en krijgt geen dienst als het zelf speelt. Inclusief een overzicht van het aantal diensten per team. |
| **TV-scherm** (`/scherm`) | Groot scherm voor de kantine: programma van vandaag met velden en kleedkamers, live veldkaarten en een melding als een veld is afgekeurd. |
| **Instellingen** | Club, velden (ondergrond, verlichting), kleedkamers (capaciteit, scheidsrechters) en planningsregels. Gegevens exporteren en importeren als JSON. |

Overal: **ongedaan maken** via de melding na elke actie, en een mobielvriendelijke layout met een navigatiebalk onderin.

## Demo

De app start met een fictieve club (*VV De Zwaluwen*: 21 teams, 4 velden, 10 kleedkamers) en een volledig ingepland seizoen ten opzichte van de huidige datum. Er zit bewust één dubbele boeking in (keeperstraining op woensdag) om de conflictdetectie te laten zien. Alles wordt bewaard in `localStorage` van je browser; via *Instellingen → Demo opnieuw laden* begin je opnieuw.

## Ontwikkelen

```bash
npm install
npm run dev        # http://localhost:3000 (landingspagina), /app (applicatie), /scherm (TV)
npm test           # unit tests voor de planningslogica
npm run lint
npm run build
```

Stack: [Next.js 16](https://nextjs.org) (App Router), React 19, TypeScript, Tailwind CSS 4 en lucide-react.

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
    store.tsx             state, persistentie en undo
    planning.test.ts      tests
```

Alle planningslogica staat los van de UI in `src/lib/planning.ts`. Die kan dus ongewijzigd naar een server of edge function verhuizen.

## Volgende stappen (voorstel)

1. **Backend en multi-tenant:** Supabase (Postgres en Auth) met een `club_id` op elke tabel en row-level security, zodat meerdere clubs op één installatie draaien. De `AppData`-structuur vertaalt zich één-op-één naar tabellen.
2. **Rollen:** bestuur/wedstrijdsecretaris (alles), trainer (eigen team, trainingen ruilen), vrijwilliger (diensten inschrijven), ouder/speler (alleen lezen).
3. **Sportlink-koppeling:** het wedstrijdprogramma automatisch ophalen in plaats van plakken.
4. **Notificaties:** push en e-mail bij afgelastingen, gewijzigde kleedkamers of een open dienst.
5. **Ruilverzoeken:** trainers vragen een ander veld of tijdstip aan en de wedstrijdsecretaris keurt goed.
6. **Kantine en sponsoren:** sponsorlogo's tussendoor op het TV-scherm, uitslagen live bijwerken.
7. **Meer sporten:** sportprofielen (veldindeling, wedstrijdduur, categorieën) voor hockey, korfbal en handbal.
8. **Abonnementen:** prijsmodel per club (bijv. naar aantal teams), proefperiode en facturatie.
