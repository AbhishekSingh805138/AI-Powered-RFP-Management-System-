const PDFDocument = require('../backend/node_modules/pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument();
const outputPath = path.join(__dirname, 'sample_rfp.pdf');
const stream = fs.createWriteStream(outputPath);

stream.on('finish', () => {
  console.log('Sample PDF generated successfully at:', outputPath);
});

doc.pipe(stream);
doc.fontSize(18).text('Request for Proposal (RFP)', 100, 50);
doc.fontSize(14).text('Project Alpha: Office Equipment Procurement', 100, 80);
doc.fontSize(12).text('\nRequirements:\n' +
  '1. Laptops:\n' +
  '   - Quantity: 20 units\n' +
  '   - Spec: 16GB RAM, 512GB SSD, Intel Core i7 or equivalent\n' +
  '2. Monitors:\n' +
  '   - Quantity: 15 units\n' +
  '   - Spec: 27-inch IPS, 4K resolution\n' +
  '3. Standing Desks:\n' +
  '   - Quantity: 10 units\n' +
  '   - Spec: Adjustable height, memory presets\n' +
  '\n' +
  'Timeline and Budget:\n' +
  '- Total Budget: $30,000 USD\n' +
  '- Delivery Timeline: Must be delivered within 30 days of contract signing.\n' +
  '- Warranty Requirement: 3-year hardware warranty on laptops and monitors.\n' +
  '- Payment Terms: Net 30 days from delivery and acceptance.\n', 100, 120);

doc.end();
