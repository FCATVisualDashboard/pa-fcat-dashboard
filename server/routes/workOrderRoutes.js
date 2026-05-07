const express = require('express');
const router = express.Router();
const multer = require('multer');
const workOrderController = require('../controllers/workOrderController');

// Store file in memory (buffer) — no disk writes needed
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB cap
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel',                                           // .xls
      'application/octet-stream',                                           // fallback
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are accepted.'));
    }
  },
});

// POST /api/workorders/upload?preview=true   — parse & preview without saving
// POST /api/workorders/upload                — parse & upsert into DB
router.post('/upload', upload.single('file'), workOrderController.uploadWorkOrders);

// GET  /api/workorders                       — fetch all work orders
router.get('/', workOrderController.getAllWorkOrders);

// DELETE /api/workorders/:work_order_id      — remove a single work order
router.delete('/:work_order_id', workOrderController.deleteWorkOrder);

// DELETE /api/workorders                     — wipe all (dev/reset use)
router.delete('/', workOrderController.clearAllWorkOrders);

module.exports = router;