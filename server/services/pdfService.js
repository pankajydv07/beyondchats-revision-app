// PDF processing utilities
import fs from 'fs'

// Global PDF parser instance
let pdfParse

/**
 * Load PDF parser with proper error handling
 */
async function loadPdfParse() {
  if (!pdfParse) {
    try {
      const pdfParseModule = await import('pdf-parse')
      pdfParse = pdfParseModule.default
      console.log('✅ PDF parser loaded successfully')
    } catch (error) {
      console.error('❌ Failed to load PDF parser:', error.message)
      throw new Error('PDF parser initialization failed')
    }
  }
  return pdfParse
}

/**
 * Safe PDF parsing function with comprehensive error handling
 */
export async function safeParsePDF(dataBuffer) {
  try {
    const pdfParseFunc = await loadPdfParse()
    
    // Parse the PDF with error handling for test file issues
    const result = await pdfParseFunc(dataBuffer, {
      // Set options to prevent test file access
      normalizeWhitespace: false,
      disableCombineTextItems: false
    })
    
    // Normalize the result to include pageCount property and better page detection
    const normalizedResult = {
      ...result,
      pageCount: result.numpages || estimatePageCount(result.text) || 1
    }
    
    console.log('✅ PDF parsed successfully, text length:', normalizedResult.text?.length || 0, 'pages:', normalizedResult.pageCount)
    return normalizedResult
  } catch (error) {
    // Filter out test file errors and focus on actual parsing errors
    if (error.message?.includes('test/data') || error.message?.includes('05-versions-space.pdf')) {
      console.log('⚠️ Ignoring test file error, attempting direct parse...')
      try {
        const pdfParseFunc = await loadPdfParse()
        const result = await pdfParseFunc(dataBuffer)
        
        // Normalize the result here too
        const normalizedResult = {
          ...result,
          pageCount: result.numpages || estimatePageCount(result.text) || 1
        }
        
        console.log('✅ PDF parsed successfully after ignoring test error, text length:', normalizedResult.text?.length || 0, 'pages:', normalizedResult.pageCount)
        return normalizedResult
      } catch (parseError) {
        console.error('PDF parsing error after retry:', parseError.message)
        throw new Error(`Failed to parse PDF: ${parseError.message}`)
      }
    } else {
      console.error('PDF parsing error:', error.message)
      throw new Error(`Failed to parse PDF: ${error.message}`)
    }
  }
}

/**
 * Estimate page count from text content when PDF metadata is unreliable
 */
function estimatePageCount(text) {
  if (!text || typeof text !== 'string') {
    return 1;
  }

  // Look for form feed characters (page breaks)
  const formFeeds = (text.match(/\f/g) || []).length;
  if (formFeeds > 0) {
    return formFeeds + 1; // Form feeds indicate page breaks
  }

  // Look for "Page X" patterns
  const pagePatterns = text.match(/(?:^|\n)\s*(?:Page\s+|p\.?\s*)(\d+)/gi);
  if (pagePatterns && pagePatterns.length > 0) {
    const pageNumbers = pagePatterns.map(match => {
      const num = match.match(/(\d+)/);
      return num ? parseInt(num[1]) : 0;
    });
    const maxPage = Math.max(...pageNumbers);
    if (maxPage > 1 && maxPage < 1000) { // Reasonable page count
      return maxPage;
    }
  }

  // Look for chapter/section patterns that might indicate multiple pages
  const chapterPatterns = (text.match(/(?:^|\n)\s*(?:Chapter|Section|Part)\s+\d+/gi) || []).length;
  if (chapterPatterns > 3) {
    return Math.min(chapterPatterns, Math.ceil(text.length / 2000)); // Estimate based on content
  }

  // Fallback: estimate based on text length (rough estimation)
  const avgCharsPerPage = 2500; // Average characters per page
  const estimatedPages = Math.ceil(text.length / avgCharsPerPage);
  
  // Cap the estimation to reasonable limits
  return Math.max(1, Math.min(estimatedPages, 200));
}

/**
 * Check if uploaded file exists
 */
export function checkFileExists(filePath) {
  return fs.existsSync(filePath)
}

/**
 * Get file stats
 */
export function getFileStats(filePath) {
  try {
    return fs.statSync(filePath)
  } catch (error) {
    return null
  }
}