# JFK FCAT PM Visualization Dashboard

A full-stack web application designed for the Port Authority of New York and New Jersey to track and manage Preventative Maintenance (PM) zones at JFK airport. It features a custom HTML5 Canvas rendering engine for interactive, spatial data visualization.

##  Key Features
- **Interactive Map Engine:** Custom-built HTML5 Canvas interface for viewing and interacting with airfield PM zones.
- **Auto-Fill Tracing Tool:** Built-in admin mapping tool utilizing ray-casting and Bresenham's line algorithms to trace and auto-fill complex polygons.
- **Dynamic UI:** Slide-out sidebars and hover tooltips for granular zone data without cluttering the map.
- **RESTful API:** Node.js/Express backend handling spatial data translation and database transactions.

---

## Prerequisites
- **Node.js (v22.12.0+)**: *Strict requirement for Vite 6+ and backend native watch mode.*
- **PostgreSQL**: Installed locally with pgAdmin for database management.
- **Git**

---

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
npm install @neondatabase/serverless
```

---

## 🗄️ Backend & Database Setup

### 1. Environment Variables
Create a `.env` file inside the `server/` folder. Use this unified connection string format:

```env
PORT=5001
NODE_ENV=development
DATABASE_URL=postgres://YOUR_POSTGRES_USERNAME:YOUR_POSTGRES_PASSWORD@localhost:5432/jfk_fcat
```
*(Make sure to replace the username and password with your actual local pgAdmin credentials).*

### 2. Database Setup
Run SQL file in pgAdmin using the Query Tool to initialize your local database:
 `server/database/db.sql` — creates the necessary tables.

---

## 💻 Running Locally

The project requires two concurrent terminal sessions to run the frontend and backend simultaneously.

**1. Start the Backend API**
```bash
cd server
npm run dev
```
*Runs on `http://localhost:5001` with native Node watch-mode hot-reloading.*

**2. Start the Frontend UI**
```bash
cd client
npm run dev
```
*Runs on `http://localhost:5173` with Vite Hot Module Replacement (HMR).*

---

## 🧪 Testing

The backend is fully equipped with an isolated integration testing suite using **Jest** and **Supertest**. The tests intercept database calls using a mock connection pool, ensuring your actual database is never mutated during test runs.

To run the backend test suite:
```bash
cd server
npm test
```

---

## 📂 Project Structure

- `/client`: React frontend (Vite, HTML5 Canvas engine, interactive UI components).
- `/server`: Node.js/Express backend (REST API endpoints, PostgreSQL integration, Jest testing suite).
```
