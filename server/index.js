require('dotenv').config()

const express = require('express')
const cors = require('cors')
const pool = require('./config/pool')

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
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection failed:', err)
  } else {
    console.log('Database connected:', res.rows[0].now)
  }
})

// Routes
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/areas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM areas')
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/workorders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM work_order')
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
app.get('/api/grid/centers', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                g.pm_id,
                a.description,
                ROUND(AVG(g.x_pos)) AS center_x,
                ROUND(AVG(g.y_pos)) AS center_y
            FROM grid g
            JOIN areas a ON g.pm_id = a.pm_id
            GROUP BY g.pm_id, a.description
        `)
        res.json(result.rows)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})
app.get('/api/dashboard', async (req, res) => {
    try {
        // all grid cells with their area's status and description
        const gridResult = await pool.query(`
            SELECT 
                g.x_pos,
                g.y_pos,
                g.pm_id,
                a.description,
                a.status
            FROM grid g
            JOIN areas a ON g.pm_id = a.pm_id
        `)

        // center point per zone for label placement
        const centerResult = await pool.query(`
            SELECT
                g.pm_id,
                a.description,
                a.status,
                ROUND(AVG(g.x_pos)) AS center_x,
                ROUND(AVG(g.y_pos)) AS center_y
            FROM grid g
            JOIN areas a ON g.pm_id = a.pm_id
            GROUP BY g.pm_id, a.description, a.status
        `)

        res.json({
            cells: gridResult.rows,
            centers: centerResult.rows
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});

module.exports = app;