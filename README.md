# antipol-ai/websites

Zwei Websites, ein Repo, ein Design-System. Gebaut mit Astro 5 und Tailwind 4 in einem
pnpm-Workspace, ausgeliefert über Vercel.

| Ordner | Was drin liegt |
|---|---|
| `apps/antipol` | `antipol.ai` |
| `apps/momance` | `momance.de` |
| `packages/shared` | Layout, Navigation, Fusszeile, Karten. Von beiden Sites benutzt. |
| `design-system` | Die Quelle für Farben, Schriftgrössen und Regeln. Erzeugt daraus CSS. |

## Der Dreischritt

Das ist der wichtigste Abschnitt dieser Datei. Wer ihn überspringt, produziert genau die
Fehler, die am 11.08.2026 gefunden wurden: eine Textfarbe, die seit April unter der
Kontrastgrenze lag, und sechs Gedankenstriche, die eine Aufräumaktion vom April überlebt
hatten.

**1. Ändern, aber in der Quelle.** Farben und Schriftgrössen stehen in
`design-system/brands/<marke>/tokens.json`, übergreifende Regeln in
`design-system/foundation/rules.json`. Die Dateien `apps/*/src/styles/theme.css` und
`packages/shared/styles/tokens.css` sind **generiert** und tragen das auch im Kopf. Wer sie
direkt bearbeitet, verliert die Änderung beim nächsten Generatorlauf.

**2. Erzeugen.**

```
pnpm tokens          # oder: node design-system/build-tokens.mjs
```

Schreibt aus den JSON-Quellen drei CSS-Dateien und die Datendatei der Pattern Library.
Läuft ohne Abhängigkeiten.

**3. Prüfen, vor jedem Push.**

```
pnpm check           # oder: node design-system/pruefen.mjs
```

Rechnet jede Textfarbe gegen jede Fläche ihrer Marke (WCAG 2.1 AA), sucht Gedankenstriche im
sichtbaren Text und meldet Schriftgrössen, die nicht aus den Tokens kommen. Beendet mit
Rückgabewert 1, wenn etwas nicht stimmt. Dauert eine Sekunde.

Mit `--alle` zeigt es auch die bestandenen Kontrastwerte, nicht nur die Verstösse.

## Die Textskala

Drei Grössen ausserhalb der Überschriften, alle aus den Tokens. Seiteneigene Werte sind ein
Fehler und werden von der Prüfung gemeldet.

| Token | Wert | Wofür |
|---|---|---|
| `--size-copy` | `1rem` | jeder Fliesstext |
| `--size-ui` | `0.875rem` | Navigation, Fusszeile, Meta-Werte, Knopfbeschriftungen |
| `--size-label` | `0.75rem` | Mono-Bezeichner in Grossbuchstaben, Untergrenze |

Fliesstext steht immer in `--color-text-muted`. Überschriften folgen noch keiner gemeinsamen
Skala; das ist bewusst offen, siehe `rules.json` unter `typografie`.

## Entwickeln

```
pnpm install
pnpm dev:antipol      # localhost:4321
pnpm dev:momance      # localhost:4322
pnpm build            # beide Sites
```

Beide Dev-Server können parallel laufen.

## Ausliefern

Zwei Vercel-Projects teilen sich dieses Repo und unterscheiden sich nur im Root Directory:

| Project | Root Directory | Domains |
|---|---|---|
| `antipol-website` | `apps/antipol` | antipol.ai (Production), www.antipol.ai (308) |
| `momance-landing` | `apps/momance` | momance.de, www.momance.de |

Es gibt keine Deploy-Datei im Repo; alles steht im Vercel-Dashboard. Ein Push auf `master`
geht direkt live. Wer erst schauen will, pusht einen Branch: Vercel baut daraus automatisch
ein Preview-Deployment, die Produktionsdomains bleiben unberührt.

## Schriften

Alle Schriften liegen lokal unter `apps/*/public/fonts/` und werden per `@font-face`
eingebunden, samt der SIL-OFL-Lizenztexte daneben. **Keine Google-Fonts-URL wieder einbauen.**
Sie überträgt bei jedem Seitenaufruf die IP-Adresse des Besuchers in die USA, bevor irgendwer
zugestimmt hat; das LG München I hat dafür am 20.01.2022 (Az. 3 O 17493/20) Schadensersatz
zugesprochen. Hintergrund in `antipol/docs/rechtstexte-stand.md`.

## Wo die Entscheidungen stehen

Nicht hier. Dieses Repo ist öffentlich, die Begründungen liegen im privaten Repo `antipol`:

- `docs/design-entscheidungen.md` — alle Entscheidungen mit Begründung (E·1 ff.)
- `docs/specs/02-design-system.md` — Farbsystem, Typografie, Formensprache, Barrierefreiheit
- `docs/specs/00-design-system-architektur.md` — wie die drei Schichten zusammenhängen
- `docs/logo-guideline.md` — Anwendungsregeln der Wortmarke

Und was hier ausdrücklich **nicht** hineingehört: Steuernummer, Firmendaten, Zugangsdaten.
Dieses Repo ist seit dem 06.05.2026 öffentlich (E·57).
