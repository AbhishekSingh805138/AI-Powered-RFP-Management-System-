const { z } = require('zod');

// ── Shared helpers ──────────────────────────────────────────
const idParam = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a positive integer'),
});

const positiveInt = z.number().int().positive();

// ── Auth ────────────────────────────────────────────────────
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

// ── RFPs ────────────────────────────────────────────────────
const createRfpSchema = z.object({
  rawInput: z.string().trim().min(1, 'RFP description is required').max(10000),
});

const updateRfpSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  structuredData: z.record(z.unknown()).optional(),
  budget: z.number().positive().optional().nullable(),
  currency: z.string().length(3).optional(),
  deadline: z.string().datetime().optional().nullable(),
  deliveryDays: z.number().int().positive().optional().nullable(),
  status: z.enum(['draft', 'published', 'sent', 'evaluating', 'awarded', 'closed']).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

const sendRfpSchema = z.object({
  vendorIds: z.array(positiveInt).min(1, 'At least one vendor ID is required'),
});

// ── Vendors ─────────────────────────────────────────────────
const createVendorSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  email: z.string().email().max(255),
  company: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  address: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
});

const updateVendorSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  company: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  address: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

// ── Proposals ───────────────────────────────────────────────
const createManualProposalSchema = z.object({
  rfpId: positiveInt,
  vendorId: positiveInt,
  rawContent: z.string().trim().min(1, 'Proposal content is required'),
  sourceType: z.string().trim().optional(),
});

// ── RFP Documents ───────────────────────────────────────────
const generateProposalSchema = z.object({
  companyProfile: z.object({
    company_name: z.string().trim().min(1, 'Company name is required'),
  }).passthrough(),
});

const updateProposalSchema = z.object({
  proposalContent: z.record(z.unknown()).optional(),
  title: z.string().trim().min(1).max(255).optional(),
  status: z.enum(['edited', 'finalized']).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

// ── Chat ────────────────────────────────────────────────────
const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message content is required').max(10000),
  options: z.object({
    topK: z.number().int().min(1).max(20).optional(),
    filterSourceType: z.string().trim().nullable().optional(),
  }).optional(),
});

// ── Search ──────────────────────────────────────────────────
const searchSchema = z.object({
  query: z.string().trim().min(1, 'Search query is required').max(2000),
  topK: z.number().int().min(1).max(50).optional(),
  filterSourceType: z.string().trim().nullable().optional(),
});

// ── Compliance ──────────────────────────────────────────────
const complianceCheckSchema = z.object({
  rfpDocumentId: positiveInt,
  generatedProposalId: positiveInt.optional(),
  proposalText: z.string().trim().optional(),
});

// ── Risk ────────────────────────────────────────────────────
const riskAnalysisSchema = z.object({
  rfpDocumentId: positiveInt,
  generatedProposalId: positiveInt.optional(),
});

const riskCompareSchema = z.object({
  analysisIds: z.array(positiveInt).min(2, 'At least 2 analysis IDs required'),
});

// ── Export ──────────────────────────────────────────────────
const exportProposalQuery = z.object({
  format: z.enum(['pdf', 'docx']).optional().default('pdf'),
});

// ── Notifications ──────────────────────────────────────────
const notificationListQuery = z.object({
  type: z.string().trim().optional(),
  status: z.enum(['queued', 'sent', 'failed']).optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

// ── Admin ───────────────────────────────────────────────────
const changeRoleSchema = z.object({
  role: z.enum(['admin', 'manager', 'viewer']),
});

const changeStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
});

const updateUserSchema = z.object({
  email: z.string().email().max(255).optional(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  role: z.enum(['admin', 'manager', 'viewer']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

const resetPasswordSchema = z.object({
  password: passwordSchema,
});

module.exports = {
  idParam,
  // Auth
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  // RFPs
  createRfpSchema,
  updateRfpSchema,
  sendRfpSchema,
  // Vendors
  createVendorSchema,
  updateVendorSchema,
  // Proposals
  createManualProposalSchema,
  // RFP Documents
  generateProposalSchema,
  updateProposalSchema,
  exportProposalQuery,
  // Chat
  createConversationSchema,
  sendMessageSchema,
  // Search
  searchSchema,
  // Compliance
  complianceCheckSchema,
  // Risk
  riskAnalysisSchema,
  riskCompareSchema,
  // Notifications
  notificationListQuery,
  // Admin
  changeRoleSchema,
  changeStatusSchema,
  updateUserSchema,
  resetPasswordSchema,
};
