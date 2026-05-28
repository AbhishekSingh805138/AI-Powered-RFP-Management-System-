const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = 'gpt-4o-mini';

/**
 * Convert natural language RFP description into structured data.
 */
async function parseRfpFromNaturalLanguage(naturalLanguageInput) {
  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a procurement specialist AI. Parse natural language procurement requests into structured RFP data.

Return a JSON object with this exact structure:
{
  "title": "Short descriptive title for this RFP",
  "items": [
    {
      "name": "Item name",
      "quantity": number,
      "specifications": "Detailed specs",
      "estimatedUnitPrice": number or null
    }
  ],
  "budget": {
    "total": number or null,
    "currency": "USD"
  },
  "timeline": {
    "deliveryDays": number or null,
    "deadline": "ISO date string or null"
  },
  "terms": {
    "paymentTerms": "e.g. Net 30",
    "warranty": "e.g. 1 year",
    "otherTerms": ["any additional terms"]
  },
  "requirements": ["list of key requirements extracted"],
  "evaluationCriteria": ["price", "quality", "delivery_time", "warranty", "compliance"]
}

Extract as much information as possible. Use null for unknown fields. Do not invent data.`,
      },
      {
        role: 'user',
        content: naturalLanguageInput,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Parse a vendor's proposal (email body / extracted PDF text) into structured data.
 */
async function parseVendorProposal(proposalText, rfpContext) {
  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a procurement analyst AI. Parse vendor proposal responses into structured data.

The original RFP requested:
${JSON.stringify(rfpContext, null, 2)}

Extract the vendor's response into this JSON structure:
{
  "vendorName": "Name if mentioned",
  "lineItems": [
    {
      "itemName": "Item name matching RFP items",
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number,
      "specifications": "What the vendor is offering",
      "meetsRequirements": true/false,
      "notes": "Any deviations or extras"
    }
  ],
  "totalPrice": number,
  "currency": "USD",
  "deliveryTimeline": "Stated delivery timeline",
  "deliveryDays": number or null,
  "paymentTerms": "Stated payment terms",
  "warranty": "Stated warranty terms",
  "additionalTerms": ["Any other terms or conditions"],
  "strengths": ["Notable strengths of this proposal"],
  "weaknesses": ["Notable weaknesses or gaps"],
  "complianceScore": number 0-100,
  "notes": "Any additional observations"
}

Parse carefully. If information is ambiguous, note it. Use null for genuinely missing fields.`,
      },
      {
        role: 'user',
        content: proposalText,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Compare multiple vendor proposals and produce a recommendation.
 */
async function compareProposals(rfpData, proposals) {
  const proposalSummaries = proposals.map((p) => ({
    vendorId: p.vendorId,
    vendorName: p.vendorName,
    parsedData: p.parsedData,
    totalPrice: p.totalPrice,
  }));

  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a senior procurement analyst. Compare vendor proposals for an RFP and provide a detailed recommendation.

Original RFP:
${JSON.stringify(rfpData, null, 2)}

Evaluate each proposal on these criteria (score 0-100 each):
- price_competitiveness: How competitive is the pricing?
- specification_compliance: Do they meet all technical requirements?
- delivery_timeline: Can they deliver on time?
- payment_terms: Are payment terms favorable?
- warranty_coverage: Is warranty adequate?
- overall_value: Best overall value considering all factors?

Return this JSON structure:
{
  "vendorScores": [
    {
      "vendorId": number,
      "vendorName": "string",
      "scores": {
        "price_competitiveness": number,
        "specification_compliance": number,
        "delivery_timeline": number,
        "payment_terms": number,
        "warranty_coverage": number,
        "overall_value": number
      },
      "totalScore": number (weighted average),
      "strengths": ["list"],
      "weaknesses": ["list"],
      "risks": ["list"]
    }
  ],
  "recommendation": {
    "vendorId": number,
    "vendorName": "string",
    "confidence": "high/medium/low",
    "reasoning": "Detailed explanation of why this vendor is recommended",
    "caveats": ["Any concerns or conditions"]
  },
  "comparisonMatrix": {
    "criteria": ["price_competitiveness", "specification_compliance", "delivery_timeline", "payment_terms", "warranty_coverage", "overall_value"],
    "weights": {"price_competitiveness": 0.25, "specification_compliance": 0.25, "delivery_timeline": 0.15, "payment_terms": 0.10, "warranty_coverage": 0.10, "overall_value": 0.15}
  },
  "summary": "2-3 paragraph executive summary of the comparison and recommendation"
}

Be objective and thorough. Justify every score.`,
      },
      {
        role: 'user',
        content: JSON.stringify(proposalSummaries, null, 2),
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Extract structured requirements from an uploaded RFP document's text.
 */
async function extractRequirements(documentText) {
  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a senior RFP analyst. Analyze the uploaded RFP document and extract all key information into a structured format.

Return a JSON object with this exact structure:
{
  "title": "Extracted RFP title",
  "issuing_organization": "Organization that issued this RFP",
  "rfp_number": "RFP reference number if mentioned, or null",
  "summary": "2-3 sentence summary of what this RFP is requesting",
  "submission_deadline": "ISO date string or null",
  "project_start_date": "ISO date string or null",
  "project_end_date": "ISO date string or null",
  "budget_info": {
    "estimated_budget": number or null,
    "currency": "USD",
    "budget_notes": "Any budget constraints or notes"
  },
  "technical_requirements": [
    {
      "id": "TR-1",
      "category": "e.g. Infrastructure, Software, Security, Integration",
      "requirement": "Description of the requirement",
      "priority": "mandatory|preferred|optional",
      "details": "Additional details or specifications"
    }
  ],
  "compliance_requirements": [
    {
      "id": "CR-1",
      "type": "e.g. Certification, Regulation, Standard, Insurance",
      "requirement": "Description",
      "mandatory": true/false
    }
  ],
  "deliverables": [
    {
      "id": "D-1",
      "deliverable": "Description of the deliverable",
      "due_date": "ISO date or relative timeline or null",
      "acceptance_criteria": "How this will be evaluated"
    }
  ],
  "evaluation_criteria": [
    {
      "criterion": "e.g. Technical Approach, Cost, Experience",
      "weight_percentage": number or null,
      "description": "What evaluators are looking for"
    }
  ],
  "submission_instructions": {
    "format": "e.g. PDF, hard copy, online portal",
    "page_limit": number or null,
    "required_sections": ["List of sections the proposal must include"],
    "contact_info": "Point of contact for questions"
  },
  "key_dates": [
    {
      "event": "e.g. Questions deadline, Site visit, Proposal due",
      "date": "ISO date string or description"
    }
  ],
  "special_conditions": ["Any special terms, conditions, or notes worth highlighting"],
  "risks_identified": [
    {
      "risk": "Description of potential risk",
      "severity": "high|medium|low",
      "mitigation": "Suggested approach"
    }
  ]
}

Extract as much information as possible from the document. Use null for fields that are genuinely not present. Do not invent data. If the document is unclear on a point, note that in the relevant details field.`,
      },
      {
        role: 'user',
        content: documentText,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Generate a complete proposal draft based on extracted RFP requirements and company profile.
 */
async function generateProposal(extractedRequirements, companyProfile) {
  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a senior proposal writer. Generate a comprehensive, professional proposal in response to an RFP.

RFP Requirements:
${JSON.stringify(extractedRequirements, null, 2)}

Company Profile:
${JSON.stringify(companyProfile, null, 2)}

Generate a complete proposal with this JSON structure:
{
  "title": "Proposal title (Response to [RFP Title])",
  "executive_summary": "3-4 paragraph executive summary highlighting understanding of needs, proposed approach, key differentiators, and value proposition. Make it compelling and specific to the RFP.",
  "understanding_of_requirements": "2-3 paragraphs demonstrating deep understanding of the client's needs and objectives as stated in the RFP.",
  "technical_approach": {
    "overview": "High-level description of the proposed solution",
    "methodology": "Methodology or framework to be used",
    "solution_components": [
      {
        "component": "Component name",
        "description": "What it does and how it addresses the requirement",
        "technologies": ["Relevant technologies or tools"]
      }
    ],
    "innovation": "Any innovative approaches or added value"
  },
  "scope_of_work": [
    {
      "phase": "Phase name (e.g. Discovery, Implementation, Testing)",
      "description": "What this phase covers",
      "activities": ["Key activities in this phase"],
      "deliverables": ["Deliverables produced in this phase"],
      "duration": "Estimated duration"
    }
  ],
  "timeline": {
    "total_duration": "Total project duration",
    "milestones": [
      {
        "milestone": "Milestone name",
        "target_date": "Relative or absolute date",
        "deliverables": ["Associated deliverables"]
      }
    ]
  },
  "team_composition": [
    {
      "role": "Role title",
      "responsibilities": "Key responsibilities",
      "qualifications": "Required qualifications"
    }
  ],
  "cost_breakdown": {
    "summary": "Cost approach overview",
    "line_items": [
      {
        "item": "Cost item description",
        "category": "e.g. Labor, Software, Infrastructure, Travel",
        "estimated_cost": "Cost figure or range",
        "notes": "Assumptions or clarifications"
      }
    ],
    "total_estimated_cost": "Total cost or range",
    "payment_schedule": "Proposed payment terms",
    "assumptions": ["Key pricing assumptions"]
  },
  "compliance_matrix": [
    {
      "requirement_id": "From RFP (e.g. TR-1, CR-1)",
      "requirement_summary": "Brief description",
      "compliance_status": "compliant|partial|proposed_alternative",
      "response": "How the company meets this requirement"
    }
  ],
  "risk_mitigation": [
    {
      "risk": "Identified risk",
      "impact": "high|medium|low",
      "mitigation_strategy": "How it will be addressed"
    }
  ],
  "differentiators": ["Key reasons why the client should choose this company"],
  "past_performance": "Brief description of relevant past projects or experience (based on company profile)",
  "terms_and_conditions": "Standard terms including warranty, support, IP, confidentiality"
}

Write in a professional, confident tone. Be specific — avoid generic filler. Tailor every section to the actual RFP requirements. If the company profile is limited, write reasonable placeholders that the user can customize.`,
      },
      {
        role: 'user',
        content: `Generate a winning proposal for this RFP. The proposal should directly address every requirement and position the company as the strongest candidate.`,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

module.exports = {
  parseRfpFromNaturalLanguage,
  parseVendorProposal,
  compareProposals,
  extractRequirements,
  generateProposal,
};
