/**
 * Text chunking utilities for embedding generation
 */

/**
 * Split text into chunks of optimal size for embeddings
 */
function splitTextIntoChunks(text, options = {}) {
  const {
    maxChunkSize = 1000,      // Maximum characters per chunk
    overlapSize = 100,        // Overlap between chunks
    minChunkSize = 100,       // Minimum chunk size
    preserveParagraphs = true, // Try to keep paragraphs intact
    preserveSentences = true   // Try to keep sentences intact
  } = options;

  if (!text || typeof text !== 'string') {
    return [];
  }

  const chunks = [];
  let currentPosition = 0;
  
  while (currentPosition < text.length) {
    let chunkEnd = currentPosition + maxChunkSize;
    
    // If we're at the end of the text, take everything
    if (chunkEnd >= text.length) {
      const finalChunk = text.slice(currentPosition).trim();
      if (finalChunk.length >= minChunkSize) {
        chunks.push(finalChunk);
      }
      break;
    }
    
    // Try to find a good breaking point
    let breakPoint = chunkEnd;
    const searchStart = Math.max(currentPosition + minChunkSize, chunkEnd - 200);
    
    if (preserveParagraphs) {
      // Look for paragraph breaks (double newlines)
      const paragraphBreak = text.lastIndexOf('\n\n', chunkEnd);
      if (paragraphBreak > searchStart) {
        breakPoint = paragraphBreak + 2;
      }
    }
    
    if (breakPoint === chunkEnd && preserveSentences) {
      // Look for sentence endings
      const sentenceBreak = findSentenceBreak(text, searchStart, chunkEnd);
      if (sentenceBreak > searchStart) {
        breakPoint = sentenceBreak;
      }
    }
    
    if (breakPoint === chunkEnd) {
      // Look for word boundaries
      const wordBreak = text.lastIndexOf(' ', chunkEnd);
      if (wordBreak > searchStart) {
        breakPoint = wordBreak;
      }
    }
    
    // Extract chunk
    const chunk = text.slice(currentPosition, breakPoint).trim();
    if (chunk.length >= minChunkSize) {
      chunks.push(chunk);
    }
    
    // Move to next position with overlap
    currentPosition = Math.max(breakPoint - overlapSize, currentPosition + minChunkSize);
  }
  
  return chunks.filter(chunk => chunk.length >= minChunkSize);
}

/**
 * Find a good sentence break point
 */
function findSentenceBreak(text, start, end) {
  const sentenceEnders = ['.', '!', '?'];
  let bestBreak = -1;
  
  for (let i = end - 1; i >= start; i--) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (sentenceEnders.includes(char)) {
      // Check if it's a real sentence ending (not an abbreviation)
      if (nextChar === ' ' || nextChar === '\n' || i === text.length - 1) {
        // Look ahead to see if next word starts with capital (likely sentence start)
        const nextWordMatch = text.slice(i + 1).match(/\s*([A-Z])/);
        if (nextWordMatch || i === text.length - 1) {
          bestBreak = i + 1;
          break;
        }
      }
    }
  }
  
  return bestBreak;
}

/**
 * Extract text chunks with page information from PDF data
 */
function extractPDFChunks(pdfData, options = {}) {
  const {
    chunkSize = 1000,
    overlap = 100,
    includePageBreaks = true
  } = options;

  const chunks = [];
  
  if (!pdfData.text) {
    return chunks;
  }

  // If we don't have page info, treat as single page
  if (!pdfData.numpages) {
    const textChunks = splitTextIntoChunks(pdfData.text, {
      maxChunkSize: chunkSize,
      overlapSize: overlap
    });
    
    return textChunks.map((text, index) => ({
      text,
      page: 1,
      chunkIndex: index,
      startChar: 0,
      endChar: text.length
    }));
  }

  // For PDFs with multiple pages, try to extract page-wise if possible
  // Note: pdf-parse doesn't provide per-page text extraction by default
  // This is a simplified approach - for better page detection, 
  // consider using pdf2pic + OCR or more advanced PDF libraries
  
  const textChunks = splitTextIntoChunks(pdfData.text, {
    maxChunkSize: chunkSize,
    overlapSize: overlap
  });
  
  // Estimate page numbers based on chunk position and total pages
  const avgChunkSize = pdfData.text.length / pdfData.numpages;
  
  return textChunks.map((text, index) => {
    const chunkStart = pdfData.text.indexOf(text);
    const estimatedPage = Math.ceil((chunkStart + text.length / 2) / avgChunkSize) || 1;
    const actualPage = Math.min(estimatedPage, pdfData.numpages);
    
    return {
      text,
      page: actualPage,
      chunkIndex: index,
      startChar: chunkStart,
      endChar: chunkStart + text.length
    };
  });
}

/**
 * Clean and normalize text for better embedding quality
 */
function cleanTextForEmbedding(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive punctuation
    .replace(/[.]{3,}/g, '...')
    // Remove control characters but keep basic punctuation
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Trim and ensure single spaces
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Validate chunk quality
 */
function validateChunk(chunk) {
  if (!chunk || typeof chunk !== 'string') {
    return false;
  }
  
  const trimmed = chunk.trim();
  
  // Too short
  if (trimmed.length < 50) {
    return false;
  }
  
  // Too long
  if (trimmed.length > 8000) {
    return false;
  }
  
  // Only punctuation or numbers
  if (!/[a-zA-Z]/.test(trimmed)) {
    return false;
  }
  
  // Too repetitive
  const words = trimmed.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  if (uniqueWords.size < words.length * 0.3) {
    return false;
  }
  
  return true;
}

/**
 * Process PDF for embeddings - complete pipeline
 */
function processPDFForEmbeddings(pdfData, options = {}) {
  const {
    chunkSize = 800,      // Slightly smaller for better context
    overlap = 100,
    cleanText = true,
    validateChunks = true
  } = options;

  try {
    // Extract chunks with page information
    let chunks = extractPDFChunks(pdfData, { chunkSize, overlap });
    
    // Clean text if requested
    if (cleanText) {
      chunks = chunks.map(chunk => ({
        ...chunk,
        text: cleanTextForEmbedding(chunk.text)
      }));
    }
    
    // Validate chunks if requested
    if (validateChunks) {
      chunks = chunks.filter(chunk => validateChunk(chunk.text));
    }
    
    // Add metadata
    chunks = chunks.map((chunk, index) => ({
      ...chunk,
      id: `chunk_${index}`,
      wordCount: chunk.text.split(/\s+/).length,
      charCount: chunk.text.length
    }));
    
    return {
      chunks,
      metadata: {
        totalPages: pdfData.numpages || 1,
        totalChunks: chunks.length,
        totalWords: chunks.reduce((sum, chunk) => sum + chunk.wordCount, 0),
        totalChars: chunks.reduce((sum, chunk) => sum + chunk.charCount, 0),
        avgChunkSize: chunks.length > 0 ? 
          Math.round(chunks.reduce((sum, chunk) => sum + chunk.charCount, 0) / chunks.length) : 0
      }
    };
  } catch (error) {
    console.error('Error processing PDF for embeddings:', error);
    throw new Error(`PDF processing failed: ${error.message}`);
  }
}

export {
  splitTextIntoChunks,
  extractPDFChunks,
  cleanTextForEmbedding,
  validateChunk,
  processPDFForEmbeddings
};