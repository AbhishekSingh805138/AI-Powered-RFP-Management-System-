const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireRole } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validate');
const { generateProposalSchema, updateProposalSchema, exportProposalQuery } = require('../middleware/validationSchemas');
const { validatePdfContent } = require('../middleware/uploadSecurity');
const controller = require('../controllers/rfpDocumentController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB for RFP documents
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Document endpoints — reads open to any authenticated user
router.get('/', controller.listDocuments);
router.get('/:id', controller.getDocument);
router.post('/upload', requireRole('admin', 'manager'), upload.single('file'), validatePdfContent, controller.uploadDocument);
router.post('/:id/extract', requireRole('admin', 'manager'), controller.extractRequirements);
router.delete('/:id', requireRole('admin', 'manager'), controller.deleteDocument);

// Generated proposal endpoints
router.get('/:docId/proposals', controller.listGeneratedProposals);
router.get('/:docId/proposals/:id', controller.getGeneratedProposal);
router.post('/:id/generate', requireRole('admin', 'manager'), validate(generateProposalSchema), controller.generateProposal);
router.put('/:docId/proposals/:id', requireRole('admin', 'manager'), validate(updateProposalSchema), controller.updateGeneratedProposal);
router.get('/:docId/proposals/:id/export', validateQuery(exportProposalQuery), controller.exportProposal);

module.exports = router;
