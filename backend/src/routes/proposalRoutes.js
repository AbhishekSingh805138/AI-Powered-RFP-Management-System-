const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createManualProposalSchema } = require('../middleware/validationSchemas');
const { validatePdfContent } = require('../middleware/uploadSecurity');
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

router.get('/', requirePermission('proposal:read'), proposalController.listProposals);
router.get('/:id', requirePermission('proposal:read'), proposalController.getProposal);
router.post('/manual', requirePermission('proposal:write'), validate(createManualProposalSchema), proposalController.createProposal);
router.post('/upload', requirePermission('proposal:write'), upload.single('file'), validatePdfContent, proposalController.uploadProposal);
router.post('/fetch-emails', requirePermission('proposal:write'), proposalController.fetchAndProcessEmails);
router.post('/:id/parse', requirePermission('proposal:write'), proposalController.parseProposal);

module.exports = router;
