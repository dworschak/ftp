# Feature Backlog – Family Tree Printer

Stand: Juni 2026  
Format: **[Priorität] Titel** – Kurzbeschreibung + technische Hinweise wo sinnvoll.  
Priorität: 🔴 Hoch · 🟡 Mittel · 🟢 Niedrig / Nice-to-have

---

## 1. Datenmodell & Datenhaltung

### 🔴 Undo / Redo für Personen-Bearbeitungen
Änderungen an Personen (Name, Daten, Verknüpfungen) sollten rückgängig gemacht werden können.  
Umsetzung: Command-Pattern oder Immutable-History-Stack in `App.tsx` (`useState<FamilyTree[]>` als History-Array).  
Betrifft: `App.tsx`, `ViewEditor.tsx`, `PersonEditDialog.tsx`.

### 🔴 Foto / Portrait pro Person
Jede Person kann ein Bild hinterlegen (Datei-Upload → Base64 oder Supabase Storage-URL).  
`Person`-Interface um optionales Feld `photoUrl?: string` erweitern.  
In `TreeCanvas.tsx` als `<image>` im SVG-Personenkasten darstellen (mit Fallback-Avatar).  
GEDCOM-Tag `OBJE` beim Import berücksichtigen.

### 🔴 Notizen / Biographie pro Person
Freitextfeld `notes?: string` im `Person`-Interface.  
Anzeige im `PersonEditDialog.tsx` als mehrzeiliges `Textarea`-Feld.  
Im Canvas optional als Tooltip oder Klappbereich.

### ✅ Beruf / Berufsleben-Felder (umgesetzt)
`occupation?: string` und optional `occupationFrom?: string` / `occupationTo?: string`.  
Anzeige im Canvas über LayoutSettings steuerbar (analog `showBirthDate`).

### 🟡 Quellen-/Belegnachweise (Source Citations)
Pro Datumseintrag (Geburt, Tod, Heirat) eine optionale Quellenangabe speichern.  
`SourceCitation`-Interface in `types.ts`: `{ text: string; url?: string }`.  
Sichtbar im `PersonEditDialog` als aufklappbarer Abschnitt.

### 🟡 Adoptions- und Stiefkind-Beziehungen
Beziehungstyp `'biological' | 'adoptive' | 'step' | 'foster'` für `fatherId` / `motherId`.  
Erfordert Breaking Change im Datenmodell; Migrations-`useEffect` in `App.tsx` notwendig.  
Im Canvas gestrichelte Linie für nicht-biologische Verbindungen.

### 🟡 Scheidungen / Ende einer Ehe
`Marriage`-Interface um `divorceDate?: string` und `divorced?: boolean` erweitern.  
Im Canvas und in der Legende kennzeichnen.

### 🟢 Merge zweier Bäume
Zwei `FamilyTree`-Datensätze zu einem zusammenführen mit Duplikaterkennung (Name + Geburtsjahr-Heuristik).  
Konfliktlösung per Dialog (beide Versionen nebeneinander zeigen, Nutzer wählt).

### 🟢 IndexedDB statt localStorage
Bei großen Bäumen (> 2 000 Personen) stößt `localStorage` an Grenzen (~5 MB).  
Migration auf `idb` oder `localforage` als Abstraktionsschicht.  
Fallback bleibt unverändert, nur der Speicher-Adapter wird ausgetauscht.

---

## 2. GEDCOM-Import & -Export

### 🔴 GEDCOM-Export
Den aktuellen Baum als valide GEDCOM-5.5-Datei exportieren.  
Neue Datei `lib/gedcomExporter.ts` mit Funktion `exportGedcom(tree: FamilyTree): string`.  
Button im `ViewList`- oder `TreeList`-Screen.

### 🟡 Inkrementeller GEDCOM-Import (Merge statt Replace)
Beim erneuten Import wahlweise vorhandene Personen aktualisieren statt den gesamten Baum zu ersetzen.  
Dialog zeigt Diff: neue Personen, geänderte Felder, entfernte Personen.

### 🟡 GEDCOM 7.0-Unterstützung
Der Parser versteht GEDCOM 5.5.1; neuere Dateien nutzen GEDCOM 7.0-Tags.  
Wichtigste Unterschiede: `SOUR`-Struktur, `INDI.SEX`-Werte, `DATE`-Kalendertypen.  
Non-fatale Fehler weiterhin als `errors[]` sammeln.

### 🟢 FamilySearch-API-Import
Öffentliche Stammbäume aus FamilySearch per API-Key abrufen und als `Person[]` importieren.  
Erfordert OAuth-Flow → aufwändig; als eigenständiges optionales Feature markieren.

---

## 3. Canvas & Visualisierung

### 🔴 Fächer-/Radialchart (Fan Chart)
Kreisförmige Ahnentafel: die Wurzelperson in der Mitte, Eltern im inneren Ring, Großeltern im nächsten usw.  
Neue `GraphType`-Variante `'fan'` in `types.ts`.  
Eigene Layout-Funktion in `TreeCanvas.tsx` oder ausgelagertes `fanLayout.ts`.

### 🔴 Personen suchen & im Canvas hervorheben
Suchfeld im Canvas-Header; gefundene Personen werden im SVG mit einem Highlight-Rahmen markiert und gescrollt.  
Kein neuer View – Overlay auf dem bestehenden Canvas.

### 🟡 Timeline-/Zeitachsen-Ansicht
Horizontale Achse = Jahrzehnte/Jahre, Personen-Balken zeigen Lebensspanne.  
Neue `GraphType`-Variante `'timeline'`.  
Gut geeignet zur Darstellung paralleler Generationen.

### 🟡 Kompakt-Modus (nur Name)
Sehr kleine Personenkästen mit nur dem Namen; alle Datumsfelder ausgeblendet.  
Statt vieler einzelner `show*`-Flags ein neues `displayMode: 'full' | 'compact' | 'minimal'` in `LayoutSettings`.

### 🟡 Individuelle Einfärbelogik per Linie
Aktuell werden Farben per Großeltern-/Urgroßelternlinie vergeben.  
Neue Option: manuelle Farbe pro Person (Picker im `PersonEditDialog`).  
Feld `customColor?: string` in `Person`.

### 🟡 Personen im Canvas ein-/ausblenden
Checkbox pro Person im Canvas-Klickmenü: "Hide in this view".  
Gespeichert als `hiddenPersonIds: string[]` in `SavedView`.  
Nützlich, um irrelevante Seitenlinien auszublenden ohne sie zu löschen.

### 🟡 Mehrseitige Druckansicht (Poster-Modus)
Große Bäume auf mehrere DIN-A4/A3-Seiten aufteilen mit Überlappungsmarkierungen.  
Einstellbare Seitengröße in `LayoutSettings` (`paperSize: 'A4' | 'A3' | 'Letter'`).  
CSS `@page`-Regeln + `print:` Tailwind-Klassen.

### 🟢 Spiegelungsoption (links → rechts statt oben → unten)
Horizontales Layout: Wurzel links, Vorfahren rechts.  
Neues Flag `orientation: 'vertical' | 'horizontal'` in `LayoutSettings`.

### 🟢 Verbindungslinien-Stil erweitern
Derzeit `straight` / `rounded`.  
Ergänzen: `orthogonal` (rechtwinklig wie in klassischen Genealogie-Programmen) und `curved` (Bézierkurven).

---

## 4. UX & Editor

### 🔴 Personen direkt im Canvas hinzufügen
Rechtsklick auf leeres Canvas → Kontextmenü „Add child of …" / „Add parent of …".  
Öffnet `PersonEditDialog` mit vorausgefüllten Beziehungsfeldern.

### 🔴 Tastaturnavigation im Canvas
Pfeiltasten zum Verschieben des Fokus zwischen Personen-Boxen.  
Enter zum Öffnen des Edit-Dialogs.  
Verbessert Accessibility (ARIA-Rollen auf SVG-Gruppen).

### 🟡 Drag & Drop zum Neuverknüpfen von Personen
Eltern-Kind-Beziehung durch Ziehen einer Person auf eine andere ändern.  
Visuelles Feedback während des Ziehens (gestrichelte Verbindungslinie).

### 🟡 Globale Suche über alle Bäume
Suchleiste in `TreeList` oder als Keyboard-Shortcut (Cmd/Ctrl+K).  
Zeigt Personen aus allen gespeicherten Bäumen mit direktem Link zum entsprechenden Baum.

### 🟡 Mehrfach-Auswahl & Bulk-Löschen
Im Canvas mehrere Personen per Shift-Klick oder Lasso auswählen und gemeinsam löschen oder verschieben.

### 🟡 Duplizieren einer Person
Schaltfläche im `PersonEditDialog`: „Duplicate" – legt eine Kopie mit neuem `id` an.  
Nützlich bei Namensgleichheit in verschiedenen Generationen.

### 🟡 Ansichten kopieren
Eine `SavedView` duplizieren, um auf Basis eines bestehenden Layouts eine neue Variante zu erstellen.  
Im `ViewList`-Screen als Kontextmenü-Option.

### 🟢 Tastenkürzel-Übersicht (Keyboard Shortcuts Dialog)
`?` öffnet ein Overlay, das alle verfügbaren Shortcuts auflistet.

### 🟢 Inline-Umbenennung von Bäumen und Ansichten
Name direkt in der Liste per Doppelklick bearbeiten (kein separater Dialog nötig).

---

## 5. Sharing & Zusammenarbeit

### 🔴 Öffentlicher Teilen-Link (Read-Only)
Einen Baum oder eine Ansicht mit einem öffentlichen URL-Token teilen (kein Login nötig).  
Supabase Row-Level-Security: neue Spalte `public_token TEXT UNIQUE` in der `trees`-Tabelle.  
Dedicated read-only View in React (`AppView`: `'sharedView'`).

### 🟡 Echtzeit-Kollaboration (Multi-User)
Mehrere Nutzer bearbeiten gleichzeitig denselben Baum.  
Supabase Realtime Channels; Konfliktlösung per Last-Write-Wins auf Personen-Ebene.  
Anwesenheitsindikatoren im Canvas (Avatar + Cursor).

### 🟡 Kommentare / Notizen an Personen-Boxen
Andere Nutzer können Post-It-ähnliche Kommentare hinterlassen.  
Eigene Tabelle `comments(id, tree_id, person_id, author, text, created_at)` in Supabase.

### 🟢 Export als selbstständige HTML-Datei
Einen vollständigen, interaktiven Baum als einzelne `index.html` exportieren, die ohne Server läuft.  
SVG + Inline-CSS + minimales JS für Zoom/Pan.

### 🟢 QR-Code-Generierung
QR-Code für den Teilen-Link direkt im Export-Dropdown anzeigen und als PNG herunterladen.  
Bibliothek: `qrcode` (MIT-Lizenz).

---

## 6. Authentifizierung & Account

### 🔴 Echte Supabase Auth (statt Frei-Text-E-Mail)
Aktuell wird nur eine E-Mail-Adresse lokal gespeichert – keine echte Authentifizierung.  
Migration auf `supabase.auth.signInWithOtp()` (Magic Link) oder `signInWithPassword()`.  
`LoginScreen.tsx` um Passwort-Feld oder Magic-Link-Flow erweitern.  
Alle `db.*`-Funktionen via `auth.getUser()` absichern.

### 🟡 Mehrere Nutzer pro Baum (Berechtigungen)
Tabelle `tree_members(tree_id, user_id, role: 'owner' | 'editor' | 'viewer')`.  
Einladungs-Flow per E-Mail.

### 🟢 Social Login (Google / GitHub)
`supabase.auth.signInWithOAuth({ provider: 'google' })` im `LoginScreen`.

---

## 7. Performance & Technische Schulden

### 🔴 Virtualisierung großer Bäume
Bei > 500 Personen wird der SVG-DOM sehr groß und der Browser langsam.  
Nur sichtbare Nodes rendern (Viewport-Culling) – ähnlich Virtual Scrolling.  
Kann als Opt-in hinter einem Feature-Flag implementiert werden.

### 🟡 Web Worker für Layout-Berechnung
Die synchrone Layout-Funktion in `TreeCanvas.tsx` blockiert den Haupt-Thread bei großen Bäumen.  
Layout-Logik in einen `Worker` auslagern; Ergebnis per `postMessage` zurückgeben.

### 🟡 Automatische Migrations-Tests
`vitest`-Unit-Tests für den Migrations-`useEffect` in `App.tsx`, die sicherstellen, dass alte localStorage-Daten korrekt auf neue `LayoutSettings`-Felder migriert werden.

### 🟡 GEDCOM-Parser-Tests
Unit-Tests für `gedcomParser.ts` mit Fixtures (echte anonymisierte GEDCOM-Dateien).  
Besonders: deutsche Monatsnamen, unvollständige Datumsangaben, zirkuläre Referenzen.

### 🟡 Umstellung auf `crypto.randomUUID()`
Aktuell werden `Date.now().toString()` als IDs verwendet – Kollisionsgefahr bei Bulk-Imports.  
Ersetzen durch `crypto.randomUUID()` (nativ in allen modernen Browsern).

### 🟢 Bundle-Analyse & Tree Shaking
`vite-bundle-visualizer` einbinden und prüfen, ob alle shadcn/ui-Komponenten wirklich genutzt werden.  
Ungenutzte Komponenten entfernen.

### 🟢 Service Worker / Offline-Support
`vite-plugin-pwa` für eine installierbare PWA mit Offline-Cache der App-Shell.  
Lokale Änderungen in eine Queue schreiben und bei nächster Verbindung zu Supabase syncen.

---

## 8. Accessibility & Internationaliserung

### 🟡 ARIA-Rollen & Screen Reader Support
SVG-Elemente mit `role="img"`, `aria-label` und `aria-describedby` versehen.  
Fokus-Management im `PersonEditDialog` (erster Input bekommt Fokus beim Öffnen).

### 🟡 Farbblindheits-freundliche Paletten
Alternative `ColorScheme`-Paletten: `by-grandparent-cb` (Colorblind-safe, z. B. Okabe–Ito).  
Einstellbar über ein neues `colorPalette`-Feld in `LayoutSettings`.

### 🟢 Mehrsprachige UI (i18n)
`i18next` + `react-i18next` für mindestens Englisch und Deutsch.  
Alle UI-Strings in Ressource-Dateien auslagern.

### 🟢 Reduzierte Bewegung (prefers-reduced-motion)
Animationen (Zoom-Übergänge, Dialog-Einblendungen) bei `prefers-reduced-motion: reduce` deaktivieren.

---

## 9. Druck & physische Ausgabe

### 🟡 Druckvorschau im Browser
Vor dem Ausdruck eine skalierte Vorschau zeigen, die dem Druckergebnis entspricht.

### 🟡 Wasserzeichen / Quellenangabe im Druck
Optionaler Fußzeilen-Text (z. B. Quellenangabe, Datum der Erstellung) der im Druck erscheint.  
Neues Feld `printFooter?: string` in `LayoutSettings`.

### 🟢 Rahmen- und Dekorations-Themes
Vordefinierte dekorative Rahmen (Ornamente, historischer Stil) für die Druckausgabe.  
Als SVG-Dekorationselemente um das Canvas herum.

---

## 10. Statistiken & Analyse

### 🟡 Baum-Statistiken Dashboard
Separate Ansicht pro Baum: Anzahl Personen, Generationen, älteste/jüngste Person, häufigste Vornamen, geografische Verteilung der Geburtsorte.

### 🟡 Fehlende Daten-Anzeige
Highlight von Personen mit unvollständigen Daten (fehlendes Geburtsdatum, keine Eltern verknüpft).  
Als Filter-Overlay im Canvas oder als separate Liste.

### 🟢 Geografische Karte
Geburtsorte auf einer Karte visualisieren (Leaflet.js + OpenStreetMap).  
Erfordert Geocoding der `birthPlace`-Strings.

### 🟢 Namensentwicklung über Generationen
Balkendiagramm der häufigsten Vornamen/Nachnamen pro Generation.  
Einfache SVG-Visualisierung oder `recharts`.

---

## Nicht umsetzen (Bewusst ausgeschlossen)

| Idee | Grund |
|---|---|
| Redux / Zustand / Jotai | Widerspricht den Coding-Guidelines; `useState` + Lifting reicht |
| React Router | Widerspricht den Guidelines; `AppView`-Enum bleibt |
| CSS Modules / styled-components | Tailwind ist gesetzt |
| MUI-Komponenten für neue Features | shadcn/ui ist der Standard |
| `spouseId` / `childrenIds` auf `Person` | Ableitbar; würde Datenkonsistenz-Probleme erzeugen |

