require('dotenv').config()

const express = require('express')
const cors = require('cors')
const pool = require('./config/pool')

const app = express()
const PORT = process.env.PORT || 5001;

app.use(cors())
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

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

module.exports = app;