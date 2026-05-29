const { Rfp, Vendor, Proposal, RfpDocument, RiskAnalysis, ChatConversation } = require('../models');

// GET /api/analytics — Aggregated dashboard analytics
async function getAnalytics(req, res, next) {
  try {
    const isAdmin = req.user.role === 'admin';
    const userFilter = isAdmin ? {} : { userId: req.user.id };
    const userFilterSnake = isAdmin ? {} : { user_id: req.user.id };

    // Run all queries in parallel
    // Proposals belong to RFPs (scoped via rfpId), RiskAnalyses belong to RfpDocuments (scoped via rfpDocumentId)
    const proposalInclude = isAdmin ? [] : [{ model: Rfp, as: 'rfp', attributes: [], where: userFilter, required: true }];
    const riskInclude = isAdmin ? [] : [{ model: RfpDocument, as: 'rfpDocument', attributes: [], where: userFilterSnake, required: true }];

    const [rfps, vendors, proposals, documents, riskAnalyses, conversations] = await Promise.all([
      Rfp.findAll({ where: userFilter, attributes: ['id', 'status', 'budget', 'createdAt'] }),
      Vendor.findAll({ where: userFilter, attributes: ['id', 'createdAt'] }),
      Proposal.findAll({ attributes: ['id', 'status', 'totalPrice', 'score', 'sourceType', 'createdAt'], include: proposalInclude }),
      RfpDocument.findAll({ where: userFilterSnake, attributes: ['id', 'status', 'createdAt'] }),
      RiskAnalysis.findAll({ attributes: ['id', 'overallRiskLevel', 'overallRiskScore', 'status', 'createdAt'], include: riskInclude }),
      ChatConversation.findAll({ where: userFilterSnake, attributes: ['id', 'createdAt'] }),
    ]);

    // RFP status breakdown
    const rfpStatusCounts = {};
    for (const rfp of rfps) {
      rfpStatusCounts[rfp.status] = (rfpStatusCounts[rfp.status] || 0) + 1;
    }

    // Risk level distribution
    const riskLevelCounts = { low: 0, medium: 0, high: 0, critical: 0 };
    const completedRisks = riskAnalyses.filter((r) => r.status === 'completed');
    for (const risk of completedRisks) {
      if (risk.overallRiskLevel && riskLevelCounts[risk.overallRiskLevel] !== undefined) {
        riskLevelCounts[risk.overallRiskLevel]++;
      }
    }

    // Proposal source breakdown
    const proposalSourceCounts = {};
    for (const p of proposals) {
      const src = p.sourceType || 'unknown';
      proposalSourceCounts[src] = (proposalSourceCounts[src] || 0) + 1;
    }

    // Activity timeline — last 30 days, grouped by day
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activityByDay = {};
    const addToDay = (items, key) => {
      for (const item of items) {
        const d = new Date(item.createdAt);
        if (d >= thirtyDaysAgo) {
          const dayStr = d.toISOString().slice(0, 10);
          if (!activityByDay[dayStr]) activityByDay[dayStr] = { date: dayStr, rfps: 0, documents: 0, proposals: 0, risks: 0 };
          activityByDay[dayStr][key]++;
        }
      }
    };

    addToDay(rfps, 'rfps');
    addToDay(documents, 'documents');
    addToDay(proposals, 'proposals');
    addToDay(riskAnalyses, 'risks');

    // Fill in missing days for a smooth chart
    const timeline = [];
    const cursor = new Date(thirtyDaysAgo);
    const today = new Date();
    while (cursor <= today) {
      const dayStr = cursor.toISOString().slice(0, 10);
      timeline.push(activityByDay[dayStr] || { date: dayStr, rfps: 0, documents: 0, proposals: 0, risks: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Budget stats
    const budgetedRfps = rfps.filter((r) => r.budget && r.budget > 0);
    const totalBudget = budgetedRfps.reduce((sum, r) => sum + Number(r.budget), 0);
    const avgBudget = budgetedRfps.length > 0 ? totalBudget / budgetedRfps.length : 0;

    // Proposal scores
    const scoredProposals = proposals.filter((p) => p.score != null && p.score > 0);
    const avgScore = scoredProposals.length > 0
      ? scoredProposals.reduce((sum, p) => sum + Number(p.score), 0) / scoredProposals.length
      : 0;

    // Document analysis status
    const docStatusCounts = {};
    for (const doc of documents) {
      docStatusCounts[doc.status] = (docStatusCounts[doc.status] || 0) + 1;
    }

    res.json({
      summary: {
        totalRfps: rfps.length,
        totalVendors: vendors.length,
        totalProposals: proposals.length,
        analyzedDocuments: documents.filter((d) => d.status === 'extracted').length,
        riskAnalyses: riskAnalyses.length,
        chatConversations: conversations.length,
        totalBudget: Math.round(totalBudget),
        avgBudget: Math.round(avgBudget),
        avgProposalScore: Math.round(avgScore * 10) / 10,
      },
      charts: {
        rfpStatusBreakdown: Object.entries(rfpStatusCounts).map(([name, value]) => ({ name, value })),
        riskLevelDistribution: Object.entries(riskLevelCounts).map(([name, value]) => ({ name, value })),
        proposalSources: Object.entries(proposalSourceCounts).map(([name, value]) => ({ name, value })),
        documentStatus: Object.entries(docStatusCounts).map(([name, value]) => ({ name, value })),
        activityTimeline: timeline,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAnalytics };
