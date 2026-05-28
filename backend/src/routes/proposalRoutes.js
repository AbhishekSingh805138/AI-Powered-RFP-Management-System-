const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireRole } = require('../middleware/auth');
const proposalController = require('../controllers/proposalController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

router.get('/', proposalController.listProposals);
router.get('/:id', proposalController.getProposal);
router.post('/manual', requireRole('admin', 'manager'), proposalController.createProposal);
router.post('/upload', requireRole('admin', 'manager'), upload.single('file'), proposalController.uploadProposal);
router.post('/fetch-emails', requireRole('admin', 'manager'), proposalController.fetchAndProcessEmails);
router.post('/:id/parse', requireRole('admin', 'manager'), proposalController.parseProposal);

module.exports = router;
