/**
 * Arogya AI — Medical Document OCR & Text Extraction Service
 * Path: backend/services/ocrService.mjs
 * 
 * Handles PDF, image, and plain text files.
 * - Digital PDFs: Extracted via pypdf helper.
 * - Text reports: Decoded directly as UTF-8.
 * - Image reports: Transcribed via OpenAI Vision if available, or inspected with disclaimer.
 * - Preserves verbatim raw OCR text for doctor transparency.
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.resolve(__dirname, '../scripts/extract_pdf_text.py');

/**
 * Determine document type category from filename and mimeType
 */
export function determineFileType(filename = '', mimeType = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (ext === 'pdf' || mime.includes('pdf')) {
    return 'pdf';
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff'].includes(ext) || mime.includes('image')) {
    return 'image';
  }
  return 'text';
}

/**
 * Extract raw text from uploaded document buffer
 * 
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - File name
 * @param {string} mimeType - MIME type
 * @returns {Promise<{ success: boolean, rawText: string, fileType: string, extractionStatus: string, notes: string[], pageCount?: number }>}
 */
export async function extractTextFromDocument(buffer, filename = 'report.pdf', mimeType = '') {
  if (!buffer || buffer.length === 0) {
    return {
      success: false,
      rawText: '',
      fileType: 'unknown',
      extractionStatus: 'failed',
      notes: ['Uploaded document is empty (0 bytes).'],
      pageCount: 0
    };
  }

  const fileType = determineFileType(filename, mimeType);
  const notes = [
    'Prototype extraction notice: Designed for printed electronic lab documents; handwriting recognition is not supported.'
  ];

  // 1. Digital PDF Extraction
  if (fileType === 'pdf') {
    try {
      const pythonExec = process.platform === 'win32' ? 'py' : 'python3';
      const child = spawnSync(pythonExec, [SCRIPT_PATH], {
        input: buffer,
        maxBuffer: 20 * 1024 * 1024,
        timeout: 10000
      });

      if (child.status === 0 && child.stdout && child.stdout.length > 0) {
        const result = JSON.parse(child.stdout.toString('utf-8'));
        if (result.success && result.text && result.text.trim()) {
          notes.push(...(result.notes || []));
          return {
            success: true,
            rawText: result.text.trim(),
            fileType: 'pdf',
            extractionStatus: 'success',
            notes,
            pageCount: result.page_count || 1
          };
        }
      }
    } catch (pdfErr) {
      notes.push(`Python PDF extractor unavailable: ${pdfErr.message}`);
    }

    // Fallback: Node-level raw stream extraction for text embedded in PDF
    try {
      const rawString = buffer.toString('binary');
      const textMatches = [];
      const textBlockRegex = /BT[\s\S]*?ET/g;
      const tjRegex = /\((.*?)\)\s*Tj/g;
      
      let blockMatch;
      while ((blockMatch = textBlockRegex.exec(rawString)) !== null) {
        let tjMatch;
        while ((tjMatch = tjRegex.exec(blockMatch[0])) !== null) {
          textMatches.push(tjMatch[1]);
        }
      }

      if (textMatches.length > 0) {
        const recoveredText = textMatches.join(' ').replace(/\\r|\\n/g, '\n');
        notes.push('Recovered text stream from PDF text blocks via Node fallback.');
        return {
          success: true,
          rawText: recoveredText.trim(),
          fileType: 'pdf',
          extractionStatus: 'success',
          notes,
          pageCount: 1
        };
      }
    } catch (fallbackErr) {
      notes.push(`Node PDF fallback encountered error: ${fallbackErr.message}`);
    }

    return {
      success: false,
      rawText: '',
      fileType: 'pdf',
      extractionStatus: 'uncertain',
      notes: [
        ...notes,
        'Could not extract legible text from PDF. The document may be a scanned image or corrupted.'
      ],
      pageCount: 1
    };
  }

  // 2. Image Extraction
  if (fileType === 'image') {
    const apiKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : '';
    if (apiKey) {
      try {
        const base64Image = buffer.toString('base64');
        const ext = (filename.split('.').pop() || 'jpeg').toLowerCase();
        const imageMime = ext === 'png' ? 'image/png' : 'image/jpeg';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: (
                  'You are an optical character recognition (OCR) engine for medical documents. ' +
                  'Transcribe verbatim all visible printed text from the image, including headers, test names, values, units, and reference ranges. ' +
                  'Do NOT summarize, do NOT diagnose, and do NOT invent text that is illegible.'
                )
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Transcribe the text of this printed medical report verbatim.' },
                  { type: 'image_url', image_url: { url: `data:${imageMime};base64,${base64Image}` } }
                ]
              }
            ],
            max_tokens: 1500,
            temperature: 0
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const aiJson = await response.json();
          const transcribedText = aiJson.choices?.[0]?.message?.content || '';
          if (transcribedText.trim()) {
            notes.push('Text transcribed via OpenAI Vision OCR.');
            return {
              success: true,
              rawText: transcribedText.trim(),
              fileType: 'image',
              extractionStatus: 'success',
              notes,
              pageCount: 1
            };
          }
        }
      } catch (visionErr) {
        notes.push(`Vision OCR failed: ${visionErr.message}`);
      }
    }

    // Defensive handling if image OCR is unavailable
    return {
      success: false,
      rawText: '',
      fileType: 'image',
      extractionStatus: 'uncertain',
      notes: [
        ...notes,
        'Image document received. Local OCR engine (Tesseract) not installed and vision OCR bypassed. File preserved for physician review.'
      ],
      pageCount: 1
    };
  }

  // 3. Plain Text Extraction (Text, CSV, Markdown)
  try {
    const text = buffer.toString('utf-8');
    notes.push('Extracted plain text document directly (UTF-8).');
    return {
      success: true,
      rawText: text.trim(),
      fileType: 'text',
      extractionStatus: text.trim().length > 0 ? 'success' : 'uncertain',
      notes,
      pageCount: 1
    };
  } catch (err) {
    return {
      success: false,
      rawText: '',
      fileType: 'text',
      extractionStatus: 'failed',
      notes: [...notes, `Failed to decode text: ${err.message}`],
      pageCount: 0
    };
  }
}
