# HC Erlangen Fan Progressive Web App

Eine installierbare Fan-App für den HC Erlangen mit Countdown zum nächsten
Spiel, aktuellen Vereinsnews und einem vollständigen Spielplan inklusive
Kalender-Export (.ics) für jede Partie.

## Funktionsumfang

- **Countdown** zum nächsten Pflichtspiel mit Live-Aktualisierung im Sekundentakt.
- **Spielplan mit Live-Daten** der LIQUI MOLY HBL (OpenLigaDB) inklusive Filter
  für Heim- und Auswärtsspiele.
- **Kalender-Dateien (.ics)** für jedes Spiel – ideal zum Import in Android-,
  iOS- oder Desktop-Kalender.
- **News-Übersicht** mit den neuesten Vereinsmeldungen direkt aus der
  WordPress-REST-API des HC Erlangen.
- **PWA-Unterstützung** (Service Worker, Manifest, App-Installationsaufforderung)
  für Android ab One UI 7 / Android 15 sowie Desktop-Browser.
- **Offline-Betrieb** dank Cache für das App-Shell und lokaler Zwischenspeicherung
  der zuletzt erfolgreich geladenen Daten.

## Projektstruktur

```
.
├── assets/
│   └── icons/
│       └── icon.svg       # PWA-App-Icon
├── index.html             # Einstiegsseite der App
├── main.js                # Logik für Countdown, Rendering und ICS-Export
├── manifest.webmanifest   # PWA-Manifest
├── service-worker.js      # Cache-Strategie für Offline-Modus
└── styles.css             # Oberflächenlayout
```

## Lokale Entwicklung

Es wird kein Build-Tool benötigt. Ein beliebiger statischer Webserver genügt.

```bash
# Variante mit Python (ab 3.8)
python -m http.server 4173

# oder mit Node.js
npx serve
```

Die App ist danach unter `http://localhost:4173` bzw. unter der von Ihrem
Server ausgegebenen Adresse erreichbar.

### Datenbezug

- **Spielplan:** wird beim Laden der App automatisch über die
  [OpenLigaDB-API](https://www.openligadb.de/) (Endpoint `getmatchdata/liquimoly-hbl/<Saison>`) bezogen.
  Es werden mehrere Saisons abgefragt, um Vor- und Nachbereitungsphasen
  abzudecken.
- **News:** stammen direkt aus der WordPress-REST-API des Vereins
  (`/wp-json/wp/v2/posts?per_page=12&_embed=1`).
- **Fallback bei CORS-Problemen:** Falls die Primärquelle kein CORS erlaubt,
  wird automatisch ein Proxy über `https://r.jina.ai/` genutzt, ohne dass Demo-
  Daten eingeblendet werden.
- **Zwischenspeicherung:** Bei erfolgreichem Abruf werden Spielplan und News in
  `localStorage` gesichert, damit zuletzt bekannte Informationen auch offline
  sichtbar bleiben. Beim nächsten Online-Besuch werden sie aktualisiert.

## APK aus der PWA erzeugen

Die Anwendung ist als PWA optimiert und kann über moderne Browser direkt auf
Android installiert werden. Wer zusätzlich eine klassische APK veröffentlichen
möchte, kann den von Google empfohlenen Weg über Trusted Web Activity (TWA)
nutzen, z. B. mit [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap):

1. PWA auf einem öffentlich erreichbaren HTTPS-Host bereitstellen.
2. `npm install -g @bubblewrap/cli` (oder via `npx bubblewrap init`).
3. `bubblewrap init` ausführen und dabei die Manifest-URL angeben.
4. Mit `bubblewrap build` ein signierfertiges APK bzw. AAB erzeugen.

So bleibt der PWA-Code maßgeblich erhalten, während die Android-Shell im Play
Store oder als Seitloadbare APK verteilt werden kann.

## Lizenz

Die Inhalte können frei für private Fanprojekte genutzt und angepasst werden.
