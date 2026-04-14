const express = require('express');
const router = express.Router();
const gridController = require('../controllers/gridControllers');

// POST request to save data
router.post('/save', gridController.saveGridArea);

// GET request to fetch data
router.get('/all', gridController.getAllGrids);

// DELETE request to remove data for a specific PM ID
router.delete('/delete/:pm_id', gridController.deleteGridArea);

// PATCH request to edit data for a specific PM ID
router.put('/edit/:pm_id', gridController.updateGridArea);

module.exports = router;