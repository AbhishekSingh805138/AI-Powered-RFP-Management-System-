/**
 * HTML email templates for notification system.
 * Each function returns { subject, html, text } for the given event.
 */

const BRAND_COLOR = '#4361ee';
const GRAY = '#64748b';

function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Calibri,Arial,sans-serif;background:#f5f7fa;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden;">
  <tr><td style="background:${BRAND_COLOR};padding:20px 32px;">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">RFP Management System</h1>
  </td></tr>
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px;">${title}</h2>
    ${bodyHtml}
  </td></tr>
  <tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:12px;color:${GRAY};">This is an automated notification from the RFP Management System.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function badge(text, color) {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:12px;background:${color};color:#fff;font-size:12px;font-weight:600;">${text}</span>`;
}

function button(text, url) {
  return `<p style="margin:20px 0;"><a href="${url}" style="display:inline-block;padding:10px 24px;background:${BRAND_COLOR};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">${text}</a></p>`;
}

// ── Template: RFP Sent to Vendor ─────────────────────────

function rfpSentToVendor({ vendorName, rfpTitle, rfpId, budget, deadline, items, appUrl }) {
  const refId = `RFP-${String(rfpId).padStart(4, '0')}`;
  const itemsHtml = (items || []).map((item) =>
    `<li style="padding:4px 0;">${item.quantity || 1}x ${item.name} — ${item.specifications || 'See details'}</li>`
  ).join('');

  const html = layout(`Request for Proposal: ${refId}`, `
    <p style="color:#1e293b;line-height:1.6;">Dear ${vendorName},</p>
    <p style="color:#1e293b;line-height:1.6;">We are inviting you to submit a proposal for the following procurement request:</p>
    <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:6px;margin:16px 0;">
      <tr><td style="color:${GRAY};font-size:13px;width:120px;">Reference</td><td style="font-weight:600;">${refId}</td></tr>
      <tr style="background:#f8fafc;"><td style="color:${GRAY};font-size:13px;">Title</td><td style="font-weight:600;">${rfpTitle}</td></tr>
      ${budget ? `<tr><td style="color:${GRAY};font-size:13px;">Budget</td><td style="font-weight:600;">$${Number(budget).toLocaleString()}</td></tr>` : ''}
      ${deadline ? `<tr style="background:#f8fafc;"><td style="color:${GRAY};font-size:13px;">Deadline</td><td style="font-weight:600;">${deadline}</td></tr>` : ''}
    </table>
    ${itemsHtml ? `<p style="font-weight:600;margin-bottom:8px;">Requirements:</p><ul style="padding-left:20px;color:#1e293b;">${itemsHtml}</ul>` : ''}
    <p style="color:#1e293b;line-height:1.6;">Please reply with your proposal including itemized pricing, delivery timeline, and terms.</p>
    ${appUrl ? button('View RFP Details', `${appUrl}/rfps/${rfpId}`) : ''}
    <p style="color:#1e293b;">Best regards,<br><strong>Procurement Team</strong></p>
  `);

  return {
    subject: `${refId}: ${rfpTitle} — Request for Proposal`,
    html,
    text: `Dear ${vendorName},\n\nWe are inviting you to submit a proposal for ${refId}: ${rfpTitle}.\n${budget ? `Budget: $${Number(budget).toLocaleString()}\n` : ''}${deadline ? `Deadline: ${deadline}\n` : ''}\nPlease reply with your proposal.\n\nBest regards,\nProcurement Team`,
  };
}

// ── Template: Proposal Received ──────────────────────────

function proposalReceived({ userName, vendorName, vendorCompany, rfpTitle, rfpId, proposalId, appUrl }) {
  const refId = `RFP-${String(rfpId).padStart(4, '0')}`;

  const html = layout('New Proposal Received', `
    <p style="color:#1e293b;line-height:1.6;">Hi ${userName},</p>
    <p style="color:#1e293b;line-height:1.6;">A new vendor proposal has been received for your RFP:</p>
    <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:6px;margin:16px 0;">
      <tr><td style="color:${GRAY};font-size:13px;width:120px;">RFP</td><td style="font-weight:600;">${refId}: ${rfpTitle}</td></tr>
      <tr style="background:#f8fafc;"><td style="color:${GRAY};font-size:13px;">Vendor</td><td style="font-weight:600;">${vendorName}${vendorCompany ? ` (${vendorCompany})` : ''}</td></tr>
      <tr><td style="color:${GRAY};font-size:13px;">Status</td><td>${badge('New', '#34d399')}</td></tr>
    </table>
    ${appUrl && proposalId ? button('View Proposal', `${appUrl}/rfps/${rfpId}`) : ''}
  `);

  return {
    subject: `New proposal from ${vendorName} for ${refId}`,
    html,
    text: `Hi ${userName},\n\nA new proposal has been received from ${vendorName} for ${refId}: ${rfpTitle}.\n\nLog in to review it.`,
  };
}

// ── Template: RFP Status Changed ─────────────────────────

function rfpStatusChanged({ recipientName, rfpTitle, rfpId, oldStatus, newStatus, appUrl }) {
  const refId = `RFP-${String(rfpId).padStart(4, '0')}`;
  const statusColors = { draft: '#94a3b8', published: '#60a5fa', sent: '#818cf8', evaluating: '#fbbf24', awarded: '#34d399', closed: '#f87171' };

  const html = layout('RFP Status Update', `
    <p style="color:#1e293b;line-height:1.6;">Hi ${recipientName},</p>
    <p style="color:#1e293b;line-height:1.6;">The status of <strong>${refId}: ${rfpTitle}</strong> has been updated:</p>
    <div style="margin:20px 0;text-align:center;">
      ${badge(oldStatus, statusColors[oldStatus] || '#94a3b8')}
      <span style="margin:0 12px;color:${GRAY};font-size:18px;">&rarr;</span>
      ${badge(newStatus, statusColors[newStatus] || '#94a3b8')}
    </div>
    ${appUrl ? button('View RFP', `${appUrl}/rfps/${rfpId}`) : ''}
  `);

  return {
    subject: `${refId} status changed to ${newStatus}`,
    html,
    text: `Hi ${recipientName},\n\n${refId}: ${rfpTitle} status has changed from "${oldStatus}" to "${newStatus}".`,
  };
}

// ── Template: Risk Analysis Complete ─────────────────────

function riskAnalysisComplete({ userName, rfpTitle, rfpDocumentId, riskLevel, riskScore, appUrl }) {
  const levelColors = { low: '#34d399', medium: '#fbbf24', high: '#fb923c', critical: '#f87171' };

  const html = layout('Risk Analysis Complete', `
    <p style="color:#1e293b;line-height:1.6;">Hi ${userName},</p>
    <p style="color:#1e293b;line-height:1.6;">The risk analysis for <strong>${rfpTitle}</strong> is complete:</p>
    <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:6px;margin:16px 0;">
      <tr><td style="color:${GRAY};font-size:13px;width:120px;">Risk Level</td><td>${badge(riskLevel, levelColors[riskLevel] || '#94a3b8')}</td></tr>
      <tr style="background:#f8fafc;"><td style="color:${GRAY};font-size:13px;">Risk Score</td><td style="font-weight:600;">${riskScore}/100</td></tr>
    </table>
    ${appUrl ? button('View Full Report', `${appUrl}/risk-analyzer`) : ''}
  `);

  return {
    subject: `Risk analysis complete for ${rfpTitle} — ${riskLevel} risk`,
    html,
    text: `Hi ${userName},\n\nRisk analysis for "${rfpTitle}" is complete.\nRisk Level: ${riskLevel}\nRisk Score: ${riskScore}/100`,
  };
}

// ── Template: Extraction Complete ────────────────────────

function extractionComplete({ userName, documentTitle, documentId, requirementCount, appUrl }) {
  const html = layout('RFP Analysis Complete', `
    <p style="color:#1e293b;line-height:1.6;">Hi ${userName},</p>
    <p style="color:#1e293b;line-height:1.6;">AI has finished analyzing your RFP document:</p>
    <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:6px;margin:16px 0;">
      <tr><td style="color:${GRAY};font-size:13px;width:120px;">Document</td><td style="font-weight:600;">${documentTitle}</td></tr>
      <tr style="background:#f8fafc;"><td style="color:${GRAY};font-size:13px;">Requirements</td><td style="font-weight:600;">${requirementCount} extracted</td></tr>
      <tr><td style="color:${GRAY};font-size:13px;">Status</td><td>${badge('Ready', '#34d399')}</td></tr>
    </table>
    ${appUrl ? button('View Analysis', `${appUrl}/rfp-analyzer/${documentId}`) : ''}
  `);

  return {
    subject: `RFP analysis complete: ${documentTitle}`,
    html,
    text: `Hi ${userName},\n\nYour RFP "${documentTitle}" has been analyzed. ${requirementCount} requirements extracted.\n\nLog in to view the analysis.`,
  };
}

module.exports = {
  rfpSentToVendor,
  proposalReceived,
  rfpStatusChanged,
  riskAnalysisComplete,
  extractionComplete,
};
