// server/routes/seedRoutes.js
// DEV-ONLY routes — mounted only when NODE_ENV !== 'production'

const express = require('express');
const router = express.Router();
const seedController = require('../controllers/seedController');

// GET  /api/seed/status  — current DB state with resolved colors
router.get('/status', seedController.getSeedStatus);

// POST /api/seed/apply   — wipe + re-seed all test data
router.post('/apply', seedController.applySeed);

// DELETE /api/seed/reset — wipe all data, leave empty DB
router.delete('/reset', seedController.resetSeed);

module.exports = router;