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
    
    console.log('✅ PDF parsed successfully, text length:', result.text?.length || 0)
    return result
  } catch (error) {
    // Filter out test file errors and focus on actual parsing errors
    if (error.message?.includes('test/data') || error.message?.includes('05-versions-space.pdf')) {
      console.log('⚠️ Ignoring test file error, attempting direct parse...')
      try {
        const pdfParseFunc = await loadPdfParse()
        const result = await pdfParseFunc(dataBuffer)
        console.log('✅ PDF parsed successfully after ignoring test error, text length:', result.text?.length || 0)
        return result
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