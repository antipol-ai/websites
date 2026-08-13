/**
 * /api/karte  ·  Liefert einem geteilten Link seine eigene Vorschau.
 *
 * Das Problem, das diese Funktion löst: Mantrify ist eine einzelne statische
 * index.html. Query-Parameter ändern die ausgelieferte Datei nicht, also trugen
 * alle geteilten Zustände dieselben Open-Graph-Angaben. Wer "Nicht mein Zirkus"
 * in der Stimme des Code Ninja weitergab, dessen Empfänger sah in WhatsApp den
 * allgemeinen Text und den blauen Würfel eines anderen Mantras.
 *
 * Wie es jetzt läuft:
 *   Der Teilen-Knopf verschickt  https://mantrify.antipol.ai/m/einfluss/n
 *   vercel.json schreibt das um auf  /api/karte?m=einfluss&v=n
 *   Diese Funktion liefert eine kleine Seite mit den passenden Meta-Angaben
 *   und schickt Menschen sofort weiter auf  /?m=einfluss&v=n#g
 *
 * Warum eine Zwischenseite und kein Redirect für alle: Ein 302 würde auch die
 * Vorschau-Bots weiterschicken, und die läsen dann wieder die statischen Tags
 * der index.html. Die Bots bleiben also hier und lesen, was für sie bestimmt
 * ist; Browser laufen per location.replace weiter, ohne einen Eintrag in der
 * Zurück-Liste zu hinterlassen. Kein Erkennen von User-Agents, das ginge daneben,
 * sobald ein Dienst seinen Namen ändert.
 *
 * Das Fragment #g ist die Herkunftsmarke. Es geht nicht an den Server, kostet
 * also keine Anfrage, und die Startseite liest daran ab, dass dieser Aufruf aus
 * einer Weitergabe kommt. Vorher wurde dafür location.search geprüft, und das
 * zählte jeden Neuladen nach dem Drehen als Weitergabe mit.
 *
 * Die Sätze stehen in api/karten-daten.js und werden von machkarten.js erzeugt,
 * zusammen mit den Bildern. Das ist kein zweiter Datenbestand, der auseinander
 * laufen kann: Ändert sich ein Satz, muss ohnehin die Karte neu gerendert
 * werden, weil der Satz im Bild steht.
 *
 * Als Modul, nicht als JSON-Datei: Ein import wird von Vercel automatisch mit
 * gebündelt. Eine Datei danebenzulegen hiesse, sie über includeFiles mitnehmen
 * zu müssen und sie über process.cwd() zu finden, und cwd ist in einer Funktion
 * nicht das Projektverzeichnis. Zwei Möglichkeiten zu scheitern statt keiner.
 */
import { KARTEN } from './karten-daten.js';

const BASIS = 'https://mantrify.antipol.ai';

const SAUBER = /^[a-z0-9_-]{1,24}$/i;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function handler(req, res) {
  const u = new URL(req.url, BASIS);
  const m = u.searchParams.get('m') || '';
  const v = u.searchParams.get('v') || '';

  /* Unbekanntes führt nicht zu einem Fehler, sondern auf die Startseite.
     Ein geteilter Link ist oft der erste Kontakt; er darf nie ins Leere laufen. */
  if (!SAUBER.test(m) || !SAUBER.test(v)) {
    res.statusCode = 302;
    res.setHeader('Location', '/');
    return res.end();
  }

  const k = KARTEN[`${m}/${v}`];
  if (!k) {
    res.statusCode = 302;
    res.setHeader('Location', '/');
    return res.end();
  }

  const bild  = `${BASIS}/karten/${m}-${v}.jpg`;
  const ziel  = `/?m=${encodeURIComponent(m)}&v=${encodeURIComponent(v)}#g`;
  const titel = k.satz;
  const text  = `${k.wer} auf „${k.name}“. Mantrify: hilft jetzt, ändert nix.`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  /* Kurz zwischenspeichern: Ein Bot holt dieselbe Adresse gern mehrfach
     hintereinander, ein Mensch klickt sie einmal. */
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=3600');
  res.end(`<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titel)}</title>
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Mantrify">
<meta property="og:locale" content="de_DE">
<meta property="og:url" content="${BASIS}/m/${esc(m)}/${esc(v)}">
<meta property="og:title" content="${esc(titel)}">
<meta property="og:description" content="${esc(text)}">
<meta property="og:image" content="${bild}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(k.wer)} und der Satz: ${esc(titel)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(titel)}">
<meta name="twitter:description" content="${esc(text)}">
<meta name="twitter:image" content="${bild}">
<link rel="canonical" href="${BASIS}/">
<meta http-equiv="refresh" content="0;url=${esc(ziel)}">
<style>html,body{margin:0;height:100%;background:#0D0D0D;color:#9C9489;
  font:14px/1.6 system-ui,sans-serif;display:flex;align-items:center;justify-content:center}
  a{color:#D4652E}</style>
</head>
<body>
<p><a href="${esc(ziel)}">Weiter zu Mantrify</a></p>
<script>location.replace(${JSON.stringify(ziel)});</script>
</body>
</html>`);
}
