// File upload routes
import { Router } from 'express'
import { join } from 'path'
import { upload } from '../middleware/index.js'
import { config } from '../config/index.js'
import { safeParsePDF, checkFileExists } from '../services/pdfService.js'
import { processPDFForEmbeddings } from '../utils/textChunking.js'
import { generateEmbeddingsBatch, storePDFChunks } from '../embeddings.js'

const router = Router()

/**
 * Upload PDF file
 */
router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const fileId = req.file.filename
    console.log('📄 PDF uploaded:', fileId)

    res.json({
      success: true,
      fileId,
      filename: req.file.originalname,
      size: req.file.size
    })

  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Failed to upload file' })
  }
})

/**
 * Extract text from uploaded PDF
 */
router.post('/extract-text', async (req, res) => {
  try {
    const { fileId } = req.body

    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' })
    }

    const filePath = join(config.uploadsDir, fileId)
    
    if (!checkFileExists(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    console.log('🔄 Processing PDF:', fileId)

    // Parse PDF
    const fileBuffer = await import('fs').then(fs => fs.default.readFileSync(filePath))
    const pdfData = await safeParsePDF(fileBuffer)

    // Extract and process text
    const extractedText = pdfData.text || ''
    const pageCount = pdfData.numpages || 1
    const wordCount = extractedText.split(/\s+/).filter(word => word.length > 0).length

    console.log(`✅ Text extracted: ${wordCount} words, ${pageCount} pages`)

    // Generate embeddings automatically
    let embeddingResult = null
    try {
      console.log('🔄 Creating embeddings for PDF:', fileId)
      
      // Process PDF into chunks
      const processedData = processPDFForEmbeddings({ text: extractedText, numpages: pageCount }, {
        chunkSize: 800,
        overlap: 100,
        cleanText: true,
        validateChunks: true
      })

      const chunks = processedData.chunks.map(chunk => ({
        page: chunk.page,
        text: chunk.text
      }))

      if (chunks.length > 0) {
        // Generate embeddings
        const textChunks = chunks.map(chunk => chunk.text)
        const embeddings = await generateEmbeddingsBatch(textChunks)

        // Combine chunks with embeddings
        const chunksWithEmbeddings = chunks.map((chunk, index) => ({
          ...chunk,
          embedding: embeddings[index]
        }))

        // Store in Supabase
        const storedChunks = await storePDFChunks(fileId, chunksWithEmbeddings)
        
        embeddingResult = {
          chunksCreated: storedChunks.length,
          totalWords: processedData.metadata.totalWords,
          avgChunkSize: processedData.metadata.avgChunkSize
        }
        
        console.log(`✅ Created ${storedChunks.length} embeddings for PDF: ${fileId}`)
      }
    } catch (embeddingError) {
      console.error('❌ Embedding creation failed:', embeddingError.message)
      // Continue without failing the text extraction
    }

    res.json({
      success: true,
      textId: fileId,
      text: extractedText,
      pages: pageCount,
      wordCount,
      embeddings: embeddingResult ? {
        chunksCreated: embeddingResult.chunksCreated,
        totalWords: embeddingResult.totalWords,
        avgChunkSize: Math.round(embeddingResult.totalWords / embeddingResult.chunksCreated)
      } : null
    })

  } catch (error) {
    console.error('Text extraction error:', error)
    res.status(500).json({ error: 'Failed to extract text from PDF' })
  }
})

/**
 * Upload PDF file (alias for frontend compatibility)
 */
router.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const fileId = req.file.filename
    console.log('📄 PDF uploaded via /upload-pdf:', fileId)

    res.json({
      success: true,
      fileId,
      filename: req.file.originalname,
      size: req.file.size
    })

  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Failed to upload file' })
  }
})

/**
 * Get list of uploaded files
 */
router.get('/files', async (req, res) => {
  try {
    const fs = await import('fs')
    const files = fs.default.readdirSync(config.uploadsDir)
    
    const fileList = files
      .filter(file => file.endsWith('.pdf'))
      .map(file => {
        const filePath = join(config.uploadsDir, file)
        const stats = fs.default.statSync(filePath)
        return {
          fileId: file,
          filename: file,
          size: stats.size,
          uploadDate: stats.birthtime
        }
      })
      .sort((a, b) => b.uploadDate - a.uploadDate)

    res.json({ files: fileList })

  } catch (error) {
    console.error('Files list error:', error)
    res.status(500).json({ error: 'Failed to get files list' })
  }
})

/**
 * Get list of uploaded PDFs (alias for frontend compatibility)
 */
router.get('/list-pdfs', async (req, res) => {
  try {
    const fs = await import('fs')
    const files = fs.default.readdirSync(config.uploadsDir)
    
    const fileList = files
      .filter(file => file.endsWith('.pdf'))
      .map(file => {
        const filePath = join(config.uploadsDir, file)
        const stats = fs.default.statSync(filePath)
        return {
          fileId: file,
          filename: file,
          size: stats.size,
          uploadDate: stats.birthtime
        }
      })
      .sort((a, b) => b.uploadDate - a.uploadDate)

    res.json({ files: fileList })

  } catch (error) {
    console.error('PDF list error:', error)
    res.status(500).json({ error: 'Failed to get PDF list' })
  }
})

export default router