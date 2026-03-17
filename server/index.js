const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Allows React app to make requests to this API
app.use(express.json()); // Allows  server to accept JSON data

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: "The JFK FCAT Express server is actively running!" });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});