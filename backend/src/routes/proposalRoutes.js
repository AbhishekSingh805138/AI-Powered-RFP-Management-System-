const express = require('express');
const router = express.Router();
const multer = require('multer');
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

router.post('/manual', proposalController.createProposal);
router.post('/upload', upload.single('file'), proposalController.uploadProposal);
router.post('/fetch-emails', proposalController.fetchAndProcessEmails);
router.get('/', proposalController.listProposals);
router.get('/:id', proposalController.getProposal);
router.post('/:id/parse', proposalController.parseProposal);

module.exports = router;
