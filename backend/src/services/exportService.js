const PDFDocument = require('pdfkit');
const docx = require('docx');

const COLORS = {
  primary: '#2563eb',
  dark: '#1e293b',
  gray: '#64748b',
  lightGray: '#e2e8f0',
  white: '#ffffff',
};

// ── PDF Generation ─────────────────────────────────────────

function generatePdf(proposal) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 50, right: 50 },
        bufferPages: true,
        info: {
          Title: proposal.title || 'Generated Proposal',
          Author: proposal.companyProfile?.company_name || 'RFP Management System',
          Subject: 'RFP Proposal',
        },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const content = proposal.proposalContent || {};
      const company = proposal.companyProfile || {};
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // ── Title Page ──
      doc.moveDown(6);
      doc.fontSize(28).font('Helvetica-Bold').fillColor(COLORS.primary)
        .text(content.title || proposal.title || 'Proposal', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(14).font('Helvetica').fillColor(COLORS.gray)
        .text(`Prepared by ${company.company_name || 'N/A'}`, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(11).text(new Date(proposal.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      }), { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`Version ${proposal.version || 1}`, { align: 'center' });

      if (company.industry || company.expertise) {
        doc.moveDown(2);
        doc.fontSize(10).fillColor(COLORS.gray);
        if (company.industry) doc.text(`Industry: ${company.industry}`, { align: 'center' });
        if (company.expertise) doc.text(`Expertise: ${company.expertise}`, { align: 'center' });
      }

      // ── Content Sections ──
      const sections = [
        { title: 'Executive Summary', key: 'executive_summary', type: 'text' },
        { title: 'Understanding of Requirements', key: 'understanding_of_requirements', type: 'text' },
        { title: 'Technical Approach', key: 'technical_approach', type: 'technical' },
        { title: 'Scope of Work', key: 'scope_of_work', type: 'scope' },
        { title: 'Timeline & Milestones', key: 'timeline', type: 'timeline' },
        { title: 'Team Composition', key: 'team_composition', type: 'team' },
        { title: 'Cost Breakdown', key: 'cost_breakdown', type: 'cost' },
        { title: 'Compliance Matrix', key: 'compliance_matrix', type: 'compliance' },
        { title: 'Risk Mitigation', key: 'risk_mitigation', type: 'risk' },
        { title: 'Why Choose Us', key: 'differentiators', type: 'list' },
        { title: 'Past Performance', key: 'past_performance', type: 'text' },
        { title: 'Terms & Conditions', key: 'terms_and_conditions', type: 'text' },
      ];

      for (const section of sections) {
        const data = content[section.key];
        if (!data || (Array.isArray(data) && data.length === 0)) continue;

        doc.addPage();
        pdfSectionHeading(doc, section.title, pageWidth);

        switch (section.type) {
          case 'text':
            pdfText(doc, data);
            break;
          case 'technical':
            pdfTechnical(doc, data);
            break;
          case 'scope':
            pdfScope(doc, data);
            break;
          case 'timeline':
            pdfTimeline(doc, data, pageWidth);
            break;
          case 'team':
            pdfTeam(doc, data, pageWidth);
            break;
          case 'cost':
            pdfCost(doc, data, pageWidth);
            break;
          case 'compliance':
            pdfCompliance(doc, data, pageWidth);
            break;
          case 'risk':
            pdfRisk(doc, data, pageWidth);
            break;
          case 'list':
            pdfList(doc, data);
            break;
        }
      }

      // ── Page Numbers ──
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(9).fillColor(COLORS.gray)
          .text(`Page ${i + 1} of ${pageCount}`, 50, doc.page.height - 40, {
            align: 'center',
            width: pageWidth,
          });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function pdfSectionHeading(doc, title, pageWidth) {
  doc.fontSize(18).font('Helvetica-Bold').fillColor(COLORS.primary).text(title);
  doc.moveDown(0.3);
  doc.moveTo(doc.x, doc.y).lineTo(doc.x + pageWidth, doc.y)
    .strokeColor(COLORS.lightGray).lineWidth(1).stroke();
  doc.moveDown(0.8);
}

function pdfText(doc, text) {
  doc.fontSize(11).font('Helvetica').fillColor(COLORS.dark)
    .text(String(text), { lineGap: 4 });
}

function pdfTechnical(doc, data) {
  if (data.overview) {
    doc.fontSize(11).font('Helvetica').fillColor(COLORS.dark).text(data.overview, { lineGap: 4 });
    doc.moveDown(0.8);
  }
  if (data.methodology) {
    doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.dark).text('Methodology');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').text(data.methodology, { lineGap: 4 });
    doc.moveDown(0.8);
  }
  if (data.solution_components && data.solution_components.length > 0) {
    doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.dark).text('Solution Components');
    doc.moveDown(0.3);
    for (const comp of data.solution_components) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.dark)
        .text(`  ${comp.component || comp.name || 'Component'}`);
      if (comp.description) {
        doc.fontSize(10).font('Helvetica').fillColor(COLORS.gray)
          .text(`    ${comp.description}`, { lineGap: 2 });
      }
      if (comp.technologies && comp.technologies.length > 0) {
        doc.fontSize(9).font('Helvetica').fillColor(COLORS.primary)
          .text(`    Technologies: ${comp.technologies.join(', ')}`);
      }
      doc.moveDown(0.4);
    }
  }
  if (data.innovation) {
    doc.moveDown(0.4);
    doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.dark).text('Innovation & Added Value');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').text(data.innovation, { lineGap: 4 });
  }
}

function pdfScope(doc, phases) {
  if (!Array.isArray(phases)) return;
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text(`Phase ${i + 1}: ${phase.phase || phase.name || ''}`);
    if (phase.duration) {
      doc.fontSize(10).font('Helvetica').fillColor(COLORS.gray).text(`Duration: ${phase.duration}`);
    }
    doc.moveDown(0.3);
    if (phase.description) {
      doc.fontSize(11).font('Helvetica').fillColor(COLORS.dark).text(phase.description, { lineGap: 3 });
      doc.moveDown(0.3);
    }
    if (phase.activities && phase.activities.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.dark).text('Activities:');
      for (const a of phase.activities) {
        doc.fontSize(10).font('Helvetica').fillColor(COLORS.dark).text(`  \u2022 ${a}`);
      }
      doc.moveDown(0.2);
    }
    if (phase.deliverables && phase.deliverables.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.dark).text('Deliverables:');
      for (const d of phase.deliverables) {
        doc.fontSize(10).font('Helvetica').fillColor(COLORS.dark).text(`  \u2022 ${d}`);
      }
    }
    doc.moveDown(0.8);
  }
}

function pdfTimeline(doc, data, pageWidth) {
  if (data.total_duration) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.dark)
      .text(`Total Duration: ${data.total_duration}`);
    doc.moveDown(0.8);
  }
  if (data.milestones && data.milestones.length > 0) {
    const colWidths = [pageWidth * 0.35, pageWidth * 0.25, pageWidth * 0.40];
    pdfTableHeader(doc, ['Milestone', 'Target Date', 'Deliverables'], colWidths);
    for (const m of data.milestones) {
      pdfTableRow(doc, [
        m.milestone || '',
        m.target_date || '',
        Array.isArray(m.deliverables) ? m.deliverables.join(', ') : (m.deliverables || ''),
      ], colWidths);
    }
  }
}

function pdfTeam(doc, team, pageWidth) {
  if (!Array.isArray(team)) return;
  const colWidths = [pageWidth * 0.25, pageWidth * 0.40, pageWidth * 0.35];
  pdfTableHeader(doc, ['Role', 'Responsibilities', 'Qualifications'], colWidths);
  for (const t of team) {
    pdfTableRow(doc, [t.role || '', t.responsibilities || '', t.qualifications || ''], colWidths);
  }
}

function pdfCost(doc, data, pageWidth) {
  if (data.summary) {
    doc.fontSize(11).font('Helvetica').fillColor(COLORS.dark).text(data.summary, { lineGap: 4 });
    doc.moveDown(0.8);
  }
  if (data.line_items && data.line_items.length > 0) {
    const colWidths = [pageWidth * 0.30, pageWidth * 0.20, pageWidth * 0.20, pageWidth * 0.30];
    pdfTableHeader(doc, ['Item', 'Category', 'Est. Cost', 'Notes'], colWidths);
    for (const item of data.line_items) {
      pdfTableRow(doc, [
        item.item || '', item.category || '', item.estimated_cost || '', item.notes || '',
      ], colWidths);
    }
  }
  if (data.total_estimated_cost) {
    doc.moveDown(0.5);
    doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text(`Total Estimated Cost: ${data.total_estimated_cost}`, { align: 'right' });
  }
  if (data.payment_schedule) {
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.dark).text('Payment Schedule:');
    doc.fontSize(11).font('Helvetica').text(data.payment_schedule, { lineGap: 3 });
  }
  if (data.assumptions && data.assumptions.length > 0) {
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.dark).text('Assumptions:');
    for (const a of data.assumptions) {
      doc.fontSize(10).font('Helvetica').text(`  \u2022 ${a}`);
    }
  }
}

function pdfCompliance(doc, matrix, pageWidth) {
  if (!Array.isArray(matrix)) return;
  const colWidths = [pageWidth * 0.12, pageWidth * 0.28, pageWidth * 0.15, pageWidth * 0.45];
  pdfTableHeader(doc, ['Req. ID', 'Requirement', 'Status', 'Response'], colWidths);
  for (const cm of matrix) {
    pdfTableRow(doc, [
      cm.requirement_id || '',
      cm.requirement_summary || '',
      cm.compliance_status || '',
      cm.response || '',
    ], colWidths);
  }
}

function pdfRisk(doc, risks, pageWidth) {
  if (!Array.isArray(risks)) return;
  const colWidths = [pageWidth * 0.30, pageWidth * 0.15, pageWidth * 0.55];
  pdfTableHeader(doc, ['Risk', 'Impact', 'Mitigation Strategy'], colWidths);
  for (const r of risks) {
    pdfTableRow(doc, [r.risk || '', r.impact || '', r.mitigation_strategy || ''], colWidths);
  }
}

function pdfList(doc, items) {
  if (!Array.isArray(items)) return;
  for (let i = 0; i < items.length; i++) {
    doc.fontSize(11).font('Helvetica').fillColor(COLORS.dark)
      .text(`${i + 1}. ${items[i]}`, { lineGap: 4 });
    doc.moveDown(0.3);
  }
}

function pdfTableHeader(doc, headers, colWidths) {
  const startX = doc.x;
  const y = doc.y;
  doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 20)
    .fill(COLORS.primary);
  let x = startX;
  for (let i = 0; i < headers.length; i++) {
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.white)
      .text(headers[i], x + 4, y + 5, { width: colWidths[i] - 8, height: 14 });
    x += colWidths[i];
  }
  doc.y = y + 22;
}

function pdfTableRow(doc, cells, colWidths) {
  const startX = doc.x;
  const y = doc.y;
  // Calculate row height based on tallest cell
  let maxH = 16;
  for (let i = 0; i < cells.length; i++) {
    const h = doc.fontSize(9).font('Helvetica').heightOfString(String(cells[i]), {
      width: colWidths[i] - 8,
    });
    if (h + 8 > maxH) maxH = h + 8;
  }

  // Check if we need a new page
  if (y + maxH > doc.page.height - doc.page.margins.bottom - 20) {
    doc.addPage();
    doc.y = doc.page.margins.top;
    return pdfTableRow(doc, cells, colWidths);
  }

  doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), maxH)
    .fill('#f8fafc');
  doc.moveTo(startX, y + maxH)
    .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y + maxH)
    .strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();

  let x = startX;
  for (let i = 0; i < cells.length; i++) {
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark)
      .text(String(cells[i]), x + 4, y + 4, { width: colWidths[i] - 8, height: maxH });
    x += colWidths[i];
  }
  doc.y = y + maxH + 1;
}

// ── DOCX Generation ────────────────────────────────────────

function generateDocx(proposal) {
  const content = proposal.proposalContent || {};
  const company = proposal.companyProfile || {};
  const children = [];

  // Title page
  children.push(
    new docx.Paragraph({
      spacing: { before: 3000 },
      alignment: docx.AlignmentType.CENTER,
      children: [
        new docx.TextRun({
          text: content.title || proposal.title || 'Proposal',
          bold: true,
          size: 56,
          color: '2563eb',
          font: 'Calibri',
        }),
      ],
    }),
    new docx.Paragraph({
      spacing: { before: 400 },
      alignment: docx.AlignmentType.CENTER,
      children: [
        new docx.TextRun({
          text: `Prepared by ${company.company_name || 'N/A'}`,
          size: 28,
          color: '64748b',
          font: 'Calibri',
        }),
      ],
    }),
    new docx.Paragraph({
      spacing: { before: 200 },
      alignment: docx.AlignmentType.CENTER,
      children: [
        new docx.TextRun({
          text: new Date(proposal.createdAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          }),
          size: 22,
          color: '64748b',
          font: 'Calibri',
        }),
      ],
    }),
    new docx.Paragraph({
      spacing: { before: 200 },
      alignment: docx.AlignmentType.CENTER,
      children: [
        new docx.TextRun({
          text: `Version ${proposal.version || 1}`,
          size: 22,
          color: '64748b',
          font: 'Calibri',
        }),
      ],
    }),
    new docx.Paragraph({ children: [new docx.PageBreak()] })
  );

  // Sections
  const sections = [
    { title: 'Executive Summary', key: 'executive_summary', type: 'text' },
    { title: 'Understanding of Requirements', key: 'understanding_of_requirements', type: 'text' },
    { title: 'Technical Approach', key: 'technical_approach', type: 'technical' },
    { title: 'Scope of Work', key: 'scope_of_work', type: 'scope' },
    { title: 'Timeline & Milestones', key: 'timeline', type: 'timeline' },
    { title: 'Team Composition', key: 'team_composition', type: 'team' },
    { title: 'Cost Breakdown', key: 'cost_breakdown', type: 'cost' },
    { title: 'Compliance Matrix', key: 'compliance_matrix', type: 'compliance' },
    { title: 'Risk Mitigation', key: 'risk_mitigation', type: 'risk' },
    { title: 'Why Choose Us', key: 'differentiators', type: 'list' },
    { title: 'Past Performance', key: 'past_performance', type: 'text' },
    { title: 'Terms & Conditions', key: 'terms_and_conditions', type: 'text' },
  ];

  for (const section of sections) {
    const data = content[section.key];
    if (!data || (Array.isArray(data) && data.length === 0)) continue;

    children.push(docxHeading(section.title));

    switch (section.type) {
      case 'text':
        children.push(docxParagraph(String(data)));
        break;
      case 'technical':
        children.push(...docxTechnical(data));
        break;
      case 'scope':
        children.push(...docxScope(data));
        break;
      case 'timeline':
        children.push(...docxTimeline(data));
        break;
      case 'team':
        children.push(...docxTeam(data));
        break;
      case 'cost':
        children.push(...docxCost(data));
        break;
      case 'compliance':
        children.push(...docxCompliance(data));
        break;
      case 'risk':
        children.push(...docxRisk(data));
        break;
      case 'list':
        children.push(...docxList(data));
        break;
    }

    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  }

  const doc = new docx.Document({
    creator: company.company_name || 'RFP Management System',
    title: content.title || proposal.title || 'Proposal',
    description: 'AI-Generated RFP Proposal',
    sections: [{
      properties: {
        page: {
          margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 },
        },
      },
      children,
    }],
  });

  return docx.Packer.toBuffer(doc);
}

function docxHeading(text) {
  return new docx.Paragraph({
    spacing: { before: 400, after: 200 },
    heading: docx.HeadingLevel.HEADING_1,
    children: [
      new docx.TextRun({
        text,
        bold: true,
        size: 32,
        color: '2563eb',
        font: 'Calibri',
      }),
    ],
    border: {
      bottom: { style: docx.BorderStyle.SINGLE, size: 4, color: 'e2e8f0' },
    },
  });
}

function docxSubheading(text) {
  return new docx.Paragraph({
    spacing: { before: 200, after: 100 },
    heading: docx.HeadingLevel.HEADING_2,
    children: [
      new docx.TextRun({
        text,
        bold: true,
        size: 26,
        color: '1e293b',
        font: 'Calibri',
      }),
    ],
  });
}

function docxParagraph(text) {
  return new docx.Paragraph({
    spacing: { after: 120 },
    children: [
      new docx.TextRun({
        text,
        size: 22,
        font: 'Calibri',
      }),
    ],
  });
}

function docxBullet(text) {
  return new docx.Paragraph({
    spacing: { after: 60 },
    bullet: { level: 0 },
    children: [
      new docx.TextRun({
        text,
        size: 22,
        font: 'Calibri',
      }),
    ],
  });
}

function docxTechnical(data) {
  const items = [];
  if (data.overview) items.push(docxParagraph(data.overview));
  if (data.methodology) {
    items.push(docxSubheading('Methodology'));
    items.push(docxParagraph(data.methodology));
  }
  if (data.solution_components && data.solution_components.length > 0) {
    items.push(docxSubheading('Solution Components'));
    for (const comp of data.solution_components) {
      items.push(new docx.Paragraph({
        spacing: { before: 100, after: 40 },
        children: [
          new docx.TextRun({ text: comp.component || comp.name || 'Component', bold: true, size: 22, font: 'Calibri' }),
        ],
      }));
      if (comp.description) items.push(docxParagraph(comp.description));
      if (comp.technologies && comp.technologies.length > 0) {
        items.push(new docx.Paragraph({
          spacing: { after: 60 },
          children: [
            new docx.TextRun({ text: 'Technologies: ', bold: true, size: 20, color: '64748b', font: 'Calibri' }),
            new docx.TextRun({ text: comp.technologies.join(', '), size: 20, color: '2563eb', font: 'Calibri' }),
          ],
        }));
      }
    }
  }
  if (data.innovation) {
    items.push(docxSubheading('Innovation & Added Value'));
    items.push(docxParagraph(data.innovation));
  }
  return items;
}

function docxScope(phases) {
  if (!Array.isArray(phases)) return [];
  const items = [];
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    items.push(docxSubheading(`Phase ${i + 1}: ${phase.phase || phase.name || ''}`));
    if (phase.duration) {
      items.push(new docx.Paragraph({
        spacing: { after: 60 },
        children: [
          new docx.TextRun({ text: 'Duration: ', bold: true, size: 20, color: '64748b', font: 'Calibri' }),
          new docx.TextRun({ text: phase.duration, size: 20, color: '64748b', font: 'Calibri' }),
        ],
      }));
    }
    if (phase.description) items.push(docxParagraph(phase.description));
    if (phase.activities && phase.activities.length > 0) {
      items.push(new docx.Paragraph({
        spacing: { before: 80 },
        children: [new docx.TextRun({ text: 'Activities:', bold: true, size: 22, font: 'Calibri' })],
      }));
      for (const a of phase.activities) items.push(docxBullet(a));
    }
    if (phase.deliverables && phase.deliverables.length > 0) {
      items.push(new docx.Paragraph({
        spacing: { before: 80 },
        children: [new docx.TextRun({ text: 'Deliverables:', bold: true, size: 22, font: 'Calibri' })],
      }));
      for (const d of phase.deliverables) items.push(docxBullet(d));
    }
  }
  return items;
}

function docxTimeline(data) {
  const items = [];
  if (data.total_duration) {
    items.push(new docx.Paragraph({
      spacing: { after: 200 },
      children: [
        new docx.TextRun({ text: 'Total Duration: ', bold: true, size: 22, font: 'Calibri' }),
        new docx.TextRun({ text: data.total_duration, size: 22, font: 'Calibri' }),
      ],
    }));
  }
  if (data.milestones && data.milestones.length > 0) {
    items.push(docxTable(
      ['Milestone', 'Target Date', 'Deliverables'],
      data.milestones.map((m) => [
        m.milestone || '',
        m.target_date || '',
        Array.isArray(m.deliverables) ? m.deliverables.join(', ') : (m.deliverables || ''),
      ])
    ));
  }
  return items;
}

function docxTeam(team) {
  if (!Array.isArray(team)) return [];
  return [
    docxTable(
      ['Role', 'Responsibilities', 'Qualifications'],
      team.map((t) => [t.role || '', t.responsibilities || '', t.qualifications || ''])
    ),
  ];
}

function docxCost(data) {
  const items = [];
  if (data.summary) items.push(docxParagraph(data.summary));
  if (data.line_items && data.line_items.length > 0) {
    items.push(docxTable(
      ['Item', 'Category', 'Est. Cost', 'Notes'],
      data.line_items.map((item) => [
        item.item || '', item.category || '', item.estimated_cost || '', item.notes || '',
      ])
    ));
  }
  if (data.total_estimated_cost) {
    items.push(new docx.Paragraph({
      spacing: { before: 200 },
      alignment: docx.AlignmentType.RIGHT,
      children: [
        new docx.TextRun({ text: 'Total Estimated Cost: ', bold: true, size: 24, font: 'Calibri' }),
        new docx.TextRun({ text: data.total_estimated_cost, bold: true, size: 28, color: '2563eb', font: 'Calibri' }),
      ],
    }));
  }
  if (data.payment_schedule) {
    items.push(new docx.Paragraph({
      spacing: { before: 100 },
      children: [
        new docx.TextRun({ text: 'Payment Schedule: ', bold: true, size: 22, font: 'Calibri' }),
        new docx.TextRun({ text: data.payment_schedule, size: 22, font: 'Calibri' }),
      ],
    }));
  }
  if (data.assumptions && data.assumptions.length > 0) {
    items.push(new docx.Paragraph({
      spacing: { before: 100 },
      children: [new docx.TextRun({ text: 'Assumptions:', bold: true, size: 22, font: 'Calibri' })],
    }));
    for (const a of data.assumptions) items.push(docxBullet(a));
  }
  return items;
}

function docxCompliance(matrix) {
  if (!Array.isArray(matrix)) return [];
  return [
    docxTable(
      ['Req. ID', 'Requirement', 'Status', 'Response'],
      matrix.map((cm) => [
        cm.requirement_id || '', cm.requirement_summary || '', cm.compliance_status || '', cm.response || '',
      ])
    ),
  ];
}

function docxRisk(risks) {
  if (!Array.isArray(risks)) return [];
  return [
    docxTable(
      ['Risk', 'Impact', 'Mitigation Strategy'],
      risks.map((r) => [r.risk || '', r.impact || '', r.mitigation_strategy || ''])
    ),
  ];
}

function docxList(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, i) => new docx.Paragraph({
    spacing: { after: 80 },
    children: [
      new docx.TextRun({ text: `${i + 1}. `, bold: true, size: 22, font: 'Calibri', color: '2563eb' }),
      new docx.TextRun({ text: String(item), size: 22, font: 'Calibri' }),
    ],
  }));
}

function docxTable(headers, rows) {
  return new docx.Table({
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
    rows: [
      new docx.TableRow({
        tableHeader: true,
        children: headers.map((h) => new docx.TableCell({
          shading: { fill: '2563eb' },
          children: [new docx.Paragraph({
            children: [new docx.TextRun({ text: h, bold: true, size: 18, color: 'ffffff', font: 'Calibri' })],
          })],
          verticalAlign: docx.VerticalAlign.CENTER,
        })),
      }),
      ...rows.map((row) => new docx.TableRow({
        children: row.map((cell) => new docx.TableCell({
          shading: { fill: 'f8fafc' },
          children: [new docx.Paragraph({
            children: [new docx.TextRun({ text: String(cell), size: 18, font: 'Calibri' })],
          })],
          verticalAlign: docx.VerticalAlign.CENTER,
        })),
      })),
    ],
  });
}

module.exports = { generatePdf, generateDocx };
