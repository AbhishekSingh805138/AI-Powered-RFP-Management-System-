const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requirePermission } = require('../middleware/auth');
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

// Document endpoints
router.get('/', requirePermission('rfp:read'), controller.listDocuments);
router.get('/:id', requirePermission('rfp:read'), controller.getDocument);
router.post('/upload', requirePermission('rfp:write'), upload.single('file'), validatePdfContent, controller.uploadDocument);
router.post('/:id/extract', requirePermission('rfp:write'), controller.extractRequirements);
router.delete('/:id', requirePermission('rfp:delete'), controller.deleteDocument);

// Generated proposal endpoints
router.get('/:docId/proposals', requirePermission('proposal:read'), controller.listGeneratedProposals);
router.get('/:docId/proposals/:id', requirePermission('proposal:read'), controller.getGeneratedProposal);
router.post('/:id/generate', requirePermission('proposal:write'), validate(generateProposalSchema), controller.generateProposal);
router.put('/:docId/proposals/:id', requirePermission('proposal:write'), validate(updateProposalSchema), controller.updateGeneratedProposal);
router.get('/:docId/proposals/:id/export', requirePermission('proposal:read'), validateQuery(exportProposalQuery), controller.exportProposal);

module.exports = router;
