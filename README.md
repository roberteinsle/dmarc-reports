# DMARC Reports

Eine vollautomatisierte Webapp zur Verarbeitung, Analyse und Überwachung von DMARC-Reports mit KI-gestützter Bedrohungserkennung und automatischen Benachrichtigungen.

## Features

- **Automatische E-Mail-Verarbeitung:** Holt DMARC-Reports via IMAP alle 10 Minuten
- **XML-Parsing:** Extrahiert Daten aus GZ/ZIP-komprimierten XML-Anhängen
- **KI-Analyse:** Claude AI analysiert Reports auf Compliance, Bedrohungen und Trends
- **Dashboard:** Visualisierung von KPIs, Bedrohungen und Handlungsempfehlungen
- **Automatische Benachrichtigungen:** E-Mail-Alerts bei kritischen Sicherheitsproblemen
- **SQLite-Datenbank:** Persistente Speicherung aller Reports und Analysen

## Tech Stack

- **Framework:** Next.js 14+ (TypeScript)
- **Datenbank:** SQLite mit Better SQLite3
- **AI:** Claude API (Anthropic SDK)
- **E-Mail:** IMAP für Empfang, Postal API für Versand
- **Scheduler:** Node-Cron
- **Deployment:** Docker

## Installation

### Voraussetzungen

- Node.js 20+
- npm oder yarn
- (Optional) Docker für Container-Deployment

### Lokale Entwicklung

1. **Repository klonen:**
```bash
git clone https://github.com/roberteinsle/dmarc-reports.git
cd dmarc-reports
```

2. **Dependencies installieren:**
```bash
npm install
```

3. **Environment-Variables konfigurieren:**
```bash
cp .env.example .env
```

Bearbeiten Sie `.env` und fügen Sie Ihre Credentials ein:
- IMAP-Zugangsdaten
- Claude API Key
- Postal API Key

4. **Datenbank initialisieren:**
```bash
npm run db:init
```

5. **Development-Server starten:**
```bash
npm run dev
```

Die App ist dann verfügbar unter `http://localhost:3000`

## Verwendung

### Manuelle E-Mail-Verarbeitung

Für Tests können Sie E-Mails manuell abrufen:
```bash
npm run fetch:manual
```

### Automatischer Betrieb

Der Scheduler läuft automatisch wenn die App startet und holt alle 10 Minuten neue DMARC-Reports.

## Deployment

### Docker (Empfohlen)

Das Projekt ist vollständig Docker-ready mit Multi-Stage Build und automatischer Initialisierung.

#### Schnellstart

1. **Environment-Variablen konfigurieren:**
```bash
cp .env.example .env
# .env editieren und Credentials eintragen
```

2. **Container starten:**
```bash
docker-compose up -d --build
```

3. **Logs überwachen:**
```bash
docker-compose logs -f
```

4. **Dashboard öffnen:**
```
http://localhost:3000/dashboard
```

#### Docker-Features

- **Multi-Stage Build:** Optimierte Image-Größe (~150MB)
- **Automatische DB-Initialisierung:** Erstellt Datenbank beim ersten Start
- **Persistente Daten:** Named Volumes für SQLite und Logs
- **Health-Checks:** Automatische Container-Überwachung
- **Security:** Non-Root User (nextjs:1001)
- **Resource Limits:** CPU (1.0) & Memory (512MB)

#### Nützliche Docker-Befehle

```bash
# Container neu bauen und starten
docker-compose up -d --build

# Logs anzeigen (follow mode)
docker-compose logs -f

# Container-Status prüfen
docker-compose ps

# Container stoppen
docker-compose down

# Container stoppen und Daten löschen (VORSICHT!)
docker-compose down -v

# Shell im Container öffnen (Debugging)
docker-compose exec dmarc-reports sh

# Health-Check manuell testen
curl http://localhost:3000/api/health
```

#### Produktions-Deployment

Für den Produktionsbetrieb:

1. `.env` mit Produktions-Credentials erstellen
2. Port-Mapping in `docker-compose.yml` anpassen (z.B. 80:3000)
3. Reverse-Proxy (nginx/traefik) für HTTPS einrichten
4. Backup-Strategie für SQLite-Datenbank implementieren
5. Monitoring aktivieren (Logs + Health-Checks)

**Backup der Datenbank:**
```bash
# Backup erstellen
docker-compose exec dmarc-reports cp /app/data/dmarc.db /app/data/backup-$(date +%Y%m%d).db

# Volume-Backup (extern)
docker run --rm -v dmarc-data:/data -v $(pwd):/backup alpine tar czf /backup/dmarc-backup.tar.gz /data
```

## Projektstruktur

```
dmarc-reports/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API Endpoints
│   │   └── dashboard/         # Dashboard UI
│   ├── components/            # React Komponenten
│   ├── lib/
│   │   ├── db/               # Datenbank Schema & Client
│   │   ├── services/         # Backend Services
│   │   ├── types/            # TypeScript Typen
│   │   └── utils/            # Utilities
│   └── scripts/              # Maintenance Scripts
├── data/                      # SQLite Datenbank (gitignored)
├── .env                       # Environment Variables (gitignored)
├── Dockerfile
└── docker-compose.yml
```

## Sicherheit

- Alle Credentials in `.env` (nicht in Git)
- IMAP-Verbindungen über TLS (Port 993)
- Prepared Statements für Datenbank-Queries
- Input-Validierung mit Zod
- Attachment-Größenlimit: 10MB

## Lizenz

Privates Projekt - Robert Einsle

## Kontakt

Robert Einsle - robert@einsle.com
