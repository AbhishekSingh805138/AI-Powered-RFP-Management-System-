const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const pdf = require('pdf-parse');
const logger = require('../utils/logger');

// SMTP transporter for sending emails
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

/**
 * Send a generic email with HTML and text content.
 */
async function sendEmail(to, subject, html, text) {
  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
    text,
  });
  return { messageId: info.messageId, accepted: info.accepted };
}

/**
 * Send an RFP email to a vendor.
 */
async function sendRfpEmail(vendorEmail, vendorName, rfpData) {
  const transporter = createTransporter();

  const itemsList = (rfpData.structuredData?.items || [])
    .map((item) => `  - ${item.quantity}x ${item.name}: ${item.specifications || 'N/A'}`)
    .join('\n');

  const terms = rfpData.structuredData?.terms || {};
  const timeline = rfpData.structuredData?.timeline || {};

  const emailBody = `Dear ${vendorName},

We are inviting you to submit a proposal for the following procurement request.

RFP: ${rfpData.title}
Reference ID: RFP-${String(rfpData.id).padStart(4, '0')}

Requirements:
${itemsList}

Budget: ${rfpData.budget ? `$${Number(rfpData.budget).toLocaleString()} ${rfpData.currency || 'USD'}` : 'To be discussed'}
Delivery: ${timeline.deliveryDays ? `Within ${timeline.deliveryDays} days` : 'As soon as possible'}
Payment Terms: ${terms.paymentTerms || 'To be discussed'}
Warranty: ${terms.warranty || 'Please specify'}

Please reply to this email with your proposal including:
1. Itemized pricing for each requested item
2. Total cost breakdown
3. Delivery timeline
4. Payment terms
5. Warranty details
6. Any additional terms or conditions

We look forward to your response.

Best regards,
Procurement Team`;

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: vendorEmail,
    subject: `RFP-${String(rfpData.id).padStart(4, '0')}: ${rfpData.title}`,
    text: emailBody,
  });

  return { messageId: info.messageId, accepted: info.accepted };
}

/**
 * Fetch unread emails from IMAP inbox and parse them.
 */
async function fetchInboundEmails() {
  return new Promise((resolve, reject) => {
    const emails = [];

    const imap = new Imap({
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASSWORD,
      host: process.env.IMAP_HOST,
      port: parseInt(process.env.IMAP_PORT, 10),
      tls: true,
      tlsOptions: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
    });

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) { imap.end(); return reject(err); }

        imap.search(['UNSEEN'], (err, results) => {
          if (err) { imap.end(); return reject(err); }
          if (!results || results.length === 0) {
            imap.end();
            return resolve([]);
          }

          const fetch = imap.fetch(results, { bodies: '', markSeen: true });

          fetch.on('message', (msg) => {
            let buffer = '';

            msg.on('body', (stream) => {
              stream.on('data', (chunk) => { buffer += chunk.toString('utf8'); });
            });

            msg.once('end', async () => {
              try {
                const parsed = await simpleParser(buffer);
                const emailData = {
                  from: parsed.from?.value?.[0]?.address || '',
                  fromName: parsed.from?.value?.[0]?.name || '',
                  subject: parsed.subject || '',
                  text: parsed.text || '',
                  html: parsed.html || '',
                  date: parsed.date,
                  attachments: [],
                };

                // Process attachments — extract text from PDFs
                if (parsed.attachments) {
                  for (const att of parsed.attachments) {
                    const attachment = {
                      filename: att.filename,
                      mimeType: att.contentType,
                      size: att.size,
                      extractedText: null,
                    };

                    if (att.contentType === 'application/pdf') {
                      try {
                        const pdfData = await pdf(att.content);
                        attachment.extractedText = pdfData.text;
                      } catch (pdfErr) {
                        attachment.extractedText = '[PDF parsing failed]';
                      }
                    }

                    emailData.attachments.push(attachment);
                  }
                }

                emails.push(emailData);
              } catch (parseErr) {
                logger.error('Email parse error', { error: parseErr.message });
              }
            });
          });

          fetch.once('end', () => {
            imap.end();
          });

          fetch.once('error', (err) => {
            imap.end();
            reject(err);
          });
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

/**
 * Extract text from a PDF buffer.
 */
async function extractPdfText(pdfBuffer) {
  const data = await pdf(pdfBuffer);
  return data.text;
}

module.exports = {
  sendEmail,
  sendRfpEmail,
  fetchInboundEmails,
  extractPdfText,
};
