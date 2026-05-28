const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = 'gpt-4o-mini';

/**
 * Analyze risks in an RFP document, optionally comparing against a generated proposal.
 * Returns a structured multi-category risk assessment with a risk matrix.
 */
async function analyzeRisks(rfpDocument, generatedProposal = null) {
  const rfpContext = rfpDocument.extractedData || {};
  const proposalContext = generatedProposal
    ? (typeof generatedProposal.proposalContent === 'string'
      ? generatedProposal.proposalContent
      : JSON.stringify(generatedProposal.proposalContent, null, 2))
    : null;

  const proposalSection = proposalContext
    ? `\n\nPROPOSAL CONTENT:\n${proposalContext}`
    : '\n\nNo proposal provided — analyze inherent risks in the RFP requirements themselves.';

  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a senior risk analyst specializing in RFP/proposal risk assessment. Analyze the RFP requirements${proposalContext ? ' against the proposal' : ''} and produce a comprehensive risk assessment across multiple categories.

RFP REQUIREMENTS:
${JSON.stringify(rfpContext, null, 2)}${proposalSection}

Return a JSON object with this exact structure:
{
  "overall_risk_score": number 0-100 (higher = riskier),
  "overall_risk_level": "low|medium|high|critical",
  "executive_summary": "2-3 sentence summary of the risk landscape",
  "categories": [
    {
      "name": "technical|financial|compliance|timeline|resource|scope",
      "score": number 0-100,
      "level": "low|medium|high|critical",
      "description": "Brief summary of risks in this category",
      "risks": [
        {
          "id": "RISK-001",
          "title": "Short risk title",
          "description": "Detailed description of the risk",
          "severity": "critical|high|medium|low",
          "likelihood": "very_likely|likely|possible|unlikely",
          "impact": "catastrophic|major|moderate|minor",
          "affected_requirements": ["TR-1", "CR-2"],
          "mitigation": "Recommended mitigation strategy",
          "contingency": "Fallback plan if risk materializes"
        }
      ]
    }
  ],
  "risk_matrix": [
    {
      "risk_id": "RISK-001",
      "title": "Short title",
      "severity": "critical|high|medium|low",
      "likelihood": "very_likely|likely|possible|unlikely",
      "category": "technical|financial|compliance|timeline|resource|scope"
    }
  ],
  "top_risks": ["RISK-001", "RISK-003"],
  "recommendations": [
    {
      "priority": "immediate|short_term|long_term",
      "action": "Specific recommended action",
      "addresses_risks": ["RISK-001"],
      "expected_impact": "How this action reduces risk"
    }
  ],
  "strengths": ["Areas where risk is well-managed or low"],
  "watch_items": ["Things that aren't risks yet but should be monitored"]
}

Analyze ALL six categories (technical, financial, compliance, timeline, resource, scope). Be thorough and specific. Every risk must have a clear mitigation strategy.`,
      },
      {
        role: 'user',
        content: 'Perform a comprehensive risk analysis across all categories.',
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Compare risk profiles across multiple risk analyses.
 */
async function compareRiskProfiles(analyses) {
  const profiles = analyses.map((a) => ({
    id: a.id,
    rfpDocumentId: a.rfpDocumentId,
    generatedProposalId: a.generatedProposalId,
    overallRiskScore: a.overallRiskScore,
    overallRiskLevel: a.overallRiskLevel,
    analysisData: a.analysisData,
  }));

  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a senior risk analyst. Compare the following risk profiles and identify patterns, common risks, and divergences.

RISK PROFILES:
${JSON.stringify(profiles, null, 2)}

Return a JSON object with this structure:
{
  "summary": "Executive summary of the comparison",
  "common_risks": [
    {
      "risk_title": "Risk that appears across multiple analyses",
      "frequency": number,
      "average_severity": "critical|high|medium|low",
      "analysis_ids": [1, 2]
    }
  ],
  "divergent_risks": [
    {
      "risk_title": "Risk unique to one analysis",
      "analysis_id": number,
      "severity": "critical|high|medium|low",
      "explanation": "Why this risk is unique to this analysis"
    }
  ],
  "category_comparison": [
    {
      "category": "technical|financial|compliance|timeline|resource|scope",
      "scores": [{"analysis_id": 1, "score": 45}],
      "trend": "Observation about this category across analyses"
    }
  ],
  "recommendation": "Overall recommendation based on the comparison"
}`,
      },
      {
        role: 'user',
        content: 'Compare these risk profiles and identify patterns.',
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

module.exports = {
  analyzeRisks,
  compareRiskProfiles,
};
