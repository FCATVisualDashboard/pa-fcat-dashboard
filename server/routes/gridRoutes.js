const express = require('express');
const router = express.Router();
const gridController = require('../controllers/gridController');

// POST request to save data
router.post('/save', gridController.saveGridArea);

// GET request to fetch data
router.get('/all', gridController.getAllGrids);

module.exports = router;