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

module.exports = {
  parseRfpFromNaturalLanguage,
  parseVendorProposal,
  compareProposals,
};
