require('dotenv').config()
const { neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;

const express = require('express')
const cors = require('cors')
const sql = require('./config/pool')

const app = express()
const PORT = process.env.PORT || 5001;

app.use(cors({
  origin: [
    'https://pa-fcat-dashboard.vercel.app',
    'http://localhost:5173'
  ]
}));
app.use(express.json())

const gridRoutes = require('./routes/gridRoutes');
app.use('/api/grid', gridRoutes);

const workOrderRoutes = require('./routes/workOrderRoutes');
app.use('/api/workorders', workOrderRoutes);

// Test DB connection
sql`SELECT NOW()`
  .then(res => console.log("Database connected:", res[0]))
  .catch(err => console.error("Database connection failed:", err));

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/areas', async (req, res) => {
  try {
    const result = await sql`SELECT * FROM areas`
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/workorders', async (req, res) => {
  try {
    const result = await sql`SELECT * FROM work_order`
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/grid/centers', async (req, res) => {
  try {
    const result = await sql`
      SELECT g.pm_id, a.description,
        ROUND(AVG(g.x_pos)) AS center_x,
        ROUND(AVG(g.y_pos)) AS center_y
      FROM grid g
      JOIN areas a ON g.pm_id = a.pm_id
      GROUP BY g.pm_id, a.description
    `
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/dashboard', async (req, res) => {
  try {
    // Resolve worst-case status per zone in SQL
    const statusRows = await sql`
      WITH overdue_wo AS (
        SELECT pm_id FROM work_order
        WHERE status <> 'CONCL' AND target_start_date < NOW()
      ),
      zone_status AS (
        SELECT
          pm_id,
          CASE
            WHEN BOOL_OR(status <> 'CONCL' AND target_start_date < NOW()) THEN 'OVERDUE'
            WHEN BOOL_OR(status IN ('WASSGN', 'WASSGND')) THEN 'WASSGN'
            WHEN BOOL_OR(status = 'APPR')   THEN 'APPR'
            WHEN BOOL_AND(status = 'CONCL') THEN 'CONCL'
            ELSE 'INACTIVE'
          END AS status
        FROM work_order
        GROUP BY pm_id
      )
      SELECT pm_id, status FROM zone_status
    `;

    const statusMap = {};
    statusRows.forEach(r => { statusMap[r.pm_id] = r.status; });

    const gridRows = await sql`
      SELECT g.x_pos, g.y_pos, g.pm_id, a.description
      FROM grid g
      JOIN areas a ON g.pm_id = a.pm_id
    `;

    const cells = gridRows.map(cell => ({
      ...cell,
      status: statusMap[cell.pm_id] || 'INACTIVE'
    }));

    const centerRows = await sql`
      SELECT g.pm_id, a.description,
        ROUND(AVG(g.x_pos)) AS center_x,
        ROUND(AVG(g.y_pos)) AS center_y
      FROM grid g
      JOIN areas a ON g.pm_id = a.pm_id
      GROUP BY g.pm_id, a.description
    `;

    const centers = centerRows.map(zone => ({
      ...zone,
      status: statusMap[zone.pm_id] || 'INACTIVE'
    }));

    const work_orders = await sql`
      SELECT
        work_order_id, pm_id, status, target_start_date, frequency, description,
        CASE WHEN status <> 'CONCL' AND target_start_date < NOW()
             THEN TRUE ELSE FALSE END AS is_overdue
      FROM work_order
      ORDER BY target_start_date DESC
    `;

    res.json({ cells, centers, work_orders })
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});

module.exports = app;