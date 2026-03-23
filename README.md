# JFK FCAT PM Visualization Dashboard

## Prerequisites

- **Node.js (v22.12.0+)**: *Strict requirement for Vite 6+ and backend native watch mode.*
- **Git**

## Installation

Clone the repository and install dependencies for both the client and server environments.

```bash
# 1. Clone the repo
git clone [https://github.com/FCATVisualDashboard/pa-fcat-dashboard.git](https://github.com/FCATVisualDashboard/pa-fcat-dashboard.git)
cd pa-fcat-dashboard

# 2. Install backend dependencies
cd server
npm install
npm install pg

# 3. Install frontend dependencies
cd ../client
npm install
```
## Running Locally
The project requires two concurrent terminal sessions to run the frontend and backend simultaneously.

1. Start the Backend API

Bash
cd server
npm run dev
Runs on http://localhost:5000 with native Node watch-mode hot-reloading.
(Make sure that your using your own unique postgres password in the .env file when accessing data)

2. Start the Frontend UI

Bash
cd client
npm run dev
Runs on http://localhost:5173 with Vite Hot Module Replacement (HMR).

## Backend & Database Setup

### 1. Environment Variables
Create a `.env` file inside the `server/` folder. Use this format:
```
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jfk_fcat
DB_USER=postgres
DB_PASSWORD=yourPostgresPassword
```

- **PORT** — the port your Express server runs on
- **NODE_ENV** — set to `development` while building locally
- **DB_HOST** — where your database lives (`localhost` means your own machine)
- **DB_PORT** — PostgreSQL's default port, leave as `5432` unless you changed it during install
- **DB_NAME** — the name of the database you created in pgAdmin
- **DB_USER** — your PostgreSQL username, typically `postgres`
- **DB_PASSWORD** — the password you set when installing PostgreSQL

### 2. Database Setup
Run both SQL files in pgAdmin using the Query Tool:
1. `server/database/db.sql` — creates the tables
2. `server/database/seed.sql` — loads sample data for development

### 3. Starting the Server
```
cd server
npm install
npm run dev
```

You should see both of these lines in your terminal:
```
Server running on port 3001
Database connected: <timestamp>
```

### 4. Verify It's Working
Visit these URLs in your browser to confirm the API is responding:
- `http://localhost:3001/api/status` — server health check
- `http://localhost:3001/api/areas` — returns all PM zones
- `http://localhost:3001/api/workorders` — returns all work orders
## Project Structure
/client: React frontend (Vite, HTML5 Canvas rendering, UI components).

/server: Node.js/Express backend (API endpoints, MSSQL integration, data normalization).
