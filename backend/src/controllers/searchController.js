const { RfpDocument, GeneratedProposal, Proposal, Rfp } = require('../models');
const { Op } = require('sequelize');
const embeddingService = require('../services/embeddingService');
const searchService = require('../services/searchService');

// POST /api/search — RAG semantic search
async function search(req, res, next) {
  try {
    const { query, topK, filterSourceType } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await searchService.ragSearch(query, {
      topK: topK || 8,
      filterSourceType: filterSourceType || null,
    });

    res.json(results);
  } catch (err) {
    next(err);
  }
}

// POST /api/search/index/:sourceType/:sourceId — Index a specific document
async function indexDocument(req, res, next) {
  try {
    const { sourceType, sourceId } = req.params;
    const id = parseInt(sourceId, 10);

    let text = '';
    let title = '';
    let metadata = {};

    switch (sourceType) {
      case 'rfp_document': {
        const doc = await RfpDocument.findByPk(id);
        if (!doc) return res.status(404).json({ error: 'RFP Document not found' });
        text = doc.rawText || '';
        title = doc.title || doc.originalFilename;
        metadata = { filename: doc.originalFilename };
        break;
      }
      case 'generated_proposal': {
        const gp = await GeneratedProposal.findByPk(id, {
          include: [{ model: RfpDocument, as: 'rfpDocument' }],
        });
        if (!gp) return res.status(404).json({ error: 'Generated Proposal not found' });
        // Flatten proposal content to text
        text = flattenProposalContent(gp.proposalContent);
        title = gp.title || `Generated Proposal v${gp.version}`;
        metadata = { rfpDocumentId: gp.rfpDocumentId, version: gp.version };
        break;
      }
      case 'proposal': {
        const prop = await Proposal.findByPk(id);
        if (!prop) return res.status(404).json({ error: 'Proposal not found' });
        text = prop.rawContent || '';
        if (prop.parsedData) {
          text += '\n\n' + JSON.stringify(prop.parsedData, null, 2);
        }
        title = `Vendor Proposal #${id}`;
        metadata = { rfpId: prop.rfpId, vendorId: prop.vendorId };
        break;
      }
      case 'rfp': {
        const rfp = await Rfp.findByPk(id);
        if (!rfp) return res.status(404).json({ error: 'RFP not found' });
        text = rfp.rawInput || '';
        if (rfp.structuredData) {
          text += '\n\n' + JSON.stringify(rfp.structuredData, null, 2);
        }
        title = rfp.title;
        metadata = { status: rfp.status };
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid sourceType. Use: rfp_document, generated_proposal, proposal, rfp' });
    }

    const result = await embeddingService.indexDocument(sourceType, id, text, title, metadata);
    res.json({ message: 'Document indexed successfully', ...result });
  } catch (err) {
    next(err);
  }
}

// POST /api/search/index-all — Index all documents in the system
async function indexAll(req, res, next) {
  try {
    const results = { rfp_documents: 0, generated_proposals: 0, proposals: 0, rfps: 0, errors: [] };

    // Index RFP Documents
    const rfpDocs = await RfpDocument.findAll({ where: { status: 'extracted' } });
    for (const doc of rfpDocs) {
      try {
        await embeddingService.indexDocument('rfp_document', doc.id, doc.rawText, doc.title || doc.originalFilename, { filename: doc.originalFilename });
        results.rfp_documents++;
      } catch (err) {
        results.errors.push({ type: 'rfp_document', id: doc.id, error: err.message });
      }
    }

    // Index Generated Proposals
    const genProposals = await GeneratedProposal.findAll({ where: { status: { [Op.in]: ['generated', 'edited', 'finalized'] } } });
    for (const gp of genProposals) {
      try {
        const text = flattenProposalContent(gp.proposalContent);
        await embeddingService.indexDocument('generated_proposal', gp.id, text, gp.title || `Proposal v${gp.version}`, { rfpDocumentId: gp.rfpDocumentId });
        results.generated_proposals++;
      } catch (err) {
        results.errors.push({ type: 'generated_proposal', id: gp.id, error: err.message });
      }
    }

    // Index Vendor Proposals
    const proposals = await Proposal.findAll({ where: { status: 'parsed' } });
    for (const prop of proposals) {
      try {
        let text = prop.rawContent || '';
        if (prop.parsedData) text += '\n\n' + JSON.stringify(prop.parsedData, null, 2);
        await embeddingService.indexDocument('proposal', prop.id, text, `Vendor Proposal #${prop.id}`, { rfpId: prop.rfpId });
        results.proposals++;
      } catch (err) {
        results.errors.push({ type: 'proposal', id: prop.id, error: err.message });
      }
    }

    // Index RFPs
    const rfps = await Rfp.findAll();
    for (const rfp of rfps) {
      try {
        let text = rfp.rawInput || '';
        if (rfp.structuredData) text += '\n\n' + JSON.stringify(rfp.structuredData, null, 2);
        await embeddingService.indexDocument('rfp', rfp.id, text, rfp.title, { status: rfp.status });
        results.rfps++;
      } catch (err) {
        results.errors.push({ type: 'rfp', id: rfp.id, error: err.message });
      }
    }

    res.json({
      message: 'Indexing complete',
      indexed: results.rfp_documents + results.generated_proposals + results.proposals + results.rfps,
      details: results,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/search/stats — Get embedding index statistics
async function getStats(req, res, next) {
  try {
    const stats = await embeddingService.getIndexStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

/**
 * Flatten a generated proposal's JSON content into readable text for embedding.
 */
function flattenProposalContent(content) {
  if (!content) return '';

  const sections = [];

  if (content.title) sections.push(`Title: ${content.title}`);
  if (content.executive_summary) sections.push(`Executive Summary:\n${content.executive_summary}`);
  if (content.understanding_of_requirements) sections.push(`Understanding of Requirements:\n${content.understanding_of_requirements}`);

  if (content.technical_approach) {
    let tech = 'Technical Approach:\n';
    if (content.technical_approach.overview) tech += content.technical_approach.overview + '\n';
    if (content.technical_approach.methodology) tech += 'Methodology: ' + content.technical_approach.methodology + '\n';
    if (content.technical_approach.solution_components) {
      content.technical_approach.solution_components.forEach((c) => {
        tech += `\n${c.component}: ${c.description}`;
      });
    }
    sections.push(tech);
  }

  if (content.scope_of_work) {
    const scope = content.scope_of_work.map((p) =>
      `Phase: ${p.phase} (${p.duration || 'TBD'})\n${p.description}\nActivities: ${(p.activities || []).join(', ')}\nDeliverables: ${(p.deliverables || []).join(', ')}`
    ).join('\n\n');
    sections.push(`Scope of Work:\n${scope}`);
  }

  if (content.cost_breakdown) {
    let cost = 'Cost Breakdown:\n';
    if (content.cost_breakdown.line_items) {
      content.cost_breakdown.line_items.forEach((item) => {
        cost += `${item.item} (${item.category}): ${item.estimated_cost}\n`;
      });
    }
    if (content.cost_breakdown.total_estimated_cost) cost += `Total: ${content.cost_breakdown.total_estimated_cost}`;
    sections.push(cost);
  }

  if (content.past_performance) sections.push(`Past Performance:\n${content.past_performance}`);
  if (content.terms_and_conditions) sections.push(`Terms:\n${content.terms_and_conditions}`);

  return sections.join('\n\n');
}

module.exports = {
  search,
  indexDocument,
  indexAll,
  getStats,
};
