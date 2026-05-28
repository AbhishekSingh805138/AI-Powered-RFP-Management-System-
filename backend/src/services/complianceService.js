const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = 'gpt-4o-mini';

/**
 * AI Compliance Check: Compare RFP requirements against proposal content.
 * Returns detailed gap analysis.
 */
async function checkCompliance(rfpRequirements, proposalContent) {
  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a senior compliance analyst. Compare the RFP requirements against the proposal content and produce a detailed compliance gap analysis.

RFP REQUIREMENTS:
${JSON.stringify(rfpRequirements, null, 2)}

PROPOSAL CONTENT:
${typeof proposalContent === 'string' ? proposalContent : JSON.stringify(proposalContent, null, 2)}

Analyze every requirement and deliverable from the RFP. For each one, determine if the proposal adequately addresses it.

Return a JSON object with this exact structure:
{
  "overall_score": number 0-100,
  "overall_status": "compliant|partially_compliant|non_compliant",
  "summary": "2-3 sentence executive summary of compliance status",
  "statistics": {
    "total_requirements": number,
    "fully_addressed": number,
    "partially_addressed": number,
    "not_addressed": number,
    "risks_identified": number
  },
  "technical_compliance": [
    {
      "requirement_id": "TR-1 or generated ID",
      "requirement": "What the RFP requires",
      "status": "compliant|partial|missing|exceeds",
      "proposal_response": "What the proposal says about this (or 'Not addressed')",
      "gap_description": "What's missing or insufficient (null if fully compliant)",
      "recommendation": "Suggested action to close the gap (null if compliant)",
      "severity": "critical|major|minor|none"
    }
  ],
  "compliance_requirements": [
    {
      "requirement_id": "CR-1 or generated ID",
      "requirement": "Compliance/certification requirement",
      "mandatory": true/false,
      "status": "compliant|partial|missing",
      "evidence_in_proposal": "What evidence the proposal provides",
      "gap_description": "What's missing",
      "severity": "critical|major|minor|none"
    }
  ],
  "deliverable_compliance": [
    {
      "deliverable_id": "D-1 or generated ID",
      "deliverable": "Expected deliverable",
      "status": "addressed|partially_addressed|not_addressed",
      "proposal_coverage": "How the proposal covers this",
      "gap_description": "What's missing"
    }
  ],
  "budget_compliance": {
    "rfp_budget": "Budget stated in RFP",
    "proposal_cost": "Cost proposed",
    "status": "within_budget|over_budget|under_budget|unclear",
    "analysis": "Brief comparison"
  },
  "timeline_compliance": {
    "rfp_timeline": "Timeline from RFP",
    "proposal_timeline": "Timeline in proposal",
    "status": "meets_deadline|exceeds_deadline|unclear",
    "analysis": "Brief comparison"
  },
  "risks": [
    {
      "risk": "Description of compliance risk",
      "severity": "critical|major|minor",
      "affected_requirements": ["List of requirement IDs affected"],
      "recommendation": "How to mitigate"
    }
  ],
  "strengths": ["Things the proposal does particularly well"],
  "improvement_areas": ["Specific areas where the proposal should be strengthened"]
}

Be thorough and objective. Flag every gap, no matter how small. Severity levels:
- critical: Must be addressed before submission, could disqualify
- major: Significant gap that weakens the proposal
- minor: Small gap that should ideally be addressed
- none: Fully compliant, no action needed`,
      },
      {
        role: 'user',
        content: 'Perform a comprehensive compliance analysis of this proposal against the RFP requirements.',
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

module.exports = {
  checkCompliance,
};
