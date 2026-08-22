#!/usr/bin/env python3
"""Gesundheitscheck fuer apps/mantrify/index.html.

Aufruf aus dem Wurzelverzeichnis des Repos:
    python3 werkzeuge/mantrify-pruef.py            # prueft die Datei im Repo
    python3 werkzeuge/mantrify-pruef.py --live     # prueft zusaetzlich mantrify.antipol.ai

Liegt bewusst NICHT in apps/mantrify: Dieser Ordner ist die Wurzel des Vercel-
Projekts, alles darin wird mit ausgeliefert. Ein Pruefskript unter
mantrify.antipol.ai/pruef.py waere kein Schaden, aber auch kein Zustand.

Was hier steht, sind Zusicherungen, die schon einmal gebrochen waren, plus die
Regeln, die nie brechen duerfen. Das Skript ersetzt nicht das Draufschauen; es
sichert nur das ab, was wir bereits einmal repariert haben.

Braucht playwright mit Chromium. Ohne playwright laufen nur die Textpruefungen.
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys
from urllib.parse import unquote

HIER = pathlib.Path(__file__).resolve().parent.parent / 'apps/mantrify'
DATEI = HIER / 'index.html'
LIVE = 'https://mantrify.antipol.ai/'

fehler, warnung, ok = [], [], []


def pruefe(bedingung, satz, hart=True):
    if bedingung:
        ok.append(satz)
    elif hart:
        fehler.append(satz)
    else:
        warnung.append(satz)


# =====================================================================
# 1 · Textpruefungen an der Datei
# =====================================================================
roh = DATEI.read_text(encoding='utf-8')
# Kommentare erklaeren die Geschichte und duerfen alte Begriffe nennen.
# Geprueft wird, was ausgefuehrt wird.
code = re.sub(r'/\*.*?\*/', '', re.sub(r'<!--.*?-->', '', roh, flags=re.S), flags=re.S)

# --- Die Steuernummer gehoert ausschliesslich ins private Repo; dieses hier ist
#     oeffentlich. Geprueft wird die FORM, nicht der Wert: Wer die Nummer hier
#     als Vergleichstext hinschreibt, hat sie damit selbst veroeffentlicht. Das
#     Muster trifft jede Nummer im Format 0000/000/00000.
pruefe(re.search(r'\b\d{4}/\d{3}/\d{5}\b', roh) is None,
       'keine Steuernummer in der Datei')

# --- Was der Umbau vom 22.08.2026 entfernt hat
for weg in ['teilenFrage', 'shareText', 'EINLEITUNG', 'vsSatz',
            'vsAv', 'vsZitat', '"vsH"', '"vsB"', 'vsFuss', 'vs-karte', 'sheet-wer',
            'shWa', 'wa.me',
            'class="reiter"', '.switch button', 'backlink',
            'Erst drehen, dann teilen', 'Musste ich an dich denken',
            'Mantra teilen', '}, 8000)', 'vorschau.jpg', 'vorschau-mantra',
            'bilder/produkt']:
    pruefe(weg not in code, f'entfernt: {weg}')

# --- Was da sein muss
for da, anzahl in [('id="dreiklang"', 1), ('id="dkWuerfel"', 1), ('class="ap-marke"', 1),
                   ('id="zurueckTrigger"', 1), ('Mantrify empfehlen', 1), ('teilenText', 0),
                   ('Tipp an, was heute war.', 1), ('vorschau-3klang.jpg', 2),
                   ('class="chev"', 9), ('Trigger wählen. Mantra drehen. Ärger loslassen.', 2),
                   ('}, 7000)', 1)]:
    ist = code.count(da)
    pruefe(ist == anzahl, f'{da}: {ist} von {anzahl}')

# --- Die Herkunftsmarke und die Herkunftsklasse. Ohne #g zaehlt jeder Besuch
#     aus einer Empfehlung als Direktaufruf, und ohne von= ist "direkt" ein
#     Sammelbecken aus Lesezeichen, Suche und sozialen Netzen.
pruefe('location.origin + "/#g"' in code, 'die geteilte Adresse traegt #g')
pruefe('von: herkunft()' in code, 'das Aufruf-Ereignis nennt die Herkunft')
for klasse in ['"direkt"', '"suche"', '"social"', '"intern"', '"sonstige"']:
    pruefe(klasse in code, f'Herkunftsklasse {klasse} ist vorgesehen')
# "Bild sichern" ist seit dem 22.08.2026 wieder erlaubt, aber nur als die
# Beschriftung fuer Geraete, die keine Dateien teilen koennen. Als feste
# Beschriftung im Markup waere es der alte Fehler.
pruefe('>Bild sichern<' not in code, 'Bild sichern steht nicht fest im Markup')

# --- Genau eine Spalte, keine ueberschreibende Regel am Blattende
pruefe(code.count('grid-template-columns:1fr}') >= 1 and 'grid-template-columns:1fr 1fr;gap:.55rem' not in code,
       'Triggerraster ist einspaltig, ohne Gegenregel')
pruefe('#aussen .grid' not in code and '#innen .teilen{margin-top' not in code,
       'keine nachtraeglichen Ueberschreibungen mit hoeherer Spezifitaet')

# --- Jedes Bild, das im HTML steht, muss es geben UND ausgeliefert werden.
#     Am 22.08.2026 lag vorschau-3klang.jpg im Ordner, wurde aber vom Build-Skript
#     nicht nach dist kopiert; og:image haette live ins Leere gezeigt. "Datei ist
#     da" ist deshalb nicht genug, das Build-Skript muss sie auch mitnehmen.
bau = json.loads((HIER / 'package.json').read_text(encoding='utf-8'))['scripts']['build']
for bild in sorted(set(re.findall(r'https://mantrify\.antipol\.ai/([\w.-]+\.(?:jpg|png|webp|svg))', roh))):
    pruefe((HIER / bild).exists(), f'{bild} liegt im Ordner')
    pruefe(bild in bau, f'{bild} wird vom Build-Skript ausgeliefert')

# --- Was das Build-Skript kopiert, muss es auch geben
for stueck in bau.split():
    if '.' in stueck and '/' not in stueck and not stueck.startswith('-'):
        pruefe((HIER / stueck).exists(), f'Build kopiert {stueck}, und die Datei ist da')

# --- Die Beschreibungszeile im Teilen-Fenster muss der og:description entsprechen.
#     Die beiden Stellen kennen einander nicht; wer eine aendert, vergisst leicht
#     die andere, und dann zeigt die Vorschau etwas anderes als der Empfaenger sieht.
_og = re.search(r'<meta property="og:description" content="([^"]+)"', roh).group(1)
pruefe(_og.startswith('Trigger wählen. Mantra drehen. Ärger loslassen.'),
       f'og:description traegt den Dreiklang ({_og[:60]})')

# --- Die Knoepfe heissen nach dem, was hinausgeht. Ein Knopf, der "senden"
#     sagt und in den Download-Ordner legt, ist dasselbe Versprechen wie
#     "Bild sichern" es war, nur andersherum.
pruefe('>Link weiterschicken<' in code, 'System-Teilen heisst Link weiterschicken')
pruefe('>Link kopieren<' in code, 'Kopieren heisst Link kopieren')
pruefe('"Mantra als Bild senden" : "Mantra als Bild sichern"' in code,
       'der Bild-Knopf beschriftet sich nach dem, was das Geraet kann')

# --- Die Herkunftsklassen mit Beispielen durchspielen. Geprueft wird der
#     ausgelieferte Quelltext selbst: Die Funktion wird aus dem HTML geschnitten
#     und mit gestelltem document.referrer unter node ausgefuehrt. Ein Regex,
#     der google.de trifft und googleblog.com mitnimmt, faellt sonst niemandem auf.
_FAELLE = [('', 'direkt'), ('https://www.google.de/search?q=mantrify', 'suche'),
           ('https://news.google.com/x', 'suche'), ('https://googleblog.com/x', 'sonstige'),
           ('https://duckduckgo.com/', 'suche'), ('https://www.linkedin.com/feed/', 'social'),
           ('https://x.com/i/web', 'social'), ('https://t.co/abc', 'social'),
           ('https://flux.com/', 'sonstige'), ('https://mantrify.antipol.ai/', 'intern'),
           ('https://irgendwas.de/blog', 'sonstige'), ('kaputt', 'sonstige')]
_fn = re.search(r'  function herkunft\(\)\{.*?\n  \}', roh, re.S)
pruefe(_fn is not None, 'herkunft() steht im Blatt')
if _fn:
    _h = pathlib.Path('/tmp/mantrify_herkunft.js')
    _h.write_text("var document={referrer:''}, location={hostname:'mantrify.antipol.ai'};\n"
                  + _fn.group(0) + "\nvar f=" + json.dumps(_FAELLE) + ";var s=[];"
                  + "f.forEach(function(x){document.referrer=x[0];var i=herkunft();"
                  + "if(i!==x[1])s.push(x[0]+' -> '+i+', erwartet '+x[1]);});"
                  + "console.log(s.join(' | '));", encoding='utf-8')
    try:
        _r = subprocess.run(['node', str(_h)], capture_output=True, text=True)
        pruefe(_r.returncode == 0 and not _r.stdout.strip(),
               f'Herkunft ordnet alle Beispiele richtig ein ({_r.stdout.strip() or _r.stderr.strip()[:120]})')
    except FileNotFoundError:
        warnung.append('node fehlt, Herkunftspruefung uebersprungen')

# --- Der Weg eines Messfeldes geht ueber drei Dateien: index.html schickt es,
#     api/ereignis.js laesst es durch (alles nicht Gelistete wird verworfen) und
#     api/zahlen.js zeigt es an. Faellt eine Stelle aus, wird gemessen und nicht
#     hingesehen; genau das war mit "ansicht" seit dem 13.08.2026 der Fall.
_ere = (HIER / 'api/ereignis.js').read_text(encoding='utf-8')
_zah = (HIER / 'api/zahlen.js').read_text(encoding='utf-8')
pruefe("aufruf:     ['ansicht', 'von']" in _ere, 'ereignis.js laesst ansicht und von durch')
for feld, zaehler in [('ansicht', 'ansichten'), ('von', 'quellen')]:
    pruefe(f"feld === '{feld}'" in _zah, f'zahlen.js zaehlt {feld}')
    pruefe(f'tabelle(' in _zah and zaehler in _zah, f'zahlen.js zeigt {zaehler} an')

# --- Verschachtelte Blockkommentare zerlegen das Skript still
skripte = re.findall(r'<script>(.*?)</script>', roh, re.S)
pruefe(len(skripte) == 1, f'genau ein eigenes Skript im Blatt (gefunden: {len(skripte)})')
for i, sk in enumerate(skripte):
    pruefe('/*' not in sk.replace('/*', '\x00', 1).split('*/', 1)[0].replace('\x00', ''),
           f'Skript {i}: kein verschachtelter Kommentar am Anfang', hart=False)

# --- Syntaxpruefung, wenn node da ist
try:
    for i, sk in enumerate(skripte):
        p = pathlib.Path(f'/tmp/mantrify_skript_{i}.js')
        p.write_text(sk, encoding='utf-8')
        r = subprocess.run(['node', '--check', str(p)], capture_output=True, text=True)
        pruefe(r.returncode == 0, f'Skript {i} ist syntaktisch gueltig'
                                  + ('' if r.returncode == 0 else ': ' + r.stderr.strip()[:200]))
except FileNotFoundError:
    warnung.append('node fehlt, Syntaxpruefung uebersprungen')

# =====================================================================
# 2 · Pruefungen im Browser
# =====================================================================
def im_browser(url, marke, breite=390, sollLuecke=41.6):
    from playwright.sync_api import sync_playwright
    js_fehler = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        seite = b.new_page(viewport={'width': breite, 'height': 900})
        seite.on('pageerror', lambda e: js_fehler.append(str(e)[:200]))
        seite.goto(url, wait_until='load')
        seite.wait_for_timeout(1500)

        # --- Triggeransicht
        z = seite.evaluate("""() => ({
          reiter: !!document.querySelector('.reiter, .switch'),
          absender: (document.querySelector('.ap-marke')||{}).textContent,
          h1: (document.querySelector('#aussen h1')||{}).textContent,
          dreiklang: !!document.getElementById('dreiklang'),
          worte: Array.from(document.querySelectorAll('.dk-txt')).map(e=>e.textContent),
          spalten: getComputedStyle(document.querySelector('#aussen .grid')).gridTemplateColumns,
          winkel: document.querySelectorAll('#aussen .tile .chev').length,
          kacheln: document.querySelectorAll('#aussen .tile').length
        })""")
        pruefe(not z['reiter'], f'{marke}: keine Reiter mehr im Kopf')
        pruefe(z['absender'] == 'ANTIPOL', f'{marke}: Absender steht im Kopf ({z["absender"]})')
        pruefe(z['h1'] == 'Tipp an, was heute war.', f'{marke}: Aufforderung statt Frage')
        pruefe(z['dreiklang'], f'{marke}: Dreiklang steht ueber den Triggern')
        pruefe(z['worte'] == ['Trigger wählen', 'Mantra drehen', 'Ärger loslassen'],
               f'{marke}: Dreiklang nennt die drei Schritte ({z["worte"]})')
        pruefe(len(z['spalten'].split()) == 1, f'{marke}: Trigger einspaltig ({z["spalten"]})')
        pruefe(z['winkel'] == z['kacheln'], f'{marke}: jede Kachel hat einen Winkel '
                                            f'({z["winkel"]} von {z["kacheln"]})')

        # --- Bewegung ist nach 4,4 s durch und hinterlaesst die Ruhestellung
        seite.wait_for_timeout(4200)
        pruefe(seite.evaluate("() => document.getElementById('dreiklang').classList.contains('dk-los')"),
               f'{marke}: Bewegung ist gelaufen')

        # --- Wuerfelansicht, gesperrter Zustand
        seite.locator('#aussen .tile').first.click()
        seite.wait_for_timeout(800)
        gesperrt = seite.evaluate("""() => {
          const c=document.querySelector('#innen .cube').getBoundingClientRect();
          const b=document.getElementById('btnShare');
          return {luecke:+(b.getBoundingClientRect().top-c.bottom).toFixed(1),
                  text:b.textContent.trim(), dis:b.disabled,
                  zurueck: !!document.getElementById('zurueckTrigger')};
        }""")
        pruefe(gesperrt['text'] == 'Mantrify empfehlen', f'{marke}: Knopf heisst Mantrify empfehlen')
        pruefe(gesperrt['dis'], f'{marke}: Knopf ist vor dem Drehen gesperrt')
        pruefe(gesperrt['zurueck'], f'{marke}: Zurueck-Weg steht unter dem Knopf')

        # --- Von Hand drehen, bis eine Stimme vorn steht
        k = seite.locator('#stage').bounding_box()
        mx, my = k['x'] + k['width'] / 2, k['y'] + k['height'] / 2
        for _ in range(6):
            seite.mouse.move(mx, my); seite.mouse.down()
            for i in range(1, 16):
                seite.mouse.move(mx + i * 11, my + i * 2); seite.wait_for_timeout(18)
            seite.mouse.up(); seite.wait_for_timeout(1100)
            if not seite.evaluate("() => document.getElementById('btnShare').disabled"):
                break
        offen = seite.evaluate("""() => {
          const c=document.querySelector('#innen .cube').getBoundingClientRect();
          const b=document.getElementById('btnShare');
          return {luecke:+(b.getBoundingClientRect().top-c.bottom).toFixed(1), dis:b.disabled};
        }""")
        pruefe(not offen['dis'], f'{marke}: Knopf gibt nach dem Drehen frei')
        pruefe(abs(offen['luecke'] - gesperrt['luecke']) < 0.5,
               f'{marke}: Knopf springt nicht ({gesperrt["luecke"]} vs {offen["luecke"]})')
        pruefe(abs(gesperrt['luecke'] - sollLuecke) < 1.5,
               f'{marke}: Abstand ist der alte, {sollLuecke}px bei {breite}px '
               f'({gesperrt["luecke"]})')

        # --- Teilen
        seite.locator('#btnShare').click()
        seite.wait_for_timeout(900)
        blatt = seite.evaluate("""() => ({
          vorschau: !!document.querySelector('#sheet .vs, #sheet .vs-karte'),
          knoepfe: Array.from(document.querySelectorAll('#sheet button'))
                        .filter(b => !b.hidden && getComputedStyle(b).display !== 'none')
                        .map(b => b.textContent.trim())
        })""")
        pruefe(not blatt['vorschau'], f'{marke}: keine Vorschaukarte mehr im Blatt')
        pruefe('WhatsApp' not in ' '.join(blatt['knoepfe']),
               f'{marke}: kein WhatsApp-Knopf ({blatt["knoepfe"]})')
        # Ohne System-Teilen bleiben Kopieren, Bild und Schliessen. Mit
        # System-Teilen kommt "Link weiterschicken" davor.
        pruefe(blatt['knoepfe'][-1] == 'Schliessen' and 'Link kopieren' in blatt['knoepfe']
               and any(k.startswith('Mantra als Bild') for k in blatt['knoepfe']),
               f'{marke}: das Blatt zeigt genau die vorgesehenen Knoepfe ({blatt["knoepfe"]})')

        # --- Die Adresse, die wirklich hinausgeht. teilenURL() steckt in einer
        #     IIFE und ist von aussen nicht aufrufbar; deshalb wird window.open
        #     abgefangen und der WhatsApp-Knopf gedrueckt. Geprueft wird der Weg,
        #     den ein Mensch nimmt, und nicht eine Funktion, die ich mir denke.
        raus = seite.evaluate("""() => new Promise(r => {
          Object.defineProperty(navigator, 'clipboard',
            {value: {writeText: (s) => { r(s); return Promise.resolve(); }}, configurable: true});
          document.getElementById('shCopy').click();
          setTimeout(() => r('KEIN AUFRUF'), 2000);
        })""")
        adresse = raus
        pruefe(adresse.endswith('/#g'),
               f'{marke}: die geteilte Adresse traegt die Herkunftsmarke #g ({adresse})')
        pruefe('/m/' not in adresse,
               f'{marke}: geteilt wird die Startseite, nicht das fremde Mantra ({adresse})')
        pruefe('\n' not in adresse,
               f'{marke}: kein vorgegebener Text vor der Adresse ({adresse!r})')
        seite.wait_for_timeout(400)

        # --- Zurueck fuehrt auf die Triggerliste
        seite.evaluate("""() => { const s=document.getElementById('sheet');
          if(s) s.hidden=true; document.body.style.overflow=''; }""")
        seite.wait_for_timeout(300)
        seite.locator('#zurueckTrigger').click()
        seite.wait_for_timeout(700)
        pruefe(seite.evaluate("() => document.getElementById('aussen').classList.contains('on')"),
               f'{marke}: Zurueck fuehrt auf die Triggerliste')

        pruefe(not js_fehler, f'{marke}: keine Skriptfehler ({js_fehler})')
        b.close()


argp = argparse.ArgumentParser()
argp.add_argument('--live', action='store_true', help='zusaetzlich die veroeffentlichte Seite pruefen')
args = argp.parse_args()

try:
    # 41,6 und 49,6 Pixel sind an der Fassung vor dem Umbau gemessen, als der
    # Abstand noch aus der Zeile ueber dem Knopf kam. Sie sind der Massstab
    # dafuer, dass sich am Bild nichts geaendert hat ausser dem Springen.
    im_browser('file://' + str(DATEI), 'Datei 390', 390, 41.6)
    im_browser('file://' + str(DATEI), 'Datei 900', 900, 49.6)
    if args.live:
        im_browser(LIVE, 'Live 390', 390, 41.6)
except ImportError:
    warnung.append('playwright fehlt, Browserpruefungen uebersprungen')

# =====================================================================
print(f'\n{len(ok)} bestanden')
for w in warnung:
    print('  !!  ' + w)
for f in fehler:
    print('  XX  ' + f)
print('\nErgebnis:', 'sauber' if not fehler else f'{len(fehler)} Fehler')
sys.exit(1 if fehler else 0)
