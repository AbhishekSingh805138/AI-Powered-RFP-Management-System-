const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createConversationSchema, sendMessageSchema } = require('../middleware/validationSchemas');
const chatController = require('../controllers/chatController');

// All authenticated users can use chat — user-scoping handled in controller
router.post('/conversations', validate(createConversationSchema), chatController.createConversation);
router.get('/conversations', chatController.listConversations);
router.get('/conversations/:id', chatController.getConversation);
router.post('/conversations/:id/messages', validate(sendMessageSchema), chatController.sendMessage);
router.put('/conversations/:id/archive', chatController.archiveConversation);
router.delete('/conversations/:id', requireRole('admin', 'manager'), chatController.deleteConversation);
router.get('/conversations/:id/suggestions', chatController.getSuggestedQuestions);

module.exports = router;
