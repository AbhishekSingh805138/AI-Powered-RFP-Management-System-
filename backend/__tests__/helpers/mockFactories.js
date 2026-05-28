/**
 * Mock data factories for testing.
 * Generates realistic test data matching the Sequelize model schemas.
 */

let idCounter = 1;
const nextId = () => idCounter++;
function resetIds() { idCounter = 1; }

function createMockRfpDocument(overrides = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    title: overrides.title || `Test RFP Document ${id}`,
    originalFilename: overrides.originalFilename || `test-rfp-${id}.pdf`,
    fileSize: overrides.fileSize || 102400,
    rawText: 'rawText' in overrides ? overrides.rawText : `This is the raw text content of RFP document ${id}. It contains requirements for a software development project including authentication, database design, and API development. The deadline is December 2026. Budget is $500,000.`,
    extractedData: 'extractedData' in overrides ? overrides.extractedData : createMockExtractedData(),
    status: overrides.status || 'extracted',
    errorMessage: overrides.errorMessage || null,
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
    generatedProposals: overrides.generatedProposals || [],
    update: jest.fn(async function(data) { Object.assign(this, data); return this; }),
    destroy: jest.fn(async () => {}),
    toJSON: function() { return { ...this, update: undefined, destroy: undefined, toJSON: undefined }; },
  };
}

function createMockExtractedData(overrides = {}) {
  return {
    title: overrides.title || 'Enterprise Software Development RFP',
    issuing_organization: 'Test Corp',
    rfp_number: 'RFP-2026-001',
    summary: 'Seeking proposals for enterprise software development.',
    submission_deadline: '2026-12-31',
    budget_info: {
      estimated_budget: 500000,
      currency: 'USD',
      budget_notes: 'Maximum budget',
    },
    technical_requirements: [
      {
        id: 'TR-1',
        category: 'Security',
        requirement: 'Must implement OAuth 2.0 authentication',
        priority: 'mandatory',
        details: 'Support SSO with SAML and OIDC',
      },
      {
        id: 'TR-2',
        category: 'Database',
        requirement: 'PostgreSQL database with replication',
        priority: 'mandatory',
        details: 'Active-passive replication with automatic failover',
      },
    ],
    compliance_requirements: [
      {
        id: 'CR-1',
        type: 'Certification',
        requirement: 'SOC 2 Type II compliance',
        mandatory: true,
      },
    ],
    deliverables: [
      {
        id: 'D-1',
        deliverable: 'Fully functional web application',
        due_date: '2026-06-30',
        acceptance_criteria: 'All functional requirements met, zero critical bugs',
      },
    ],
    evaluation_criteria: [
      { criterion: 'Technical Approach', weight_percentage: 40, description: 'Quality of solution' },
      { criterion: 'Cost', weight_percentage: 30, description: 'Value for money' },
      { criterion: 'Experience', weight_percentage: 30, description: 'Relevant experience' },
    ],
    ...overrides,
  };
}

function createMockGeneratedProposal(overrides = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    rfpDocumentId: overrides.rfpDocumentId || 1,
    title: overrides.title || `Generated Proposal v${overrides.version || 1}`,
    companyProfile: overrides.companyProfile || {
      company_name: 'Test Solutions Inc',
      industry: 'Software Development',
      expertise: 'Enterprise applications',
      years_of_experience: 15,
      team_size: 50,
    },
    proposalContent: overrides.proposalContent || createMockProposalContent(),
    status: overrides.status || 'generated',
    version: overrides.version || 1,
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
    rfpDocument: overrides.rfpDocument || null,
    update: jest.fn(async function(data) { Object.assign(this, data); return this; }),
    destroy: jest.fn(async () => {}),
    toJSON: function() { return { ...this, update: undefined, destroy: undefined, toJSON: undefined }; },
  };
}

function createMockProposalContent() {
  return {
    title: 'Response to Enterprise Software Development RFP',
    executive_summary: 'We propose a comprehensive solution leveraging modern cloud-native architecture.',
    understanding_of_requirements: 'We understand the need for a robust enterprise platform.',
    technical_approach: {
      overview: 'Cloud-native microservices architecture',
      methodology: 'Agile with two-week sprints',
      solution_components: [
        { component: 'Auth Service', description: 'OAuth 2.0 + SAML SSO', technologies: ['Node.js', 'Passport.js'] },
        { component: 'Database Layer', description: 'PostgreSQL with replication', technologies: ['PostgreSQL', 'PgBouncer'] },
      ],
      innovation: 'AI-powered monitoring and alerting',
    },
    scope_of_work: [
      {
        phase: 'Discovery',
        description: 'Requirements gathering and design',
        activities: ['Stakeholder interviews', 'Technical design'],
        deliverables: ['Design document', 'Architecture diagram'],
        duration: '4 weeks',
      },
    ],
    timeline: {
      total_duration: '6 months',
      milestones: [
        { milestone: 'Phase 1 Complete', target_date: '2026-03-01', deliverables: ['MVP'] },
      ],
    },
    team_composition: [
      { role: 'Project Manager', responsibilities: 'Overall delivery', qualifications: 'PMP certified' },
    ],
    cost_breakdown: {
      summary: 'Fixed-price engagement',
      line_items: [
        { item: 'Development', category: 'Labor', estimated_cost: '$300,000', notes: '6 developers for 6 months' },
        { item: 'Infrastructure', category: 'Infrastructure', estimated_cost: '$50,000', notes: 'AWS hosting' },
      ],
      total_estimated_cost: '$450,000',
      payment_schedule: '30% upfront, 40% at midpoint, 30% at completion',
      assumptions: ['Client provides timely feedback'],
    },
    compliance_matrix: [
      { requirement_id: 'TR-1', requirement_summary: 'OAuth 2.0', compliance_status: 'compliant', response: 'Full OAuth 2.0 implementation' },
    ],
    risk_mitigation: [
      { risk: 'Scope creep', impact: 'high', mitigation_strategy: 'Strict change management process' },
    ],
    differentiators: ['15 years of enterprise experience', '99.9% uptime SLA'],
    past_performance: 'Delivered 50+ enterprise projects successfully.',
    terms_and_conditions: 'Standard terms apply. 1-year warranty on all deliverables.',
  };
}

function createMockDocumentEmbedding(overrides = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    sourceType: overrides.sourceType || 'rfp_document',
    sourceId: overrides.sourceId || 1,
    sourceTitle: overrides.sourceTitle || 'Test Document',
    chunkIndex: overrides.chunkIndex || 0,
    chunkText: overrides.chunkText || 'This is a test chunk of text for embedding.',
    embedding: overrides.embedding || Array.from({ length: 1536 }, () => Math.random() * 2 - 1),
    metadata: overrides.metadata || { totalChunks: 1 },
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
  };
}

function createMockVendor(overrides = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    name: overrides.name || `Vendor ${id}`,
    email: overrides.email || `vendor${id}@test.com`,
    company: overrides.company || `Test Company ${id}`,
    phone: overrides.phone || '555-0100',
    category: overrides.category || 'IT',
    address: overrides.address || '123 Test St',
    notes: overrides.notes || null,
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
    update: jest.fn(async function(data) { Object.assign(this, data); return this; }),
    destroy: jest.fn(async () => {}),
  };
}

function createMockRfp(overrides = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    title: overrides.title || `Test RFP ${id}`,
    rawInput: overrides.rawInput || 'We need 100 laptops for our office.',
    structuredData: overrides.structuredData || {
      title: 'Office Laptop Procurement',
      items: [{ name: 'Laptop', quantity: 100, specifications: '16GB RAM, 512GB SSD' }],
      budget: { total: 150000, currency: 'USD' },
    },
    budget: overrides.budget || 150000,
    currency: overrides.currency || 'USD',
    deadline: overrides.deadline || null,
    deliveryDays: overrides.deliveryDays || 30,
    status: overrides.status || 'draft',
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
    vendors: overrides.vendors || [],
    proposals: overrides.proposals || [],
    comparisons: overrides.comparisons || [],
    update: jest.fn(async function(data) { Object.assign(this, data); return this; }),
    destroy: jest.fn(async () => {}),
  };
}

function createMockProposal(overrides = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    rfpId: overrides.rfpId || 1,
    vendorId: overrides.vendorId || 1,
    rawContent: 'rawContent' in overrides ? overrides.rawContent : 'We offer 100 Dell Latitude laptops at $1,200 each. Total: $120,000. Delivery in 15 business days.',
    sourceType: overrides.sourceType || 'manual',
    attachments: overrides.attachments || null,
    parsedData: overrides.parsedData || null,
    totalPrice: overrides.totalPrice || null,
    score: overrides.score || null,
    status: overrides.status || 'received',
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
    rfp: overrides.rfp || null,
    vendor: overrides.vendor || null,
    update: jest.fn(async function(data) { Object.assign(this, data); return this; }),
    destroy: jest.fn(async () => {}),
  };
}

function createMockOpenAIResponse(content) {
  return {
    choices: [
      {
        message: {
          content: typeof content === 'string' ? content : JSON.stringify(content),
        },
      },
    ],
  };
}

function createMockEmbeddingResponse(vectors) {
  return {
    data: vectors.map((v, i) => ({
      embedding: v || Array.from({ length: 1536 }, () => Math.random() * 2 - 1),
      index: i,
    })),
  };
}

function createMockUser(overrides = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    email: overrides.email || `user${id}@test.com`,
    passwordHash: overrides.passwordHash || '$2a$10$fakehash',
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    role: overrides.role || 'admin',
    status: overrides.status || 'active',
    lastLoginAt: overrides.lastLoginAt || null,
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
    update: jest.fn(async function(data) { Object.assign(this, data); return this; }),
    destroy: jest.fn(async () => {}),
  };
}

module.exports = {
  resetIds,
  createMockRfpDocument,
  createMockExtractedData,
  createMockGeneratedProposal,
  createMockProposalContent,
  createMockDocumentEmbedding,
  createMockVendor,
  createMockRfp,
  createMockProposal,
  createMockOpenAIResponse,
  createMockEmbeddingResponse,
  createMockUser,
};
