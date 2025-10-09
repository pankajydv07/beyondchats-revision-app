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
 * Estimate page count from text content
 */
function estimatePageCountFromText(text) {
  if (!text || typeof text !== 'string') {
    return 1;
  }

  // Look for form feed characters (page breaks)
  const formFeeds = (text.match(/\f/g) || []).length;
  if (formFeeds > 0) {
    return formFeeds + 1;
  }

  // Look for "Page X" patterns
  const pagePatterns = text.match(/(?:^|\n)\s*(?:Page\s+|p\.?\s*)(\d+)/gi);
  if (pagePatterns && pagePatterns.length > 0) {
    const pageNumbers = pagePatterns.map(match => {
      const num = match.match(/(\d+)/);
      return num ? parseInt(num[1]) : 0;
    });
    const maxPage = Math.max(...pageNumbers);
    if (maxPage > 1 && maxPage < 1000) {
      return maxPage;
    }
  }

  // Fallback: estimate based on text length
  const avgCharsPerPage = 2500;
  const estimatedPages = Math.ceil(text.length / avgCharsPerPage);
  return Math.max(1, Math.min(estimatedPages, 200));
}

/**
 * Extract text chunks with page information from PDF data
 * Enhanced with better page number estimation
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

  // Use numpages or pageCount, defaulting to estimated page count
  const totalPages = pdfData.numpages || pdfData.pageCount || estimatePageCountFromText(pdfData.text);
  const totalText = pdfData.text;
  const textLength = totalText.length;
  
  console.log(`📄 Processing PDF with ${totalPages} pages, ${textLength} characters`);

  // If we only have one page, treat as single page
  if (totalPages <= 1) {
    const textChunks = splitTextIntoChunks(totalText, {
      maxChunkSize: chunkSize,
      overlapSize: overlap
    });
    
    return textChunks.map((text, index) => ({
      text,
      page: 1,
      chunkIndex: index,
      startChar: 0,
      endChar: text.length,
      metadata: {
        estimationMethod: 'single_page',
        confidence: 'high'
      }
    }));
  }

  // Enhanced page estimation using multiple heuristics
  const pageBreakPatterns = [
    /\f/g,                    // Form feed character (page break)
    /\n\s*Page\s+\d+/gi,     // "Page X" patterns
    /\n\s*\d+\s*\n/g         // Standalone numbers (potential page numbers)
  ];
  
  // Find potential page boundaries
  let pageBreakPositions = [0]; // Start of document
  
  pageBreakPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(totalText)) !== null) {
      pageBreakPositions.push(match.index);
    }
  });
  
  // Add end of document
  pageBreakPositions.push(textLength);
  
  // Remove duplicates and sort
  pageBreakPositions = [...new Set(pageBreakPositions)].sort((a, b) => a - b);
  
  // If we found meaningful page breaks, use them; otherwise fall back to estimation
  let pageRanges = [];
  const hasGoodPageBreaks = pageBreakPositions.length > 2 && pageBreakPositions.length <= totalPages + 2;
  
  if (hasGoodPageBreaks) {
    // Use detected page breaks
    console.log(`📍 Using ${pageBreakPositions.length - 1} detected page breaks`);
    for (let i = 0; i < pageBreakPositions.length - 1; i++) {
      pageRanges.push({
        start: pageBreakPositions[i],
        end: pageBreakPositions[i + 1],
        page: Math.min(i + 1, totalPages)
      });
    }
  } else {
    // Fall back to equal distribution with slight improvements
    console.log(`📏 Using equal distribution for ${totalPages} pages`);
    const baseChunkSize = Math.floor(textLength / totalPages);
    
    for (let i = 0; i < totalPages; i++) {
      const start = i * baseChunkSize;
      const end = i === totalPages - 1 ? textLength : (i + 1) * baseChunkSize;
      
      // Adjust boundaries to word boundaries for better accuracy
      let adjustedStart = start;
      let adjustedEnd = end;
      
      if (i > 0) {
        // Find previous word boundary
        const spaceIndex = totalText.lastIndexOf(' ', start);
        if (spaceIndex > start - 200 && spaceIndex < start + 200) {
          adjustedStart = spaceIndex + 1;
        }
      }
      
      if (i < totalPages - 1) {
        // Find next word boundary
        const spaceIndex = totalText.indexOf(' ', end);
        if (spaceIndex > end - 200 && spaceIndex < end + 200) {
          adjustedEnd = spaceIndex;
        }
      }
      
      pageRanges.push({
        start: adjustedStart,
        end: adjustedEnd,
        page: i + 1
      });
    }
  }
  
  // Now split text into chunks and assign page numbers
  const textChunks = splitTextIntoChunks(totalText, {
    maxChunkSize: chunkSize,
    overlapSize: overlap
  });
  
  return textChunks.map((text, index) => {
    const chunkStart = totalText.indexOf(text);
    const chunkMidpoint = chunkStart + Math.floor(text.length / 2);
    
    // Find which page this chunk belongs to based on midpoint
    let assignedPage = 1;
    for (const range of pageRanges) {
      if (chunkMidpoint >= range.start && chunkMidpoint < range.end) {
        assignedPage = range.page;
        break;
      }
      if (chunkMidpoint >= range.start) {
        assignedPage = range.page; // Use last valid page
      }
    }
    
    // For chunks that span multiple pages, note the range
    let pageRange = assignedPage;
    const chunkEnd = chunkStart + text.length;
    
    // Check if chunk spans multiple pages
    const startPage = pageRanges.find(r => chunkStart >= r.start && chunkStart < r.end)?.page || assignedPage;
    const endPage = pageRanges.find(r => chunkEnd >= r.start && chunkEnd <= r.end)?.page || assignedPage;
    
    if (startPage !== endPage) {
      pageRange = `${startPage}-${endPage}`;
    }
    
    return {
      text,
      page: assignedPage,
      pageRange: pageRange, // Additional field for spans
      chunkIndex: index,
      startChar: chunkStart,
      endChar: chunkStart + text.length,
      metadata: {
        estimationMethod: hasGoodPageBreaks ? 'pattern_based' : 'distribution_based',
        confidence: hasGoodPageBreaks ? 'high' : 'medium',
        totalPages: totalPages
      }
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
        totalPages: pdfData.numpages || pdfData.pageCount || estimatePageCountFromText(pdfData.text),
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
  processPDFForEmbeddings,
  estimatePageCountFromText
};