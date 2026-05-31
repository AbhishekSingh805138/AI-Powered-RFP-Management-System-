const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createConversationSchema, sendMessageSchema } = require('../middleware/validationSchemas');
const chatController = require('../controllers/chatController');

// All authenticated users with chat:access can use chat — user-scoping handled in controller
router.post('/conversations', requirePermission('chat:access'), validate(createConversationSchema), chatController.createConversation);
router.get('/conversations', requirePermission('chat:access'), chatController.listConversations);
router.get('/conversations/:id', requirePermission('chat:access'), chatController.getConversation);
router.post('/conversations/:id/messages', requirePermission('chat:access'), validate(sendMessageSchema), chatController.sendMessage);
router.put('/conversations/:id/archive', requirePermission('chat:access'), chatController.archiveConversation);
router.delete('/conversations/:id', requirePermission('chat:delete'), chatController.deleteConversation);
router.get('/conversations/:id/suggestions', requirePermission('chat:access'), chatController.getSuggestedQuestions);

module.exports = router;
