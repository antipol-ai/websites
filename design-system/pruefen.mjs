/**
 * pruefen.mjs — macht die Regeln aus foundation/rules.json ausfuehrbar.
 *
 * Angelegt am 11.08.2026, nachdem auffiel, dass zwei Regeln, die seit April
 * schriftlich gelten, im ausgelieferten Stand verletzt waren:
 *
 *   1. "Kontrastverhaltnis mindestens 4.5:1 (normaler Text), 3:1 (grosser Text)"
 *      --color-text-label stand auf #6B6158 und erreichte auf --color-surface
 *      nur 2,88:1. Der Wert steht seit April in tokens.json.
 *   2. "Keine Gedankenstriche (em-dash)"
 *      Am 26.04. wurden 77 Stellen von Hand bereinigt. Am 11.08. waren
 *      wieder sechs im sichtbaren Text.
 *
 * Beide Regeln waren dokumentiert und keine war geprueft. Eine Regel ohne
 * Test ist eine Absichtserklaerung. Dieses Skript ist der Test.
 *
 * Aufruf:
 *   node design-system/pruefen.mjs
 *
 * Rueckgabewert 1 bei Verstoessen, damit es in einen Pre-Deploy-Check passt.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ── Farbrechnung nach WCAG 2.1 ──────────────────────────────────────────────

function kanal(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminanz(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

function verhaeltnis(vorne, hinten) {
  const a = luminanz(vorne);
  const b = luminanz(hinten);
  const [hell, dunkel] = a > b ? [a, b] : [b, a];
  return (hell + 0.05) / (dunkel + 0.05);
}

// ── Was gegen was geprueft wird ─────────────────────────────────────────────
//
// Der Fehler beim ersten Anlauf war, nur gegen den dunkelsten Grund zu rechnen.
// Eine Textfarbe muss auf JEDER Flaeche halten, auf der sie vorkommen kann.

const BRANDS = {
  antipol: {
    tokens: 'brands/antipol/tokens.json',
    flaechen: ['bg', 'surface', 'surface-elevated'],
    textfarben: ['text', 'text-muted', 'text-label', 'text-light', 'text-pure'],
    // Farben, die als Text vorkommen duerfen, aber nur gross (>= 24px oder 19px fett)
    nurGross: ['primary'],
    akzenteAlsText: ['primary-accessible'],
    // Ausnahmen mit Begruendung. Keine Abschwaechung der Regel, sondern eine
    // Praezisierung: die Farbe ist auf diesen Flaechen als Text nicht
    // freigegeben, deshalb wird sie dort auch nicht geprueft.
    //   primary-light (#D4652E) haelt 5,28 auf bg und 4,72 auf surface, aber
    //   nur 4,32 auf surface-elevated. Auf erhoehten Flaechen gehoert dort
    //   primary-accessible hin. So steht es auch in docs/logo-guideline.md.
    nichtAlsTextAuf: { 'primary-light': ['surface-elevated'] },
  },
  momance: {
    tokens: 'brands/momance/tokens.json',
    flaechen: ['bg', 'surface', 'surface-elevated'],
    textfarben: ['text', 'text-muted', 'text-label', 'text-light', 'text-pure'],
    nurGross: [],
    akzenteAlsText: [],
  },
};

function farbenAus(pfad) {
  const json = JSON.parse(readFileSync(join(__dirname, pfad), 'utf-8'));
  const gruppe = json.color || json.colors || json.farben || {};
  const flach = {};
  for (const [name, wert] of Object.entries(gruppe)) {
    const v = wert && typeof wert === 'object' ? wert.$value : wert;
    if (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v)) flach[name] = v;
  }
  return flach;
}

let verstoesse = 0;

console.log('\n\x1b[1mKontrast (WCAG 2.1 AA)\x1b[0m');

for (const [marke, cfg] of Object.entries(BRANDS)) {
  let farben;
  try {
    farben = farbenAus(cfg.tokens);
  } catch {
    console.log(`  ${marke}: Tokens nicht lesbar, uebersprungen`);
    continue;
  }
  console.log(`\n  ${marke}`);
  const paare = [
    ...cfg.textfarben.map((f) => [f, 4.5]),
    ...(cfg.akzenteAlsText || []).map((f) => [f, 4.5]),
    ...(cfg.nurGross || []).map((f) => [f, 3.0]),
    ...Object.keys(cfg.nichtAlsTextAuf || {}).map((f) => [f, 4.5]),
  ];
  for (const [name, soll] of paare) {
    if (!farben[name]) continue;
    for (const flaeche of cfg.flaechen) {
      if (!farben[flaeche]) continue;
      if ((cfg.nichtAlsTextAuf?.[name] || []).includes(flaeche)) continue;
      const r = verhaeltnis(farben[name], farben[flaeche]);
      const ok = r >= soll;
      if (!ok) verstoesse++;
      const marke = ok ? '\x1b[32m  ok\x1b[0m' : '\x1b[31mFEHL\x1b[0m';
      const zeile = `    ${marke}  ${name.padEnd(20)} auf ${flaeche.padEnd(18)} ${r.toFixed(2)} (mind. ${soll})`;
      if (!ok || process.argv.includes('--alle')) console.log(zeile);
    }
  }
}

if (verstoesse === 0) console.log('    alle Textfarben halten auf allen Flaechen ihrer Marke');

// ── Gedankenstriche im sichtbaren Text ──────────────────────────────────────

console.log('\n\x1b[1mZeichenregel (keine Gedankenstriche)\x1b[0m');

function dateien(verzeichnis, endungen, treffer = []) {
  for (const eintrag of readdirSync(verzeichnis)) {
    if (eintrag === 'node_modules' || eintrag === 'dist' || eintrag.startsWith('.')) continue;
    const p = join(verzeichnis, eintrag);
    if (statSync(p).isDirectory()) dateien(p, endungen, treffer);
    else if (endungen.some((e) => p.endsWith(e))) treffer.push(p);
  }
  return treffer;
}

// Bis-Striche zwischen Zahlen (T1-T3, 2.50-3.49) sind typografisch richtig und
// nicht gemeint. Geprueft wird der Gedankenstrich im Fliesstext.
const BIS_STRICH = /\d\s?[–]\s?\d/;
let striche = 0;

for (const datei of dateien(join(root, 'apps'), ['.astro', '.md', '.ts', '.tsx'])) {
  const zeilen = readFileSync(datei, 'utf-8').split('\n');
  zeilen.forEach((zeile, i) => {
    if (!/[—–]/.test(zeile)) return;
    if (BIS_STRICH.test(zeile) && !/—/.test(zeile)) return;
    striche++;
    console.log(`    \x1b[31mFEHL\x1b[0m  ${relative(root, datei)}:${i + 1}`);
    console.log(`          ${zeile.trim().slice(0, 100)}`);
  });
}

if (striche === 0) console.log('    keine Gedankenstriche gefunden');
verstoesse += striche;

// ── Schriftgroessen ─────────────────────────────────────────────────────────
//
// Geprueft wird nur der Bereich, in dem Copy, UI und Labels liegen. Alles
// darueber sind Ueberschriften; die folgen (Stand 11.08.2026) bewusst noch
// keiner gemeinsamen Skala, siehe rules.json → typografie.ueberschriften-offen.

console.log('\n\x1b[1mSchriftgroessen (Copy, UI, Labels aus den Tokens)\x1b[0m');

const GROESSE = /font-size:\s*([^;]+);/g;
let groessen = 0;

function istImCopyBereich(wert) {
  const rem = wert.match(/^([0-9.]+)rem$/);
  if (rem) return parseFloat(rem[1]) <= 1.3;
  const px = wert.match(/^([0-9.]+)px$/);
  if (px) return parseFloat(px[1]) <= 21;
  // clamp(): der obere Anschlag entscheidet
  const clamp = wert.match(/clamp\([^,]+,[^,]+,\s*([0-9.]+)rem\s*\)/);
  if (clamp) return parseFloat(clamp[1]) <= 1.3;
  return false;
}

// Nicht geprueft: Ueberschriften (eigene Skala, siehe oben), die Wortmarke
// (ein Logo, kein Text; Groesse steht in docs/logo-guideline.md) und Symbole.
const AUSNAHME = /(^|[\s,>(])h[1-6]\b|\.brand|\.header-name|arrow|-num span|ring-\d|ring-label/i;

for (const datei of dateien(join(root, 'apps'), ['.astro']).concat(
  dateien(join(root, 'packages'), ['.astro'])
)) {
  const zeilen = readFileSync(datei, 'utf-8').split('\n');
  let selektor = '';
  zeilen.forEach((zeile, i) => {
    const s = zeile.match(/^[ \t]*([.#a-zA-Z:][^{}\n]*?)\s*\{/);
    if (s) selektor = s[1].trim();
    GROESSE.lastIndex = 0;
    let m;
    while ((m = GROESSE.exec(zeile)) !== null) {
      const wert = m[1].trim();
      if (wert.startsWith('var(--size')) continue;
      if (wert.endsWith('em') && !wert.endsWith('rem')) continue; // relativ zum Elternteil, gewollt
      if (!istImCopyBereich(wert)) continue;
      if (AUSNAHME.test(selektor)) continue;
      groessen++;
      console.log(`    \x1b[33mWARN\x1b[0m  ${relative(root, datei)}:${i + 1}  ${selektor}  ${wert}`);
    }
  });
}

if (groessen === 0) console.log('    keine seiteneigenen Copy- oder Label-Groessen');
else console.log(`    ${groessen} Stelle(n) setzen eigene Groessen statt --size-copy / --size-ui / --size-label.`);

// ── Ergebnis ────────────────────────────────────────────────────────────────

console.log('');
if (verstoesse > 0) {
  console.log(`\x1b[31m${verstoesse} Verstoss/Verstoesse.\x1b[0m Nicht ausliefern, bevor sie behoben sind.\n`);
  process.exit(1);
}
console.log('\x1b[32mAlles sauber.\x1b[0m\n');
