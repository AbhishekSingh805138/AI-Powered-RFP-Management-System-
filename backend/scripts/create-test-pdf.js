const fs = require('fs');
const path = require('path');

const lines = [
  'RFP Cloud Infrastructure Migration Services',
  'Budget: 500000 USD',
  'Deadline: September 2026',
  'Requirements:',
  '1. AWS certified engineers with 5 years experience',
  '2. SOC2 Type II compliance certification',
  '3. 24x7 support with 99.9 percent uptime SLA',
  '4. Zero downtime data migration capability',
  '5. Staff training program for 50 employees',
];

// Build content stream
let stream = 'BT /F1 12 Tf 72 720 Td 14 TL ';
for (const line of lines) {
  stream += '(' + line + ') Tj T* ';
}
stream += 'ET';

const objects = [];
objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj');
objects.push('4 0 obj\n<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream\nendobj');
objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');

let body = '%PDF-1.4\n';
const offsets = [];
for (const obj of objects) {
  offsets.push(body.length);
  body += obj + '\n';
}

const xrefStart = body.length;
body += 'xref\n0 6\n';
body += '0000000000 65535 f \n';
for (const off of offsets) {
  body += String(off).padStart(10, '0') + ' 00000 n \n';
}
body += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF';

const outPath = path.join(process.env.TEMP, 'test_rfp.pdf');
fs.writeFileSync(outPath, body, 'binary');
console.log('PDF written:', fs.statSync(outPath).size, 'bytes');

// Verify with pdf-parse
const pdfParse = require('pdf-parse');
pdfParse(fs.readFileSync(outPath)).then(d => {
  console.log('pdf-parse OK, text length:', d.text.length);
  console.log('Preview:', d.text.substring(0, 200));
}).catch(e => console.error('pdf-parse FAIL:', e.message));
