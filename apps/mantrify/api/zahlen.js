/**
 * /api/zahlen  ·  Das interne Dashboard.
 *
 * Eine einzige Funktion, die beides macht: schützen und anzeigen. Absicht.
 * Eine statische dashboard.html liesse sich vergessen, verlinken oder von
 * Suchmaschinen finden; eine Funktion mit Basic Auth kann man nicht versehentlich
 * öffentlich machen. Dazu ein X-Robots-Tag, wie bei allem Internen.
 *
 * ZWEI QUELLEN, und das ist Absicht:
 *
 *   1. Vercel Web Analytics beantwortet, WIE VIELE MENSCHEN da waren. Es zählt
 *      Besucher, nicht nur Abrufe, und es kennt Herkunft und Gerät. Das können
 *      wir selbst nicht, weil wir bewusst niemanden wiedererkennen.
 *   2. Unsere eigene Zählung beantwortet, WAS SIE GETAN HABEN. Das kann
 *      Analytics im Hobby-Tarif nicht, weil eigene Ereignisse dort erst ab Pro
 *      möglich sind und der genannte Betrag als Zahl ohnehin nicht abbildbar wäre.
 *
 * Die beiden Quellen zählen unterschiedlich, und das Dashboard sagt das auch.
 * Quoten, die eine Zahl aus Quelle 1 durch eine aus Quelle 2 teilen, sind
 * Näherungen und als solche gekennzeichnet.
 *
 * Gerechnet wird nur aus den Pfaden der abgelegten Ereignisse, ohne eine
 * einzige Datei zu öffnen (siehe api/ereignis.js).
 *
 * Was das Dashboard bewusst NICHT tut: hübsche Kurven zeichnen. Es zeigt die
 * Zahlen, auf die wir uns vorher festgelegt haben, und daneben die Schwelle.
 * Wer Diagramme sehen will, bevor die Schwelle erreicht ist, liest Muster in
 * Rauschen.
 *
 * Einrichtung, Umgebungsvariablen:
 *   DASH_USER, DASH_PASS   Pflicht. Ohne sie antwortet die Funktion mit 503.
 *   VERCEL_TOKEN           Optional. Ohne ihn bleibt der Analytics-Teil leer,
 *                          alles andere funktioniert.
 *   VERCEL_TEAM_ID         Nur nötig, wenn das Projekt einem Team gehört.
 *   VERCEL_PROJECT_ID      Setzt Vercel selbst, wenn Systemvariablen an sind.
 */
import { list } from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';

const ZIEL_DREHER = 200;      // Mindestmenge, bevor ausgewertet wird
const ZIEL_TEILRATE = 0.10;   // jeder Zehnte gibt weiter
const ZIEL_MEDIAN = 25;       // Euro

// Hobby-Tarif: 10.000 "Advanced Operations" im Monat, danach wird der Store
// für dreissig Tage gesperrt. Jedes Ereignis ist eine, jeder Aufruf dieses
// Dashboards je angefangene 1000 Ereignisse eine weitere.
const FREI_OPERATIONEN = 10000;

// Ab welchem Tag gezaehlt wird. Vor dem Release stehen hier Testereignisse
// drin, die niemand geloescht haben will, nur nicht mitzaehlen sollen.
// Am Releasetag hier das Datum eintragen, Format 2026-08-13. null = alles.
// Ein Aufruf mit ?ab=2026-08-13 setzt es einmalig ausser Kraft.
// Gesetzt am 15.08.2026, dem Releasetag. Alles davor waren unsere eigenen
// Durchlaeufe, meist mit Absicht schiefe (Preisregler bis zum Anschlag, jeder
// Weg einmal durchprobiert). Sie bleiben liegen, zaehlen aber nicht mit;
// ?ab=2026-08-01 holt sie bei Bedarf zurueck ins Bild.
const AB_TAG = '2026-08-15';

// Muss zu REIHE in ereignis.js passen. Der Praefix trennt Messreihen mit
// unterschiedlicher Zaehlweise voneinander; die alten Reihen e/ und e2/ liegen weiter im
// Speicher, wird aber nicht mehr gelesen. Ein Aufruf mit ?reihe=e2 zeigt die Testphase vor dem Launch.
const REIHE = 'e3';

/**
 * Zeitkonstanter Vergleich. Ein normaler Vergleich mit === bricht beim ersten
 * abweichenden Zeichen ab; theoretisch verraet die Laufzeit dadurch, wie viele
 * Zeichen stimmten. Ueber das Netz ist das kaum messbar, aber der richtige
 * Vergleich kostet nichts. Die Laenge wird bewusst mit weggehasht, sonst
 * verriete schon die Fehlermeldung, wie lang das Passwort ist.
 */
function gleich(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  if (x.length !== y.length) {
    timingSafeEqual(x, x);   // gleiche Arbeit leisten, dann trotzdem ablehnen
    return false;
  }
  return timingSafeEqual(x, y);
}

function pruefeAnmeldung(req) {
  const u = process.env.DASH_USER, p = process.env.DASH_PASS;
  if (!u || !p) return 'nicht eingerichtet';
  const kopf = req.headers.authorization || '';
  if (!kopf.startsWith('Basic ')) return 'fehlt';
  const roh = Buffer.from(kopf.slice(6), 'base64').toString('utf8');
  const i = roh.indexOf(':');
  const nutzer = i < 0 ? roh : roh.slice(0, i);
  const wort = i < 0 ? '' : roh.slice(i + 1);
  return (gleich(nutzer, u) && gleich(wort, p)) ? null : 'falsch';
}

async function allePfade(reihe) {
  const pfade = [];
  let cursor, runden = 0;
  do {
    const antwort = await list({ prefix: reihe + '/', cursor, limit: 1000 });
    for (const b of antwort.blobs) pfade.push(b.pathname);
    cursor = antwort.hasMore ? antwort.cursor : undefined;
  } while (cursor && ++runden < 50);
  return pfade;
}

function auswerten(pfade, abTag) {
  const z = { aufruf: 0, dreh: 0, teilen_auf: 0, teilen: 0, kauf_auf: 0,
              preis: 0, fuer: 0, kein_kauf: 0 };
  const wege = {}, wen = {}, mantras = {}, tage = {}, ansichten = {}, quellen = {};
  const betraege = [];
  const monat = new Date().toISOString().slice(0, 7);
  let diesenMonat = 0;

  for (const p of pfade) {
    const [, tag, name, detail] = p.split('/');
    if (!(name in z)) continue;
    if (abTag && tag < abTag) continue;   // Zeichenkettenvergleich reicht bei ISO-Daten
    z[name]++;
    tage[tag] = (tage[tag] || 0) + 1;
    if (tag && tag.slice(0, 7) === monat) diesenMonat++;
    if (!detail || detail === 'ohne') continue;
    for (const stueck of detail.split('_')) {
      const i = stueck.indexOf('-');
      if (i < 0) continue;
      const feld = stueck.slice(0, i), wert = stueck.slice(i + 1);
      if (feld === 'betrag') betraege.push(Number(wert));
      else if (feld === 'weg') wege[wert] = (wege[wert] || 0) + 1;
      else if (feld === 'wen') wen[wert] = (wen[wert] || 0) + 1;
      else if (feld === 'mantra') mantras[wert] = (mantras[wert] || 0) + 1;
      /* Diese beiden wurden bis zum 22.08.2026 zwar gespeichert, aber nie
         ausgewertet: "ansicht" lag seit dem 13.08. in jedem Aufruf und tauchte
         auf dieser Seite nirgends auf. Messen und nicht hinsehen ist dasselbe
         wie nicht messen. */
      else if (feld === 'ansicht') ansichten[wert] = (ansichten[wert] || 0) + 1;
      else if (feld === 'von') quellen[wert] = (quellen[wert] || 0) + 1;
    }
  }
  betraege.sort((a, b) => a - b);
  const median = betraege.length
    ? (betraege.length % 2
        ? betraege[(betraege.length - 1) / 2]
        : Math.round((betraege[betraege.length / 2 - 1] + betraege[betraege.length / 2]) / 2))
    : null;
  return { z, wege, wen, mantras, tage, betraege, median, diesenMonat, ansichten, quellen };
}

/* ---------- Vercel Web Analytics: Zahlen von woanders ---------- */

async function analytics(pfad, zusatz = {}) {
  const token = process.env.VERCEL_TOKEN;
  const projekt = process.env.VERCEL_PROJECT_ID;
  if (!token || !projekt) return null;
  const p = new URLSearchParams({ projectId: projekt, ...zusatz });
  if (process.env.VERCEL_TEAM_ID) p.set('teamId', process.env.VERCEL_TEAM_ID);
  const steuerung = new AbortController();
  const uhr = setTimeout(() => steuerung.abort(), 6000);
  try {
    const a = await fetch(`https://api.vercel.com/v1/query/web-analytics/${pfad}?${p}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: steuerung.signal });
    if (!a.ok) return { fehler: `${a.status} ${a.statusText}` };
    return await a.json();
  } catch (e) {
    return { fehler: String(e && e.message || e) };
  } finally {
    clearTimeout(uhr);
  }
}

function seit(tage) {
  return new Date(Date.now() - tage * 864e5).toISOString().slice(0, 10);
}

async function reichweite() {
  const von = seit(30), bis = new Date().toISOString().slice(0, 10);
  const [gesamt, herkunft, geraet, verlauf] = await Promise.all([
    analytics('visits/count'),
    analytics('visits/aggregate', { since: von, until: bis, by: 'referrerHostname', limit: '8' }),
    analytics('visits/aggregate', { since: von, until: bis, by: 'deviceType', limit: '5' }),
    analytics('visits/aggregate', { since: seit(14), until: bis, by: 'day' }),
  ]);
  return { gesamt, herkunft, geraet, verlauf };
}

/* ---------- Darstellung ---------- */

const schuetz = (s) => String(s).replace(/[<>&"]/g, (c) =>
  ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

function tabelle(titel, obj, fussnote) {
  const zeilen = Object.entries(obj).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<tr><td>${schuetz(k)}</td><td class="n">${v}</td></tr>`).join('');
  return zeilen
    ? `<h2>${titel}</h2><table>${zeilen}</table>${fussnote ? `<p class="klein">${fussnote}</p>` : ''}`
    : '';
}

function analyseTabelle(titel, antwort, feld, fussnote) {
  if (!antwort) return '';
  if (antwort.fehler) return `<h2>${titel}</h2><p class="klein warn">nicht abrufbar: ${schuetz(antwort.fehler)}</p>`;
  const reihen = Array.isArray(antwort.data) ? antwort.data : [];
  if (!reihen.length) return `<h2>${titel}</h2><p class="klein">noch nichts</p>`;
  const zeilen = reihen.map((r) => {
    const k = r[feld] === '' || r[feld] == null ? 'direkt aufgerufen' : r[feld];
    return `<tr><td>${schuetz(k)}</td><td class="n">${r.visitors ?? '–'} <span class="lb">(${r.pageviews ?? '–'} Aufrufe)</span></td></tr>`;
  }).join('');
  return `<h2>${titel}</h2><table>${zeilen}</table>${fussnote ? `<p class="klein">${fussnote}</p>` : ''}`;
}

export default async function handler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const fehler = pruefeAnmeldung(req);
  if (fehler === 'nicht eingerichtet') {
    res.status(503).send('DASH_USER und DASH_PASS fehlen.');
    return;
  }
  if (fehler) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Mantrify"');
    res.status(401).send('Anmeldung nötig.');
    return;
  }

  const reihe = ((req.query && req.query.reihe) || REIHE).replace(/[^a-z0-9]/gi, '');
  let pfade = [], blobFehler = null;
  try {
    pfade = await allePfade(reihe);
  } catch (e) {
    blobFehler = String(e && e.message || e);
  }
  const abTag = (req.query && req.query.ab) || AB_TAG || null;
  const { z, wege, wen, mantras, tage, betraege, median, diesenMonat,
          ansichten, quellen } = auswerten(pfade, abTag);
  const rw = await reichweite();

  const besucher = rw.gesamt && !rw.gesamt.fehler && rw.gesamt.data
    ? rw.gesamt.data.visitors : null;
  const seitenaufrufe = rw.gesamt && !rw.gesamt.fehler && rw.gesamt.data
    ? rw.gesamt.data.pageviews : null;

  /* Jede Stufe des Trichters zaehlt einmal je Sitzung, also kann keine Quote
     ueber hundert liegen. Passiert es doch, stimmt die Zaehlweise nicht mehr
     ueberein, und dann soll man das sehen und nicht die Zahl glauben.
     Am 12.08.2026 stand hier 133,3 %, und genau das war der Fehler. */
  let unstimmig = false;
  const quote = (a, b) => {
    if (!b) return '–';
    const q = 100 * a / b;
    const s = q.toFixed(1).replace('.', ',') + ' %';
    if (q > 100) { unstimmig = true; return `<span class="warn">${s} &#9888;</span>`; }
    return s;
  };
  const genug = z.dreh >= ZIEL_DREHER;
  const teilrate = z.dreh ? z.teilen / z.dreh : 0;
  const verbrauch = diesenMonat + Math.ceil(pfade.length / 1000);
  const verbrauchAnteil = verbrauch / FREI_OPERATIONEN;

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mantrify · Zahlen</title>
<style>
:root{--bg:#0D0D0D;--fl:#161514;--tx:#F5F2ED;--mu:#9C9489;--lb:#8A8078;--ak:#D4652E;--bd:#6B645E}
*{box-sizing:border-box}
body{margin:0;padding:2rem 1.2rem 4rem;background:var(--bg);color:var(--tx);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6}
main{max-width:44rem;margin:0 auto}
h1{font-size:1.5rem;margin:0 0 .3rem}
h2{font-size:1rem;color:var(--lb);text-transform:uppercase;letter-spacing:.12em;
  margin:2.4rem 0 .6rem;font-weight:500}
.stand{color:var(--mu);margin:0 0 2rem;font-size:.9rem}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
td{padding:.55rem .2rem;border-bottom:1px solid #241f1c}
td.n{text-align:right;font-weight:600}
.lb{color:var(--lb);font-weight:400}
.gross{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:.8rem;margin:.4rem 0 0}
.kachel{background:var(--fl);border:1px solid #241f1c;border-radius:12px;padding:1rem}
.kachel .w{font-size:1.9rem;font-weight:600;line-height:1.1}
.kachel .b{color:var(--lb);font-size:.8rem;text-transform:uppercase;letter-spacing:.1em}
.kachel .z{color:var(--mu);font-size:.8rem}
.schwelle{border-left:3px solid var(--ak);padding:.9rem 1rem;background:var(--fl);
  border-radius:0 12px 12px 0;margin:.6rem 0}
.schwelle b{color:var(--tx)}
.warn{color:var(--ak)}
.klein{color:var(--lb);font-size:.85rem;margin:.4rem 0 0}
.fuss{color:var(--lb);font-size:.85rem;margin-top:3rem}
.balken{height:6px;background:#241f1c;border-radius:3px;overflow:hidden;margin:.5rem 0 0}
.balken i{display:block;height:100%;background:var(--ak)}
</style></head><body><main>
<h1>Mantrify · Zahlen</h1>
<p class="stand">Stand ${new Date().toLocaleString('de-DE')}${abTag ? ` · gezählt ab ${abTag}` : ''}${reihe !== REIHE ? ` · Messreihe ${schuetz(reihe)}` : ''}${blobFehler ? ` · <span class="warn">Speicher nicht lesbar: ${schuetz(blobFehler)}</span>` : ''}</p>

<div class="gross">
  <div class="kachel"><div class="w">${besucher ?? z.aufruf}</div>
    <div class="b">${besucher != null ? 'Besucher' : 'Aufrufe'}</div>
    <div class="z">${besucher != null ? `${seitenaufrufe} Aufrufe` : 'ohne Analytics gezählt'}</div></div>
  <div class="kachel"><div class="w">${z.dreh}</div><div class="b">benutzen den Würfel</div>
    <div class="z">${besucher ? quote(z.dreh, besucher) + ' der Besucher' : quote(z.dreh, z.aufruf) + ' der Aufrufe'}</div></div>
  <div class="kachel"><div class="w">${z.teilen}</div><div class="b">teilen ihn</div>
    <div class="z">${quote(z.teilen, z.dreh)} derer, die drehen</div></div>
  <div class="kachel"><div class="w">${median === null ? '–' : median + ' €'}</div><div class="b">Median Preis</div>
    <div class="z">aus ${betraege.length} Angaben</div></div>
</div>

<h2>Die beiden Schwellen</h2>
<div class="schwelle">
  <b>Mindestmenge:</b> ${z.dreh} von ${ZIEL_DREHER} Drehern
  ${genug ? '· erreicht' : '· <span class="warn">noch nicht erreicht, es wird nicht ausgewertet</span>'}
</div>
<div class="schwelle">
  <b>Teilen:</b> ${quote(z.teilen, z.dreh)} der Dreher geben weiter, nötig sind ${(ZIEL_TEILRATE * 100)} %
  ${genug ? (teilrate >= ZIEL_TEILRATE ? '· gestützt' : '· nicht gestützt') : ''}
</div>
<div class="schwelle">
  <b>Zahlungsbereitschaft:</b> Median ${median === null ? '–' : median + ' €'} aus ${betraege.length} Angaben, nötig sind ${ZIEL_MEDIAN} €
  ${genug && median !== null ? (median >= ZIEL_MEDIAN ? '· gestützt' : '· nicht gestützt') : ''}
</div>

<h2>Der Weg durch die Seite</h2>
<table>
  <tr><td>Sitzungen</td><td class="n">${z.aufruf}</td></tr>
  <tr><td>gedreht</td><td class="n">${z.dreh} <span class="lb">(${quote(z.dreh, z.aufruf)})</span></td></tr>
  <tr><td>Teilen-Fenster geöffnet</td><td class="n">${z.teilen_auf} <span class="lb">(${quote(z.teilen_auf, z.dreh)})</span></td></tr>
  <tr><td>wirklich geteilt</td><td class="n">${z.teilen} <span class="lb">(${quote(z.teilen, z.teilen_auf)} der Geöffneten)</span></td></tr>
  <tr><td>Preisfrage geöffnet</td><td class="n">${z.kauf_auf} <span class="lb">(${quote(z.kauf_auf, z.dreh)})</span></td></tr>
  <tr><td>Betrag genannt</td><td class="n">${z.preis} <span class="lb">(${quote(z.preis, z.kauf_auf)})</span></td></tr>
  <tr><td>„würde ich nicht kaufen"</td><td class="n">${z.kein_kauf} <span class="lb">(${quote(z.kein_kauf, z.kauf_auf)})</span></td></tr>
</table>
<p class="klein">Jede Stufe zählt <b>einmal je Sitzung</b>. Wer dreimal teilt, steht hier
einmal. Deshalb beantwortet jede Zeile dieselbe Frage, und die Quoten sind
vergleichbar. Eine Sitzung ist ein Aufruf der Seite, keine Person: Wer das Telefon
und den Rechner benutzt, zählt zweimal.
${unstimmig ? '<br><span class="warn">Achtung: Oben steht eine Quote über hundert Prozent. Das kann in einem Trichter nicht sein und heisst, dass zwei Stufen unterschiedlich zählen.</span>' : ''}</p>

<h2>Preis, im Einzelnen</h2>
<table>
  <tr><td>Median</td><td class="n">${median === null ? '–' : median + ' €'}</td></tr>
  <tr><td>Spanne</td><td class="n">${betraege.length ? betraege[0] + ' bis ' + betraege[betraege.length - 1] + ' €' : '–'}</td></tr>
  <tr><td>Angaben</td><td class="n">${betraege.length}</td></tr>
  <tr><td>„würde ich nicht kaufen"</td><td class="n">${z.kein_kauf}</td></tr>
</table>
${tabelle('Für wen', wen)}
<p class="klein">Alle genannten Beträge: ${betraege.length ? schuetz(betraege.join(' · ')) + ' €' : 'noch keine'}</p>

${tabelle('Wie der Aufruf zustande kam', ansichten,
  'geteilt heisst: über einen weitergegebenen Link gekommen, erkannt am Fragment #g. '
  + 'Alles andere ist direkt. Vor dem 22.08.2026 wurde das gezählt, aber nicht angezeigt.')}
${tabelle('Woher die Aufrufe kommen', quellen,
  'Grobe Klasse aus dem Referrer. Apps schicken oft keinen, deshalb ist „direkt“ '
  + 'immer zu groß; es enthält auch WhatsApp und alles, was seine Herkunft verschweigt.')}
${tabelle('Wie geteilt wird', wege)}
${tabelle('Welcher Würfel geteilt wird', mantras)}

<h2>Reichweite (Vercel Analytics)</h2>
${rw.gesamt && rw.gesamt.fehler
  ? `<p class="klein warn">nicht abrufbar: ${schuetz(rw.gesamt.fehler)}</p>`
  : besucher == null
    ? '<p class="klein">Kein VERCEL_TOKEN gesetzt, deshalb bleibt dieser Teil leer. Alles andere funktioniert trotzdem.</p>'
    : `<table>
        <tr><td>Besucher</td><td class="n">${besucher}</td></tr>
        <tr><td>Seitenaufrufe</td><td class="n">${seitenaufrufe}</td></tr>
        <tr><td>Aufrufe je Besucher</td><td class="n">${besucher ? (seitenaufrufe / besucher).toFixed(2).replace('.', ',') : '–'}</td></tr>
      </table>
      <p class="klein">Diese Zahlen zählen anders als unsere eigenen: Analytics erkennt einen
      Besucher innerhalb eines Tages wieder, wir nicht. Quoten, die beide Quellen mischen,
      sind Näherungen.</p>`}
${analyseTabelle('Woher sie kommen', rw.herkunft, 'referrerHostname', 'Letzte 30 Tage. Hier wird sichtbar, ob ein Beitrag wirklich trägt.')}
${analyseTabelle('Womit sie kommen', rw.geraet, 'deviceType', 'Letzte 30 Tage.')}

${tabelle('Ereignisse je Tag (eigene Zählung)', tage)}

<h2>Betrieb</h2>
<div class="schwelle">
  <b>Speicher-Operationen diesen Monat:</b> ${verbrauch} von ${FREI_OPERATIONEN}
  ${verbrauchAnteil > 0.7 ? '· <span class="warn">wird knapp, bei Überschreitung sperrt Vercel den Speicher für 30 Tage</span>' : '· unkritisch'}
  <div class="balken"><i style="width:${Math.min(100, Math.round(verbrauchAnteil * 100))}%"></i></div>
</div>
<p class="klein">Jedes Ereignis kostet eine Operation, jeder Aufruf dieses Dashboards eine
weitere je angefangene tausend gespeicherte Ereignisse. Grob: etwa fünf Operationen je
Besucher, also reicht der Freibetrag für rund zweitausend Besucher im Monat.</p>

<p class="fuss">Unsere eigene Zählung kennt keine Kennungen, keine Cookies, keine
IP-Adressen. Zwei Aufrufe derselben Person zählen dort als zwei Aufrufe. „Besucher"
kommt deshalb aus Vercel Analytics, „gedreht", „geteilt" und der Preis aus unserer
eigenen Zählung.</p>
</main></body></html>`);
}
