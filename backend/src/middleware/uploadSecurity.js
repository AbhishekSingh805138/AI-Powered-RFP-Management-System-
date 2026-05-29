const path = require('path');

// PDF magic bytes: %PDF-
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D]);

/**
 * Validate that file content starts with PDF magic bytes.
 * Must be called after multer processes the upload (req.file.buffer available).
 */
function validatePdfContent(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const buffer = req.file.buffer;
  if (buffer.length < 5 || !buffer.subarray(0, 5).equals(PDF_MAGIC_BYTES)) {
    return res.status(400).json({ error: 'Invalid file: content is not a valid PDF' });
  }

  // Sanitize the original filename
  req.file.originalname = sanitizeFilename(req.file.originalname);

  next();
}

/**
 * Sanitize a user-supplied filename:
 * - Strip path traversal sequences
 * - Remove null bytes
 * - Remove special characters except dots, hyphens, underscores
 * - Limit length
 */
function sanitizeFilename(filename) {
  if (!filename) return 'unnamed.pdf';

  let sanitized = filename
    // Remove null bytes
    .replace(/\0/g, '')
    // Get only the basename (strip any path components)
    .split(/[/\\]/).pop()
    // Remove path traversal
    .replace(/\.\./g, '')
    // Keep only safe characters: letters, digits, dots, hyphens, underscores, spaces
    .replace(/[^a-zA-Z0-9.\-_ ]/g, '')
    // Collapse multiple dots/spaces
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, ' ')
    .trim();

  // Limit to 255 characters
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    sanitized = sanitized.slice(0, 255 - ext.length) + ext;
  }

  return sanitized || 'unnamed.pdf';
}

module.exports = { validatePdfContent, sanitizeFilename };
