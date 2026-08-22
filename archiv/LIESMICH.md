# Archiv

Hier liegen Dateien, die nicht mehr verwendet werden, aber nicht geloescht
werden sollen. Geloescht wird in diesem Repo grundsaetzlich nicht durch
Aufraeumen, sondern hoechstens durch eine bewusste Entscheidung von Stefan und
Catrin. Verschieben statt loeschen kostet nichts und nimmt der Aufraeumarbeit
das Risiko.

Das Archiv liegt bewusst **ausserhalb** von `apps/`. Die Ordner `apps/mantrify`
und `apps/antipol` sind Wurzeln von Vercel-Projekten; alles darin wird
mitgebaut und ausgeliefert. Was hier liegt, ist im Repo, aber nicht im Netz.

Zurueckholen geht mit `git mv` in die Gegenrichtung. Die Dateihistorie bleibt
erhalten, weil hier verschoben und nicht kopiert wurde.

## 2026-08-22

Aufgeraeumt beim Umbau auf den Dreiklang.

### mantrify/vorschau.jpg
Das alte Vorschaubild beim Teilen: der physische Wuerfel auf einem
Schreibtisch. Ersetzt durch `vorschau-3klang.jpg`, weil es ein Produkt zeigte,
das es noch nicht zu kaufen gibt. Zuletzt referenziert in `og:image`,
`twitter:image` und im Build-Skript von `apps/mantrify/package.json`.

### mantrify/vorschau-mantra.jpg
Ein Vorschaubild fuer geteilte Einzel-Mantras. Wurde zuletzt von nichts mehr
referenziert: Die Route `/m/<wuerfel>/<stimme>` baut ihre Karte ueber
`api/karte.js` aus den Dateien in `apps/mantrify/karten/`, und das Build-Skript
hat diese Datei nie nach `dist` kopiert. Sie war also schon vor dem Umbau
faktisch nicht im Netz.

### mantrify/bilder/produkt-1 bis produkt-4.webp
Produktbilder aus der Zeit, als die Microsite ein Produktmodul mit Fotos hatte.
Kein Verweis mehr im HTML, und das Build-Skript kopiert den Ordner nicht.
Die Bilder, die auf antipol.ai zu sehen sind, liegen getrennt davon unter
`apps/antipol/public/bilder/mantrify/`.

### antipol/momance-puls.svg
Der Momance-Puls als statische Grafik. Ersetzt durch die Komponente
`apps/antipol/src/components/MomancePuls.astro`, die denselben Puls im Markup
zeichnet und ihn dadurch animieren kann. Kein Verweis mehr im Quelltext.
