# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DMARC Reports ist eine vollautomatisierte Webapp zur Verarbeitung, Analyse und Überwachung von DMARC-Reports mit KI-gestützter Bedrohungserkennung (Claude API) und automatischen Benachrichtigungen.

## Technology Stack

- **Framework:** Next.js 14+ mit TypeScript
- **Database:** SQLite mit Better SQLite3
- **AI Analysis:** Claude API (Anthropic SDK)
- **Email:** IMAP (node-imap) für Empfang, Postal API für Benachrichtigungen
- **Deployment:** Docker Container
- **Scheduler:** Node-Cron (10-Minuten-Intervall)

## Common Commands

### Development
```bash
# Install dependencies
npm install

# Initialize database (first time or after schema changes)
npm run db:init

# Start development server (mit Scheduler)
npm run dev

# Build for production
npm run build

# Start production server (mit Scheduler)
npm start

# Start ohne Scheduler (nur Next.js)
npm run start:no-scheduler

# Lint code
npm run lint
```

### Database Management
```bash
# Initialize/reset database
npm run db:init

# Manual email fetch (for testing)
npm run fetch:manual

# Manual AI analysis (analyze unprocessed reports)
npm run analyze:manual

# Complete pipeline (fetch + analyze)
npm run pipeline:manual

# Test notification system
npm run test:notification
```

### Docker
```bash
# Build Docker image
docker-compose build

# Start container (detached mode)
docker-compose up -d

# View logs (follow mode)
docker-compose logs -f

# Stop container
docker-compose down

# Stop and remove volumes (CAUTION: deletes database!)
docker-compose down -v

# Rebuild and restart
docker-compose up -d --build

# Enter running container (for debugging)
docker-compose exec dmarc-reports sh

# View container status
docker-compose ps
```

## Architecture

### Data Flow
1. **Email Fetcher** (`src/lib/services/email-fetcher.ts`) - Holt DMARC-Reports via IMAP alle 10 Minuten
2. **DMARC Parser** (`src/lib/services/dmarc-parser.ts`) - Parst XML aus GZ/ZIP-Anhängen
3. **Database** (`src/lib/db/`) - Speichert Reports in SQLite
4. **Claude Analyzer** (`src/lib/services/claude-analyzer.ts`) - Analysiert Reports mit Claude AI
5. **Notification Service** (`src/lib/services/notification.ts`) - Sendet Alerts bei kritischen Bedrohungen
6. **Dashboard** (`src/app/dashboard/`) - Visualisiert KPIs und Bedrohungen

### Database Schema

**5 Haupttabellen:**
- `dmarc_reports` - Report-Metadaten (org_name, domain, date_range, policy)
- `dmarc_records` - Einzelne Records (source_ip, count, dkim/spf-status)
- `ai_analysis` - Claude-Analyseergebnisse (compliance, threats, recommendations)
- `notifications` - Tracking versendeter E-Mails
- `processing_log` - Audit-Trail für E-Mail-Verarbeitung

### Key Services

**Email Fetcher:** Verbindet sich mit mail.einsle.cloud:993 via IMAP/TLS, downloaded Anhänge (GZ/ZIP), extrahiert XML, löscht E-Mails nach Verarbeitung.

**DMARC Parser:** Parst RFC 7489 XML-Format mit `fast-xml-parser`, extrahiert Metadaten und Records, speichert in DB.

**Claude Analyzer:**
- Lädt unverarbeitete Reports
- Formatiert strukturierten Prompt mit Report-Daten
- Ruft Claude API auf (Sonnet 3.5)
- Parst JSON-Response: compliance_status, threats[], recommendations[]
- Speichert in `ai_analysis` Tabelle
- Triggert Notifications bei HIGH/CRITICAL Threats

**Notification Service:** Sendet E-Mails via Postal API nur bei kritischen Bedrohungen, verhindert Duplikate.

**Scheduler:** Node-Cron läuft alle 10 Minuten, führt gesamte Pipeline aus: Fetch → Parse → Analyze → Notify.

## Environment Variables

Alle sensiblen Daten in `.env` (siehe `.env.example` als Template):
- `IMAP_*` - IMAP-Credentials für E-Mail-Abruf
- `ANTHROPIC_API_KEY` - Claude API Key
- `POSTAL_*` - Postal API für E-Mail-Versand
- `DATABASE_PATH` - SQLite-Datenbankpfad
- `CRON_SCHEDULE` - Cron-Expression für Scheduler

**WICHTIG:** `.env` ist in `.gitignore` und darf NIEMALS committed werden.

## Database Operations

**Better SQLite3** mit synchroner API:
```typescript
import { getDatabase, insertDmarcReport } from '@/lib/db/client';

const db = getDatabase();
const id = insertDmarcReport({
  report_id: '123',
  org_name: 'Google',
  // ...
});
```

**Prepared Statements:** Alle DB-Operationen in `src/lib/db/client.ts` nutzen Prepared Statements für Sicherheit.

## Development Workflow

1. **Neue Features:** Immer zuerst Datenbankschema prüfen/erweitern in `src/lib/db/schema.ts`
2. **Services:** Neue Services in `src/lib/services/` erstellen
3. **API Routes:** Next.js API Routes in `src/app/api/*/route.ts`
4. **Components:** React-Komponenten in `src/components/`
5. **Types:** TypeScript-Typen in `src/lib/types/`

### Wichtige Implementierungsdetails

**DMARC XML-Format (RFC 7489):**
- Reports kommen als GZ- oder ZIP-komprimierte XML-Dateien
- Struktur: `<feedback>` → `<report_metadata>` + `<policy_published>` + `<record>`
- Jeder `<record>` enthält: source_ip, count, policy_evaluated, identifiers, auth_results

**Database Foreign Keys:**
- `dmarc_records.report_id` → `dmarc_reports.id`
- `ai_analysis.report_id` → `dmarc_reports.id` (UNIQUE)
- `notifications.analysis_id` → `ai_analysis.id`
- Cascading DELETE aktiviert via `ON DELETE CASCADE`

**Claude API Integration:**
- Model: `claude-3-5-sonnet-20241022`
- Temperature: 0.3 (niedrig für konsistente Analysen)
- Max Tokens: 4096
- Response-Format: Strukturiertes JSON mit compliance_status, threats, trends, recommendations

## Testing

Nach Code-Änderungen:
```bash
# Datenbank neu initialisieren
npm run db:init

# Dev-Server starten
npm run dev

# Manuellen E-Mail-Fetch testen
npm run fetch:manual
```

## Current Implementation Status

**Phase 1 (Completed):** Projekt-Setup
- ✅ Next.js mit TypeScript konfiguriert
- ✅ Datenbank-Schema und Client implementiert
- ✅ Environment-Variables Setup
- ✅ Basis-Dashboard erstellt

**Phase 2 (Completed):** Email Fetcher & DMARC Parser
- ✅ IMAP-Service (`src/lib/services/email-fetcher.ts`)
- ✅ XML-Parser (`src/lib/services/dmarc-parser.ts`)
- ✅ Logging-Utility (`src/lib/utils/logger.ts`)
- ✅ Test-Script (`src/scripts/run-fetcher.ts`)
- ✅ Erfolgreich getestet mit IMAP-Server

**Phase 3 (Completed):** Claude AI Integration
- ✅ Claude Analyzer Service (`src/lib/services/claude-analyzer.ts`)
- ✅ TypeScript-Typen für AI-Analyse (`src/lib/types/analysis.ts`)
- ✅ Strukturierter Prompt für DMARC-Analyse
- ✅ JSON-Response-Parsing mit Validierung
- ✅ Automatische Analyse unverarbeiteter Reports
- ✅ Test-Scripts (`run-analyzer.ts`, `run-pipeline.ts`)

**Phase 4 (Completed):** Dashboard UI
- ✅ API Endpoints (`/api/kpis`, `/api/reports`, `/api/analysis`)
- ✅ Dashboard-Komponenten (KPICard, ThreatAlerts, ThreatDistribution, RecommendationsList)
- ✅ Vollständige Dashboard-Page mit Daten-Integration
- ✅ Responsive Design (Mobile, Tablet, Desktop)
- ✅ Zeitraum-Filter (7/30/90 Tage)
- ✅ Echtzeit-Daten-Fetching

**Phase 5 (Completed):** Benachrichtigungssystem
- ✅ Postal API Integration (`src/lib/services/notification.ts`)
- ✅ HTML & Plain-Text E-Mail-Templates
- ✅ Automatische Benachrichtigungen bei HIGH/CRITICAL Threats
- ✅ Duplikat-Prävention (prüft analysis_id)
- ✅ Fehler-Handling und Logging
- ✅ Integration in Claude-Analyzer-Pipeline
- ✅ Test-Script (`test-notification.ts`)

**Phase 6 (Completed):** Scheduler & Automation
- ✅ Node-Cron Scheduler (`src/lib/services/scheduler.ts`)
- ✅ Automatische Pipeline alle 10 Minuten (konfigurierbar via CRON_SCHEDULE)
- ✅ Custom Next.js Server (`server.js`) mit Scheduler-Integration
- ✅ Automatischer Start beim App-Start
- ✅ Health-Check Endpoint (`/api/health`)
- ✅ Status-Tracking (lastRunTime, lastRunStatus, isRunning)
- ✅ Verhindert parallele Ausführungen
- ✅ Umfassendes Error-Handling

**Phase 7 (Completed):** Docker & Deployment
- ✅ Multi-Stage Dockerfile für optimierte Image-Größe
- ✅ Docker Compose Konfiguration mit Volume-Management
- ✅ .dockerignore für Build-Optimierung
- ✅ docker-entrypoint.sh mit automatischer DB-Initialisierung
- ✅ Health-Check Integration
- ✅ Non-Root User für Security
- ✅ Resource Limits (CPU/Memory)
- ✅ Logging Configuration
- ✅ Environment-Variablen-Validierung

## Docker Deployment

### Schnellstart

1. **Environment-Variablen konfigurieren:**
   ```bash
   # .env Datei erstellen (basierend auf .env.example)
   cp .env.example .env
   # .env editieren und alle Werte anpassen
   ```

2. **Container bauen und starten:**
   ```bash
   docker-compose up -d --build
   ```

3. **Logs überprüfen:**
   ```bash
   docker-compose logs -f
   ```

4. **Dashboard aufrufen:**
   ```
   http://localhost:3000/dashboard
   ```

### Docker-Features

- **Multi-Stage Build:** Optimierte Image-Größe (~150MB)
- **Automatische DB-Initialisierung:** Erstellt Datenbank beim ersten Start
- **Persistente Daten:** Volumes für SQLite DB und Logs
- **Health-Checks:** Automatische Container-Überwachung
- **Security:** Non-Root User (nextjs:1001)
- **Resource Limits:** CPU (1.0) & Memory (512MB)
- **Graceful Shutdown:** Dumb-init für Signal-Handling

### Produktions-Deployment

**Empfohlene Schritte:**

1. `.env` mit Produktions-Credentials erstellen
2. Port-Mapping in `docker-compose.yml` anpassen (z.B. 80:3000)
3. Reverse-Proxy (nginx/traefik) für HTTPS konfigurieren
4. Volumes für Backups einrichten
5. Monitoring (Health-Check + Logs) aktivieren

**Backup-Strategie:**
```bash
# Datenbank-Backup erstellen
docker-compose exec dmarc-reports cp /app/data/dmarc.db /app/data/backup-$(date +%Y%m%d).db

# Volume-Backup (extern)
docker run --rm -v dmarc-data:/data -v $(pwd):/backup alpine tar czf /backup/dmarc-backup.tar.gz /data
```

## Security Notes

- Alle IMAP-Verbindungen über TLS (Port 993)
- Better SQLite3 nutzt automatisch Prepared Statements
- Input-Validierung mit Zod für API-Endpoints
- Keine Secrets in Git (`.gitignore` prüfen)
- Attachment-Größenlimit: 10MB
- WAL-Mode für SQLite aktiviert (bessere Concurrency)
- Docker: Non-Root User (nextjs:nodejs) für erhöhte Sicherheit
- Docker: Read-Only Mounts wo möglich
- Health-Checks: Automatische Verfügbarkeitsüberwachung
