const express = require('express');
const router = express.Router();
const { getJobStatus } = require('../controllers/jobController');

router.get('/:id', getJobStatus);

module.exports = router;
