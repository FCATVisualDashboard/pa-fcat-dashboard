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

2. Start the Frontend UI

Bash
cd client
npm run dev
Runs on http://localhost:5173 with Vite Hot Module Replacement (HMR).

## Project Structure
/client: React frontend (Vite, HTML5 Canvas rendering, UI components).

/server: Node.js/Express backend (API endpoints, MSSQL integration, data normalization).
