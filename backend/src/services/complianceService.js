const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const AI_TIMEOUT = parseInt(process.env.AI_TIMEOUT_MS, 10) || 60000;
const MAX_INPUT_LENGTH = parseInt(process.env.AI_MAX_INPUT_LENGTH, 10) || 100000;

/**
 * Wrapper for OpenAI chat completion with timeout and error handling.
 */
async function createChatCompletion(params, context) {
  try {
    const response = await openai.chat.completions.create(params, {
      timeout: AI_TIMEOUT,
    });

    if (!response.choices || response.choices.length === 0) {
      const err = new Error(`AI returned no choices during ${context}`);
      err.status = 502;
      throw err;
    }

    return response.choices[0].message.content;
  } catch (err) {
    if (err.status === 502) throw err;

    if (err.code === 'ETIMEDOUT' || err.type === 'request-timeout' || err.message?.includes('timeout')) {
      const timeoutErr = new Error(`AI request timed out during ${context} (limit: ${AI_TIMEOUT}ms)`);
      timeoutErr.status = 504;
      throw timeoutErr;
    }

    if (err.status === 429) {
      const rateLimitErr = new Error('AI rate limit exceeded. Please try again later.');
      rateLimitErr.status = 429;
      throw rateLimitErr;
    }

    if (err.status >= 500) {
      const upstreamErr = new Error(`AI service unavailable during ${context}`);
      upstreamErr.status = 502;
      throw upstreamErr;
    }

    const wrappedErr = new Error(`AI request failed during ${context}: ${err.message}`);
    wrappedErr.status = err.status || 500;
    throw wrappedErr;
  }
}

/**
 * Safely parse JSON from OpenAI response with fallback error.
 */
function safeParseJSON(content, context) {
  if (!content) {
    const err = new Error(`AI returned empty response during ${context}`);
    err.status = 502;
    throw err;
  }
  try {
    return JSON.parse(content);
  } catch (parseErr) {
    const err = new Error(`AI returned invalid JSON during ${context}: ${parseErr.message}`);
    err.status = 502;
    throw err;
  }
}

/**
 * Truncate input text to stay within token-safe limits.
 */
function truncateInput(text, maxLength = MAX_INPUT_LENGTH) {
  if (!text) return '';
  if (typeof text !== 'string') text = JSON.stringify(text, null, 2);
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '\n\n[...truncated due to length]';
}

/**
 * AI Compliance Check: Compare RFP requirements against proposal content.
 * Returns detailed gap analysis.
 */
async function checkCompliance(rfpRequirements, proposalContent) {
  const rfpInput = truncateInput(JSON.stringify(rfpRequirements, null, 2));
  const proposalInput = truncateInput(
    typeof proposalContent === 'string' ? proposalContent : JSON.stringify(proposalContent, null, 2)
  );

  const content = await createChatCompletion({
    model: MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a senior compliance analyst. Compare the RFP requirements against the proposal content and produce a detailed compliance gap analysis.

RFP REQUIREMENTS:
${rfpInput}

PROPOSAL CONTENT:
${proposalInput}

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
  }, 'compliance check');

  return safeParseJSON(content, 'compliance check');
}

module.exports = {
  checkCompliance,
};
