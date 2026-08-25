# Azubiportal

Webanwendung für die Auszubildenden des Betriebs. Der erste Bereich ist die
Vertretungsplanung der Zentrale: Sie verteilt die Pausenvertretung und die
ganztägige Vertretung automatisch und möglichst gleichmäßig, unter
Berücksichtigung von Berufsschultagen, Urlaub, Krankmeldungen, NRW-Feiertagen,
Schulferien und Betriebsferien. Dazu kommen die Selbstpflege von Urlaub und
Schultagen und ein Monatskalender für alle.

Das Portal ist auf weitere Bereiche ausgelegt: Die Navigation ist in Gruppen
gegliedert (`src/components/app/nav-config.ts`), sodass ein neues Thema als
eigene Gruppe dazukommt, ohne dass an der Oberfläche sonst etwas zu ändern
wäre.

## Was die Anwendung macht

- **Automatischer Plan** – für jeden Arbeitstag wird eine Vertretung und
  (konfigurierbar) zwei Ersatzleute eingeplant. Dieselbe Person übernimmt alle
  Pausen des Tages; eine Trennung nach Frühstücks- und Mittagspause lässt sich
  in den Einstellungen aktivieren.
- **Ganztägige Vertretung** – fällt die fest eingeteilte Person der Zentrale aus
  oder ist für einen Wochentag niemand hinterlegt, entfällt die Pausenvertretung
  und es wird ein Azubi für den ganzen Tag eingeplant.
- **Lastenausgleich** – die Automatik wählt immer die Person mit der geringsten
  gewichteten Belastung. Eine Ganztagsvertretung zählt schwerer als eine Pause
  (Gewicht je Slot einstellbar), Ersatz-Nominierungen zählen anteilig mit.
- **Selbstpflege durch die Azubis** – Urlaub, Krankmeldungen und
  Berufsschultage (auch im 14-tägigen Rhythmus) tragen die Auszubildenden
  selbst ein. Eine Genehmigung ist nicht nötig; jeder Eintrag wirkt sofort auf
  die Planung.
- **Selbstpflege durch die Zentrale** – die fest eingeteilten Personen melden
  sich mit demselben Login an und tragen ihren Urlaub und ihre Ausfälle selbst
  ein. Daraus entsteht automatisch der Bedarf an ganztägiger Vertretung.
- **Für das Telefon gebaut** – die Oberfläche ist durchgehend responsiv, weil
  die Auszubildenden sie überwiegend mobil benutzen.
- **Erinnerungen** – morgens per E-Mail (SMTP) und/oder Microsoft Teams
  (Webhook / Power-Automate-Workflow), Kanäle pro Person abschaltbar.
- **Kalender-Abo** – jeder Azubi hat eine persönliche ICS-Adresse, die Outlook
  automatisch aktualisiert.
- **Monatskalender für alle** – ein Kalenderblatt je Monat zeigt namentlich,
  wer in Urlaub, krank, in der Schule oder auf Lehrgang ist; ein Tippen auf
  einen Tag öffnet Grund und angerechnete Tage. Daneben stehen die Summen für
  den Monat und für das laufende Jahr. Den Vertretungsplan und den Kalender
  sehen alle Angemeldeten; bearbeiten darf jede:r nur die eigenen Daten.
- **Urlaubstage zählen nach Anwesenheit** – bei der festen Zentrale-Besetzung
  zählen nur die Wochentage, an denen sie tatsächlich in der Zentrale wäre.
- **Feiertage ohne Verfallsdatum** – die gesetzlichen Feiertage in NRW werden
  für jedes Jahr aus der Osterformel berechnet, auch weit in der Zukunft. Es
  gibt keinen Stichtag, ab dem der Kalender gepflegt werden müsste.
- **Schulferien** – in den NRW-Ferien findet kein Berufsschulunterricht statt,
  die Auszubildenden stehen dann auch an ihren Schultagen zur Verfügung. Die
  Termine der Ferienordnung bis 2029/30 sind mitgeliefert.
- **Alles änderbar** – Auszubildende, Zentrale-Besetzung, Pausenzeiten,
  Feiertage, Betriebsferien und Verteilungsregeln über die Verwaltung.

## Technik

| Baustein | Wahl |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Actions) |
| UI | shadcn/ui, Tailwind CSS v4, TanStack Table & Query |
| Datenbank | PostgreSQL 17 mit Drizzle ORM |
| Anmeldung | Auth.js v5 mit Microsoft Entra ID (SSO) |
| Sprache | Oberfläche deutsch, URLs und Code englisch |
| Betrieb | Docker Compose (App + DB + Cron-Worker) |

Die Planungslogik liegt vollständig in `src/lib/scheduler/engine.ts` und ist
frei von Datenbank- und Framework-Abhängigkeiten: Sie bekommt alle Stammdaten
hineingereicht und gibt einen vollständigen Vorschlag zurück. Dadurch ist sie
deterministisch und mit `npm test` prüfbar.

## Einrichtung (Entwicklung)

```bash
cp .env.example .env.local          # Werte anpassen
openssl rand -base64 32             # -> AUTH_SECRET
docker compose up -d                # PostgreSQL auf Port 5433
npm install
npm run db:migrate                  # Tabellen anlegen
npm run db:seed -- --demo           # Grunddaten (+ Beispiel-Azubis)
npm run dev
```

Anmeldung unter <http://localhost:3000>. Solange `DEV_LOGIN_ENABLED=true` gesetzt
ist, genügt für die Entwicklung eine E-Mail-Adresse ohne Passwort. Die in
`BOOTSTRAP_ADMIN_EMAILS` hinterlegten Adressen erhalten beim ersten Login
automatisch die Rolle *Administrator*.

`npm run db:seed` ohne `--demo` legt nur die Grunddaten an: die Pausen-Slots
(Frühstück 09:00–09:30, Mittag 12:00–12:45), zwei Ganztags-Slots (Mo–Do
07:30–16:15, Fr 07:30–15:30), die NRW-Ferienordnung, die Standardeinstellungen
und eine Zentrale-Besetzung Mo–Mi / Do–Fr, deren Namen anschließend in der
Verwaltung angepasst werden.

Dass die Zentrale freitags kürzer besetzt ist, bildet das Slot-Modell ohne
Sonderfall ab: Jeder Slot hat eigene Wochentage und Uhrzeiten. Nach demselben
Muster lassen sich beliebige weitere Abweichungen anlegen. Feiertage müssen nicht
angelegt werden – siehe unten.

## Microsoft Entra ID einrichten

1. In Entra ID unter *App-Registrierungen* eine neue Anwendung anlegen.
2. Als Umleitungs-URI (Typ *Web*) eintragen:
   `https://<adresse>/api/auth/callback/microsoft-entra-id`
3. Unter *Zertifikate & Geheimnisse* ein Client-Geheimnis erzeugen und den
   **Wert** kopieren – nicht die daneben stehende Geheimnis-ID.
4. Die drei Variablen setzen:

```env
AUTH_MICROSOFT_ENTRA_ID_ID=<Anwendungs-ID (client)>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<Wert des Client-Geheimnisses>
AUTH_MICROSOFT_ENTRA_ID_ISSUER=<Verzeichnis-ID (Mandant)>
```

### Wer sich anmelden darf

Beim ersten erfolgreichen Login legt die Anwendung automatisch ein
Benutzerkonto an. Damit dabei nichts Fremdes hereinkommt, lässt sich der
Zugang auf E-Mail-Domänen einschränken:

```env
ALLOWED_EMAIL_DOMAINS=be-bauelemente.com
```

Mehrere Domänen werden mit Komma getrennt; Unterdomänen sind eingeschlossen.
Bleibt die Variable leer, entscheidet allein die Anmeldung bei Microsoft – das
genügt, solange die App-Registrierung an einen einzelnen Mandanten gebunden
ist. Bei einer mandantenübergreifenden Registrierung gehört hier die eigene
Domäne hinein.

Beim Aussteller werden alle gebräuchlichen Schreibweisen angenommen: die bloße
Mandanten-ID, die vollständige Adresse
`https://login.microsoftonline.com/<MANDANTEN-ID>/v2.0` – mit oder ohne
abschließenden Schrägstrich – und auch eine Angabe ohne `https://`. Bleibt die
Variable leer, kann sich jedes Microsoft-Konto anmelden; für den Betrieb im
Unternehmen gehört die Mandanten-ID hinein.

Ist der Wert unbrauchbar, startet der Container nicht und nennt im Protokoll
den Grund. Ohne diese Prüfung erschiene der Fehler erst beim Anmeldeversuch als
`TypeError: Invalid URL`.

### Rollen

| Rolle | Darf |
| --- | --- |
| `APPRENTICE` | eigenen Plan sehen, Urlaub und Schultage pflegen |
| `DESK` | feste Zentrale-Besetzung: eigene Abwesenheiten pflegen |
| `PLANNER` | zusätzlich planen und alle Stammdaten pflegen |
| `ADMIN` | zusätzlich Rollen, Benachrichtigungen und Systemeinstellungen |

Vertretungsplan und Monatskalender sind unabhängig von der Rolle für alle
Angemeldeten sichtbar – die Rollen steuern nur, wer etwas ändern darf.

Die Rolle `PLANNER` schließt einen eigenen Auszubildenden-Datensatz nicht aus:
Wer den Plan verantwortet, ist in der Regel selbst Azubi und wird ganz normal
mit eingeplant. Rollen vergibt der Administrator unter
*Verwaltung → Einstellungen*.

## Betrieb mit Dokploy

Die Anwendung ist als Docker-Abbild ausgelegt: Next.js im Standalone-Modus,
dazu zwei eigenständig gebündelte Hilfsprogramme für Migration und Cron. Beim
Start bringt der Container die Datenbank selbst auf den aktuellen Stand – ein
Deployment braucht keinen zusätzlichen Handgriff.

### Als Compose-Anwendung (empfohlen)

1. In Dokploy eine neue Anwendung vom Typ **Compose** anlegen und dieses
   Repository als Quelle hinterlegen.
2. Als Compose-Datei `docker-compose.dokploy.yml` auswählen. Sie startet drei
   Dienste: `db` (PostgreSQL mit dauerhaftem Volume), `app` und `worker`.
3. Unter *Environment* die Werte setzen:

```env
POSTGRES_USER=azubiportal
POSTGRES_PASSWORD=<langes Passwort>
POSTGRES_DB=azubiportal
AUTH_SECRET=<openssl rand -base64 32>
CRON_SECRET=<openssl rand -hex 24>
APP_BASE_URL=https://azubiportal.firma.de
AUTH_MICROSOFT_ENTRA_ID_ID=<Anwendungs-ID>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<Geheimnis>
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<Mandanten-ID>/v2.0
ALLOWED_EMAIL_DOMAINS=firma.de
BOOTSTRAP_ADMIN_EMAILS=vorname.nachname@firma.de
```

4. Unter *Domains* die Domain auf den Dienst **app**, Port **3000** routen und
   HTTPS aktivieren. `APP_BASE_URL` muss dieselbe Adresse enthalten.
5. Deployen. Der Container wendet die Migrationen an und startet.

Die Compose-Datei veröffentlicht bewusst keine Ports – das Routing übernimmt
der Reverse-Proxy von Dokploy.

### Als einzelne Anwendung mit externer Datenbank

Wer die Datenbank getrennt betreibt (z.B. als Dokploy-eigene PostgreSQL-
Instanz), legt stattdessen eine Anwendung vom Typ **Dockerfile** an und setzt
zusätzlich `DATABASE_URL`. Der Worker entfällt dabei; die beiden Cron-Aufgaben
lassen sich als Dokploy-Schedules einrichten:

```bash
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://azubiportal.firma.de/api/cron?job=reminders"
```

### Nach dem ersten Deployment

Die Migrationen laufen beim Start automatisch; die Datenbank ist danach leer,
aber vollständig. Anlegen lässt sich alles Weitere direkt in der Oberfläche:

1. Mit der Adresse aus `BOOTSTRAP_ADMIN_EMAILS` anmelden – dieses Konto
   bekommt die Rolle *Administrator*.
2. Unter *Verwaltung → Pausenzeiten* die Vertretungszeiten anlegen.
3. Unter *Verwaltung → Zentrale* die feste Besetzung mit ihren Wochentagen
   eintragen, mit E-Mail-Adresse, damit sich diese Personen selbst anmelden
   können.
4. Unter *Verwaltung → Auszubildende* die Azubis anlegen.
5. Unter *Plan erstellen* den ersten Planlauf starten.

Feiertage müssen nicht angelegt werden – sie werden berechnet.

### Zustandsprüfung

`GET /api/health` antwortet mit 200, wenn die Anwendung läuft **und** die
Datenbank erreichbar ist, sonst mit 503. Das Docker-Abbild nutzt den Endpunkt
für seinen eigenen `HEALTHCHECK`; Dokploy zeigt den Zustand in der Übersicht.

### Startprüfung

Beim Start prüft der Container die Konfiguration und bricht mit einer
verständlichen Meldung ab, wenn etwas fehlt – etwa ein zu kurzes
`AUTH_SECRET`, eine fehlende `AUTH_URL` oder ein in Produktion aktivierter
Entwicklungs-Login.

### Zeitgesteuerte Aufgaben

Der Worker (`worker.mjs`) ruft `POST /api/cron?job=…` mit dem `CRON_SECRET` auf.
Er läuft als eigener Container aus demselben Abbild, nur mit anderem Befehl
(`node /app/worker.mjs`), und führt selbst keine Migrationen aus.
Die Zeitpunkte stehen als Cron-Ausdrücke in der Umgebung:

| Variable | Standard | Aufgabe |
| --- | --- | --- |
| `REMINDER_CRON` | `0 7 * * 1-5` | Morgenerinnerungen versenden |
| `PLANNING_CRON` | `30 5 * * 1` | Plan für den Planungshorizont erzeugen |

## Schulferien

Ferien lassen sich – anders als Feiertage – nicht berechnen; sie werden vom
Schulministerium festgelegt. Die Termine der
[Ferienordnung für Nordrhein-Westfalen](https://www.schulministerium.nrw/ferienordnung-fuer-nordrhein-westfalen-fuer-die-schuljahre-bis-202930)
sind bis zum Schuljahr 2029/30 in `src/lib/school-holidays-nrw.ts` hinterlegt
und werden beim Seed in die Tabelle `school_holidays` geschrieben.

Innerhalb dieser Zeiträume greifen die wiederkehrenden Berufsschultage nicht.
Blockunterricht bleibt davon unberührt – der wird weiterhin als Abwesenheit
erfasst.

Unter *Verwaltung → Kalender* lassen sich Ferien ergänzen, entfernen und die
mitgelieferte Ferienordnung erneut einlesen. Läuft der Datensatz irgendwann
aus, ist das dort sichtbar.

## Feiertage

Die gesetzlichen Feiertage in Nordrhein-Westfalen werden bei jeder Planung für
die betroffenen Jahre berechnet: die festen Termine direkt, die beweglichen
über den Ostersonntag (Gaußsche Osterformel, gültig im gesamten gregorianischen
Kalender). Es gibt deshalb kein Jahr, ab dem die Anwendung ohne Feiertage
dasteht, und nichts fortzuschreiben.

Die Tabelle `public_holidays` speichert nur noch **Abweichungen** davon:

- selbst eingetragene, betriebseigene Feiertage
- abgeschaltete Tage – etwa wenn an Fronleichnam trotzdem gearbeitet wird
- abweichende Bezeichnungen

Unter *Verwaltung → Kalender* lässt sich jedes Jahr aufrufen und einzeln
anpassen; das Rücksetzen einer Anpassung stellt den berechneten Wert wieder
her. Wer aus einer früheren Fassung noch vorberechnete Zeilen in der Tabelle
hat, kann sie gefahrlos löschen:

```sql
DELETE FROM public_holidays WHERE source = 'AUTO' AND is_active = true;
```

## Wann geplant wird

Geplant wird immer ab der **kommenden** Woche – die laufende ist verteilt und
soll sich nicht unter den Beteiligten wegändern.

| Auslöser | Zeitraum |
| --- | --- |
| *Plan erstellen* (Voreinstellung) | die nächste Arbeitswoche, Mo–Fr |
| Automatischer Lauf (`PLANNING_CRON`) | die nächsten zwei Arbeitswochen |

Die Zahl der Wochen für den automatischen Lauf steht unter
*Verwaltung → Einstellungen* als „Planungshorizont (Arbeitswochen)"; derselbe
Wert steckt hinter der Schaltfläche *Nächste N Arbeitswochen*. Auf der
Startseite weist ein Hinweis darauf hin, wenn der Plan nicht so weit reicht.

Der Zeitraum in *Plan erstellen* lässt sich jederzeit von Hand weiter fassen –
gesperrte Einteilungen bleiben bei jedem Lauf unverändert.

## So funktioniert die Verteilung

Für jeden Tag im Zeitraum ermittelt die Engine zunächst, ob überhaupt vertreten
werden muss (Wochenende, Feiertag, Betriebsferien fallen heraus) und welchen
**Dienst** es zu besetzen gibt. Ein Dienst ist das, was eine Person an einem Tag
übernimmt: normalerweise alle Pausen zusammen, bei Ausfall der Festbesetzung
stattdessen der ganze Tag.

Fällt die Festbesetzung aus, wird ganztägig vertreten – und diese Person
braucht selbst Pausen. Dafür wird kein zusätzlicher Platz vergeben: Die Pausen
übernimmt der **1. Ersatz** derselben Einteilung. Im Plan steht das
ausdrücklich dabei, damit erkennbar bleibt, woher die Person kommt.

Anschließend wird pro Dienst ein Bewerberfeld gebildet: Wer eingestellt,
planbar, nicht in der Schule und nicht abwesend ist. Weil der Pausendienst
beide Pausen umfasst, scheidet auch aus, wer nur eine der beiden könnte – ein
halber Urlaubstag schließt also vom ganzen Tagesdienst aus. Erst mit
abgeschalteter Zusammenfassung blockiert er nur die betroffene Tageshälfte.

Aus diesem Feld gewinnt die Person mit der niedrigsten Punktzahl:

```
Punkte = (gewichtete Vertretungen + Ersatz-Gewicht × Ersatz-Nominierungen) / Einsatzfaktor
```

Dazu kommen Aufschläge, wenn weiche Regeln verletzt würden – zu kurzer Abstand
zum letzten Einsatz, Wochenhöchstzahl erreicht, bereits am selben Tag
eingeteilt. Diese Aufschläge verhindern nichts: Ist niemand anderes verfügbar,
wird trotzdem geplant, damit die Zentrale besetzt bleibt. Bei Gleichstand
entscheidet der längere Abstand zum letzten Einsatz und danach der Name – der
Plan ist damit reproduzierbar.

Ein Dienst erzeugt je Zeitfenster einen Datensatz. Dadurch bekommt jede Pause
ihren eigenen Kalendereintrag, während Plan und Erinnerung die Person nur einmal
nennen. Manuell geänderte Einteilungen gelten immer für den kompletten Dienst,
werden gesperrt und von späteren Planläufen nicht mehr angetastet. Kann eine Position nicht besetzt werden, erscheint sie als
Hinweis im Planlauf und als Warnung auf der Startseite.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` / `npm start` | Produktionsbuild und -start |
| `npm test` | Tests der Planungslogik |
| `npm run typecheck` | TypeScript prüfen |
| `npm run lint` | ESLint |
| `npm run db:generate` | Migration aus dem Schema erzeugen |
| `npm run db:migrate` | Migrationen anwenden |
| `npm run db:seed` | Grunddaten (`-- --demo` für Beispieldaten) |
| `npm run db:studio` | Drizzle Studio |
| `npm run worker` | Cron-Worker lokal starten |
| `docker build -t azubiportal .` | Produktionsabbild bauen |

## Projektstruktur

```
src/
  app/
    (app)/              Angemeldeter Bereich
      page.tsx          Startseite mit Tagesübersicht und Warnungen
      calendar/         Monatskalender: wer ist wann nicht da
      schedule/         Vertretungsplan für alle
      my-schedule/      Eigene Termine + Kalender-Abo
      absences/         Urlaub, Krankmeldungen, Ausfälle der Zentrale
      school/           Eigene Berufsschultage
      planning/         Planlauf, Verteilung, manueller Tausch
      admin/            apprentices, absences, desk, coverage, calendar,
                        notifications, settings
    actions/            Server Actions (Schreibzugriffe)
    api/                Auth, ICS-Feed, Cron-Endpunkt
  db/                   Drizzle-Schema, Migration, Seed
  lib/
    scheduler/          Planungs-Engine, Verfügbarkeit, DB-Anbindung
    notify/             E-Mail- und Teams-Versand
    holidays.ts         NRW-Feiertage (Osterformel, für jedes Jahr)
    school-holidays-nrw.ts  Ferienordnung NRW bis 2029/30
    calendar.ts         Feiertage + Anpassungen, Betriebsferien
    year-overview.ts    Datengrundlage des Abwesenheitskalenders
    year-marks.ts       Formen und Monatsableitung dazu
    people.ts           Gemeinsame Begriffe für Azubis und Zentrale-Besetzung
    ics.ts              ICS-Generator
    settings.ts         Einstellungen mit Zod-Schemata
```
