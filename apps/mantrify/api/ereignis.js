/**
 * /api/ereignis  ·  Nimmt die Ereignisse der Microsite entgegen.
 *
 * Warum eigenständig und nicht über ein Analysewerkzeug: Vercel Web Analytics
 * kann eigene Ereignisse erst ab dem Pro-Tarif, und wir brauchen den Betrag als
 * Zahl. Diese Funktion kostet nichts und bleibt in unserer Hand.
 *
 * Wie gespeichert wird, und warum so:
 * Jedes Ereignis wird zu einer leeren Datei, deren PFAD die Information trägt:
 *
 *     e/2026-08-12/preis/betrag-64/17a3f9.txt
 *
 * Das sieht ungewöhnlich aus, hat aber einen handfesten Grund. Zum Auswerten
 * genügt dann das Auflisten der Pfade; es muss keine einzige Datei geöffnet
 * werden. Ein Dashboard über tausend Ereignisse lädt so in unter einer Sekunde
 * und verursacht einen einzigen Lesevorgang statt tausend. Ausserdem gibt es
 * keine Wettläufe zwischen gleichzeitigen Aufrufen, wie sie entstünden, wenn
 * alle an dieselbe Datei anhängen wollten.
 *
 * Datenschutz ist hier kein Nachgedanke, sondern die Bauvorschrift:
 * - Es wird KEINE IP-Adresse gespeichert, auch nicht gekürzt, auch nicht
 *   gehasht. Der Request bringt sie mit, wir schreiben sie nicht auf.
 * - Es gibt keine Kennung, kein Cookie, keine Wiedererkennung. Zwei Aufrufe
 *   derselben Person sind für uns zwei Aufrufe, nicht eine Person.
 * - Gespeichert wird ausschliesslich, was in der Liste unten steht. Alles
 *   andere wird verworfen, auch wenn es mitgeschickt wird.
 *
 * Einrichtung (einmalig, im Vercel-Dashboard):
 *   Storage → Blob-Store anlegen und mit dem Projekt verbinden. Vercel setzt
 *   dabei BLOB_READ_WRITE_TOKEN selbst. Mehr ist nicht nötig.
 */
import { put } from '@vercel/blob';

/** Was gezählt werden darf. Alles andere wird abgewiesen. */
const ERLAUBT = {
  aufruf:     ['ansicht'],
  dreh:       [],
  teilen_auf: [],
  teilen:     ['weg', 'mantra'],
  kauf_auf:   [],
  preis:      ['betrag'],
  fuer:       ['wen'],
  kein_kauf:  [],
};

const SAUBER = /^[a-z0-9_-]{1,24}$/i;

function detail(name, daten) {
  const felder = ERLAUBT[name];
  const teile = [];
  for (const f of felder) {
    let v = daten[f];
    if (v === undefined || v === null) continue;
    if (f === 'betrag') {
      v = Math.round(Number(v));
      if (!Number.isFinite(v) || v < 0 || v > 999) continue;
    } else {
      v = String(v);
      if (!SAUBER.test(v)) continue;
    }
    teile.push(`${f}-${v}`);
  }
  return teile.length ? teile.join('_') : 'ohne';
}

export default async function handler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'POST') {
    res.status(405).json({ fehler: 'nur POST' });
    return;
  }
  try {
    let körper = req.body;
    if (typeof körper === 'string') körper = JSON.parse(körper);
    if (!körper || typeof körper !== 'object') throw new Error('kein Objekt');

    const name = String(körper.e || '');
    if (!Object.prototype.hasOwnProperty.call(ERLAUBT, name)) {
      // Unbekannte Ereignisse werden still verworfen. Ein Fehlercode würde nur
      // verraten, welche Namen es gibt.
      res.status(204).end();
      return;
    }

    const heute = new Date().toISOString().slice(0, 10);
    const zufall = Math.random().toString(36).slice(2, 10);
    const pfad = `e/${heute}/${name}/${detail(name, körper)}/${zufall}.txt`;

    // Der Inhalt ist ein Puffer mit null Bytes und nicht der leere String:
    // das SDK weist '' mit "body is required" ab, ein leerer Puffer geht durch.
    // Die Datei bleibt dabei tatsaechlich leer, die Information steckt im Pfad.
    await put(pfad, Buffer.alloc(0), {
      access: 'private',         // der Store ist privat; lesen darf nur, wer das Token hat
                                 // (der Inhalt ist ohnehin leer, die Information steckt im Pfad)
      addRandomSuffix: false,
      contentType: 'text/plain',
    });
    res.status(204).end();
  } catch (e) {
    // Auch im Fehlerfall nichts preisgeben und vor allem die Seite nicht stören.
    res.status(204).end();
  }
}
