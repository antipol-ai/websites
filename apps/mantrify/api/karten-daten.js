/**
 * Die Sätze und Namen für die Teilen-Vorschau.
 *
 * Erzeugt von werkzeug/machkarten.js zusammen mit den Bildern. Nicht von Hand
 * ändern: Der Satz steht auch IM Bild, beides muss zusammenpassen.
 *
 * Warum als Modul und nicht als JSON-Datei daneben: Ein import wird von Vercel
 * automatisch mit in die Funktion gebündelt. Eine JSON-Datei müsste über
 * includeFiles mitgenommen werden und läge dann an einem Pfad, der von
 * process.cwd() abhängt. Zwei Möglichkeiten zu scheitern, wo eine reicht.
 */
export const KARTEN = {
  "einfluss/s": {"satz": "Ich trenne, was in meinem Einfluss liegt und was nicht.", "wer": "Deine Therapeutin", "name": "Nicht mein Zirkus"},
  "einfluss/guru": {"satz": "Das descope ich. Focus ist am Ende ein Leadership-Thema.", "wer": "Marketing Guru", "name": "Nicht mein Zirkus"},
  "einfluss/i": {"satz": "Ich mache meinen Teil. Wer den Rest liegen lässt, merke ich mir.", "wer": "Bald-Ex-Kollegin", "name": "Nicht mein Zirkus"},
  "einfluss/n": {"satz": "try { saveEverything() } catch (NotMyScope) { letGo() }", "wer": "Code Ninja", "name": "Nicht mein Zirkus"},
  "einfluss/k": {"satz": "Das ist nicht meine Energie. Ich gebe sie liebevoll zurück.", "wer": "Feelgood-Managerin", "name": "Nicht mein Zirkus"},
  "schuld/s": {"satz": "Nicht mein Fehler, und die Folgen trage ich trotzdem.", "wer": "Deine Therapeutin", "name": "Wer hat's verbockt?"},
  "schuld/guru": {"satz": "Nicht mein Bug, aber ich own den Fix. Nennt man Accountability.", "wer": "Marketing Guru", "name": "Wer hat's verbockt?"},
  "schuld/i": {"satz": "Ich kehre die Scherben. Ich weiss auch, wessen Vase das war.", "wer": "Bald-Ex-Kollegin", "name": "Wer hat's verbockt?"},
  "schuld/n": {"satz": "blame(bug) !== me; fix(bug) === me;", "wer": "Code Ninja", "name": "Wer hat's verbockt?"},
  "schuld/k": {"satz": "Ich räume fremdes Karma auf. Immerhin sammle ich gute Punkte.", "wer": "Feelgood-Managerin", "name": "Wer hat's verbockt?"},
  "ernst/s": {"satz": "Ich stehe zu meiner Arbeit, nicht zu den Zuständen.", "wer": "Deine Therapeutin", "name": "Guter Job, kaputter Laden"},
  "ernst/guru": {"satz": "Ich bin all in beim Craft und relaxed beim Noise.", "wer": "Marketing Guru", "name": "Guter Job, kaputter Laden"},
  "ernst/i": {"satz": "Ich liefere Qualität in einem Laden, dem Qualität optional ist.", "wer": "Bald-Ex-Kollegin", "name": "Guter Job, kaputter Laden"},
  "ernst/n": {"satz": "myModule.ok === true; // TODO: check the system", "wer": "Code Ninja", "name": "Guter Job, kaputter Laden"},
  "ernst/k": {"satz": "Meine Arbeit ist Selbstausdruck. Der Rest ist fremde Schwingung.", "wer": "Feelgood-Managerin", "name": "Guter Job, kaputter Laden"},
  "wahl/s": {"satz": "Ich bin hier, weil ich es wähle, nicht weil ich muss.", "wer": "Deine Therapeutin", "name": "Ich bleib freiwillig"},
  "wahl/guru": {"satz": "Ich bin hier by choice, nicht by default.", "wer": "Marketing Guru", "name": "Ich bleib freiwillig"},
  "wahl/i": {"satz": "Ich könnte gehen. Rührend, wie sicher sich alle fühlen.", "wer": "Bald-Ex-Kollegin", "name": "Ich bleib freiwillig"},
  "wahl/n": {"satz": "while (iChoose) { stay(); }", "wer": "Code Ninja", "name": "Ich bleib freiwillig"},
  "wahl/k": {"satz": "Ich bin nicht gefangen, ich bin geführt. Alles hat seinen Grund.", "wer": "Feelgood-Managerin", "name": "Ich bleib freiwillig"},
  "einzige/s": {"satz": "Ich muss nicht der Einzige bleiben, der das kann.", "wer": "Deine Therapeutin", "name": "Kein Held nötig"},
  "einzige/guru": {"satz": "Ich mache mich replaceable. Das ist echtes Enablement.", "wer": "Marketing Guru", "name": "Kein Held nötig"},
  "einzige/i": {"satz": "Angeblich bin ich unersetzlich. Getestet hat es noch keiner.", "wer": "Bald-Ex-Kollegin", "name": "Kein Held nötig"},
  "einzige/n": {"satz": "if (me.gone) { team.runs(); } // by design", "wer": "Code Ninja", "name": "Kein Held nötig"},
  "einzige/k": {"satz": "Ich lasse los und vertraue, dass das Team sich selbst trägt.", "wer": "Feelgood-Managerin", "name": "Kein Held nötig"},
  "traegt/s": {"satz": "Meine Diagnose wirkt erst, wenn jemand sie übernimmt.", "wer": "Deine Therapeutin", "name": "Ich hab geliefert"},
  "traegt/guru": {"satz": "Insight hab ich delivered, Ownership liegt bei euch. Bis EOB.", "wer": "Marketing Guru", "name": "Ich hab geliefert"},
  "traegt/i": {"satz": "Ich liefere die Landkarte. Fahren müsst ihr selbst.", "wer": "Bald-Ex-Kollegin", "name": "Ich hab geliefert"},
  "traegt/n": {"satz": "git push --force; // your merge conflict now", "wer": "Code Ninja", "name": "Ich hab geliefert"},
  "traegt/k": {"satz": "Ich habe meine Wahrheit gesendet. Empfangen muss sie ein anderer.", "wer": "Feelgood-Managerin", "name": "Ich hab geliefert"},
};
