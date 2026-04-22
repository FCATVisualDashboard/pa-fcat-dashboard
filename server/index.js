process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require('dotenv').config()

const express = require('express')
const cors = require('cors')
const pool = require('./config/pool')
const sql = require('./config/pool');


const app = express()
const PORT = process.env.PORT || 5001;

app.use(cors({
  origin: [
    'https://pa-fcat-dashboard.vercel.app',
    'http://localhost:5173'  // for local dev
  ]
}));
app.use(express.json())

const gridRoutes = require('./routes/gridRoutes');
app.use('/api/grid', gridRoutes);

// Test DB connection
sql`SELECT NOW()`
  .then(res => console.log("Database connected:", res[0]))
  .catch(err => console.error("Database connection failed:", err));

// Routes

// Areas route
app.get('/api/areas', async (req, res) => {
  try {
    const result = await sql`SELECT * FROM areas`;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Work orders route
app.get('/api/workorders', async (req, res) => {
  try {
    const result = await sql`SELECT * FROM work_order`;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Centers route
app.get('/api/grid/centers', async (req, res) => {
  try {
    const result = await sql`
      SELECT g.pm_id, a.description,
        ROUND(AVG(g.x_pos)) AS center_x,
        ROUND(AVG(g.y_pos)) AS center_y
      FROM grid g
      JOIN areas a ON g.pm_id = a.pm_id
      GROUP BY g.pm_id, a.description
    `;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard route
app.get('/api/dashboard', async (req, res) => {
  try {
    const cells = await sql`
      SELECT g.pm_id, g.x_pos, g.y_pos, a.description,
        w.status, w.target_start_date, w.frequency
      FROM grid g
      LEFT JOIN areas a ON g.pm_id = a.pm_id
      LEFT JOIN work_order w ON g.pm_id = w.pm_id
    `;

    const centers = await sql`
      SELECT g.pm_id, a.description, w.status,
        ROUND(AVG(g.x_pos)) AS center_x,
        ROUND(AVG(g.y_pos)) AS center_y
      FROM grid g
      LEFT JOIN areas a ON g.pm_id = a.pm_id
      LEFT JOIN work_order w ON g.pm_id = w.pm_id
      GROUP BY g.pm_id, a.description, w.status
    `;

    res.json({ cells, centers });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});

module.exports = app;