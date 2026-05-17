# JFK Maximo FCAT PM Visualization Dashboard

Interactive full-stack operational dashboard for monitoring FAA preventive maintenance (FCAT PM) compliance across JFK Airport airfield infrastructure.

The system visualizes preventive maintenance status for runways, taxiways, and connector zones using a high-performance spatial matrix rendered directly over an aerial basemap. Work order states are aggregated using a strict **worst-case severity model** to ensure unresolved maintenance conditions remain visible.

---

## System Architecture

Due to early environment and sandbox limitations, ingestion was implemented using a flexible Excel upload pipeline instead of direct Maximo API integration.

The application is built around a fully decoupled **Normalization Layer**. Database models, business rules, and frontend rendering logic remain independent from the upstream data source.

This design makes the platform **API-ready** — migrating from spreadsheet uploads to direct Maximo OSLC endpoints requires no downstream database or visualization changes.

```text
Daily Maximo Export
        │
        ▼
┌─────────────────────────────────────┐
│     Node.js Ingestion Layer         │
│                                     │
│  • Flexible column mapping          │
│  • Regex bracket parsing            │
│  • Data normalization               │
│                                     │
│  (Swappable with Maximo OSLC API)   │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database (Neon)     │
│                                     │
│  • Relational storage               │
│  • Worst-case status rollups        │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│        React Canvas Frontend        │
│                                     │
│  • 854 × 480 matrix renderer        │
│  • Interactive information panel    │
│  • Large display optimization       │
└─────────────────────────────────────┘
```

---

## Technical Stack

### Frontend (`/client`)

- **Framework:** React 19 (Vite)
- **Routing:** React Router DOM v7
- **Rendering Engine:** HTML5 `<canvas>`
- **Visualization Model:** 854 × 480 coordinate matrix
- **Performance Target:** Smooth rendering across 410,000+ coordinate intersections
- **Deployment:** Vercel

### Backend (`/server`)

- **Runtime:** Node.js + Express
- **Upload Handling:** Multer memory storage
- **Workbook Processing:** SheetJS (`xlsx`)
- **Database Driver:** `@neondatabase/serverless`
- **Testing:** Jest + Supertest

---

## Database Schema

Core relational model:

```sql
CREATE TABLE areas (
    pm_id VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255)
);

CREATE TABLE grid (
    id SERIAL PRIMARY KEY,
    x_pos INTEGER,
    y_pos INTEGER,
    pm_id VARCHAR(50) REFERENCES areas(pm_id),
    UNIQUE (pm_id, x_pos, y_pos)
);

CREATE TABLE work_order (
    work_order_id VARCHAR(50) PRIMARY KEY,
    pm_id VARCHAR(50) REFERENCES areas(pm_id),
    status VARCHAR(50),
    target_start_date TIMESTAMP,
    frequency VARCHAR(50),
    description VARCHAR(255)
);
```

---

## Worst-Case Severity Aggregation Logic

When multiple active work orders exist within the same maintenance zone, the backend elevates the **highest-severity operational status** to determine the final visualization color.

This prevents completed or low-priority items from masking unresolved maintenance conditions.

| Priority | Status | Color | Evaluation Rule |
|----------|----------|----------|----------|
| 1 | Overdue | 🔴 Red | `status <> 'CONCL' AND target_start_date < NOW()` |
| 2 | Unapproved | 🟡 Yellow | `status = 'WASSGN' OR status = 'WASSGND'` |
| 3 | Approved | 🟠 Orange | `status = 'APPR'` |
| 4 | Completed | 🟢 Green | All related records evaluate to `CONCL` |
| Default | Inactive / Unmapped | ⚪ Gray | No matching current work orders |

---

## Local Development Setup

### Backend Configuration

Install backend dependencies:

```bash
cd server
npm install
```

Create `/server/.env`:

```env
PORT=5001
DATABASE_URL=postgres://<your-neon-connection-string>?sslmode=require
```

Start the backend:

```bash
npm run dev
```

---

### Frontend Configuration

Install frontend dependencies:

```bash
cd client
npm install
```

Create `/client/.env`:

```env
VITE_API_URL=http://localhost:5001
```

Start the frontend:

```bash
npm run dev
```

Application URL:

```text
http://localhost:5173
```

---

## Test Execution

Backend integration tests run against mocked environments to avoid production database modification.

Run tests:

```bash
cd server
npm test
```

---

## Operational Handoff Guide

### 1. Ingestion Strategy

#### Flexible Column Matching

Excel parsing uses a normalized alias mapping system (`COLUMN_ALIASES`).

Headers such as:

```text
duedate
scheduledstart
targetstartdate
```

are automatically mapped to:

```text
target_start_date
```

without requiring exact column naming.

#### Bracket Parsing Logic

Maximo exports often contain encoded PM labels rather than directly usable zone identifiers.

The ingestion layer:

1. Scans source text fields
2. Applies regex bracket extraction
3. Detects values such as:

```text
[TW-19]
```

4. Extracts the trailing segment after the final dash
5. Uses the parsed value to establish relational mapping inside the database

---

### 2. Admin Calibration Tool (`/admin`)

The visualization operates on an **854 × 480 coordinate matrix**.

Blueprint Mode overlays engineering drawings directly over the satellite basemap for calibration and zone editing.

#### Calibration Workflow

- Enable **Blueprint Mode**
- Align geometry using **Move** and **Rotate** controls
- Select **Lock Position & Draw**
- Trace maintenance zones onto the calibrated canvas

#### Canvas Shortcuts

| Shortcut | Action |
|----------|----------|
| `P` | Paint mode |
| `E` | Erase mode |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |

---

### 3. Database Seeding & Map Data Preservation

Because airport surfaces are irregularly shaped, geometric zone coordinates cannot be computed dynamically; they must be generated via the manual drawing canvas.

Historical geometry coordinates have been exported from the production database and committed as seed files.

> ⚠️ **CRITICAL:** Do not skip this configuration sequence on clean-slate deployments. Omitting these tables will result in an entirely blank airfield visual map.

Seed files are tracked directly inside the repository at:

- `server/database/areas.csv` — PM zone labels and baseline descriptions
- `server/database/grid.csv` — Coordinate entries mapping pixel clusters to parent area keys

#### Import Sequence via Neon Console

1. Execute the queries inside `server/database/db.sql`.
2. Open the **SQL Editor** or import wizard.
3. Import `areas.csv` into the **areas** table first (**required for foreign key dependencies**).
4. Import `grid.csv` into the **grid** table second.

If restoring geometry seeds via PostgreSQL shell:

```sql
\copy areas FROM 'server/database/areas.csv' DELIMITER ',' CSV HEADER;
\copy grid FROM 'server/database/grid.csv' DELIMITER ',' CSV HEADER;
```

---

### 4. Migrating to Direct Maximo API Integration

To replace manual spreadsheet uploads with live enterprise data feeds:

Navigate to:

```text
server/controllers/workOrderController.js
```

Replace the spreadsheet ingestion routine with direct Maximo OSLC requests.

Example implementation:

```javascript
const response = await fetch(
  'https://<maximo-host>/oslc/os/mxworkorder?oslc.where=jobplan="TORQUE_CLEAN"&oslc.pageSize=500',
  {
    headers: {
      apikey: process.env.MAXIMO_API_KEY
    }
  }
);

const apiPayload = await response.json();
```

Map the API payload into the existing normalized ingestion record format.

No frontend, database schema, or visualization changes are required after migration.
