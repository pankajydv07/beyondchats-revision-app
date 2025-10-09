// File upload routes
import { Router } from 'express'
import { join } from 'path'
import { upload } from '../middleware/index.js'
import { config } from '../config/index.js'
import { safeParsePDF, checkFileExists } from '../services/pdfService.js'
import { processPDFForEmbeddings } from '../utils/textChunking.js'
import { generateEmbeddingsBatch, storePDFChunks } from '../embeddings.js'
import { requireAuth } from '../middleware/auth.js'
import { supabase } from '../supabaseClient.js'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

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
 * Upload PDF to Supabase storage and store metadata
 */
router.post('/upload-pdf', requireAuth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      })
    }

    const { userId } = req.body
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      })
    }

    const fileId = uuidv4()
    const fileName = req.file.originalname
    const filePath = req.file.path
    const fileSize = req.file.size

    console.log('📄 Processing PDF upload:', fileName)

    // Read file buffer
    const fileBuffer = fs.readFileSync(filePath)

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(`${userId}/${fileId}.pdf`, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return res.status(500).json({
        success: false,
        error: 'Failed to upload PDF to storage'
      })
    }

    // Store PDF metadata in database
    const { data: pdfFile, error: dbError } = await supabase
      .from('pdf_files')
      .insert([{
        id: fileId,
        user_id: userId,
        file_name: fileName,
        original_name: fileName,
        file_url: uploadData.path,
        file_size: fileSize,
        created_at: new Date().toISOString(),
        processing_status: 'processing'
      }])
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Try to clean up uploaded file
      await supabase.storage.from('pdfs').remove([uploadData.path])
      return res.status(500).json({
        success: false,
        error: 'Failed to store PDF metadata'
      })
    }

    // Start background processing for text extraction and embeddings
    // Don't clean up local file yet - pass it to background processing
    processUploadedPDF(fileId, userId, filePath, uploadData.path)
      .finally(() => {
        // Clean up local file after processing is complete
        try {
          fs.unlinkSync(filePath)
        } catch (cleanupError) {
          console.warn('Failed to clean up local file after processing:', cleanupError)
        }
      })
      .catch(error => {
        console.error('Background PDF processing failed:', error)
        // Update status to failed
        supabase
          .from('pdf_files')
          .update({ processing_status: 'failed' })
          .eq('id', fileId)
          .then(() => console.log('Updated PDF status to failed'))
      })

    res.json({
      success: true,
      fileId,
      filename: fileName,
      size: fileSize,
      status: 'processing',
      message: 'PDF uploaded successfully. Processing in background.'
    })

  } catch (error) {
    console.error('Upload PDF endpoint error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

/**
 * Background function to process uploaded PDF
 */
async function processUploadedPDF(fileId, userId, localPath, storagePath) {
  try {
    console.log('🔄 Starting background processing for PDF:', fileId)

    // Extract text from PDF (using existing pdfService)
    const pdfData = await safeParsePDF(localPath)
    if (!pdfData || !pdfData.text) {
      throw new Error('Failed to extract text from PDF')
    }

    // Update PDF file with extracted text
    await supabase
      .from('pdf_files')
      .update({ 
        total_pages: pdfData.pageCount || 1,
        processing_status: 'processing'
      })
      .eq('id', fileId)

    // Process text into chunks
    const pdfDataForChunking = {
      text: pdfData.text,
      numpages: pdfData.pageCount || 1
    }
    
    console.log('🔍 PDF data for chunking:', {
      textLength: pdfDataForChunking.text?.length,
      pages: pdfDataForChunking.numpages,
      hasText: !!pdfDataForChunking.text
    })
    
    const processedResult = await processPDFForEmbeddings(pdfDataForChunking, { fileId })
    
    console.log('📊 Processed result:', {
      hasChunks: !!processedResult.chunks,
      chunksType: typeof processedResult.chunks,
      chunksLength: processedResult.chunks?.length,
      metadata: processedResult.metadata
    })
    
    const chunks = processedResult.chunks
    
    if (!chunks || !Array.isArray(chunks)) {
      throw new Error(`Invalid chunks result: expected array, got ${typeof chunks}`)
    }
    
    console.log(`📄 Created ${chunks.length} chunks for PDF ${fileId}`)

    if (chunks.length === 0) {
      throw new Error('No chunks were created from PDF text')
    }

    // Generate embeddings for chunks
    const textsToEmbed = chunks.map(chunk => chunk.text)
    const embeddings = await generateEmbeddingsBatch(textsToEmbed)

    if (embeddings.length !== chunks.length) {
      throw new Error('Mismatch between chunks and embeddings count')
    }

    // Store chunks with embeddings in database
    const chunksWithEmbeddings = chunks.map((chunk, index) => ({
      id: uuidv4(),
      pdf_id: fileId,
      user_id: userId,
      page: chunk.page || 1, // Default to page 1 if not provided
      chunk_index: chunk.chunkIndex,
      text: chunk.text,
      embedding: JSON.stringify(embeddings[index]),
      metadata: JSON.stringify({
        start_char: chunk.startChar,
        end_char: chunk.endChar,
        word_count: chunk.text.split(' ').length
      })
    }))

    const { error: chunksError } = await supabase
      .from('pdf_chunks')
      .insert(chunksWithEmbeddings)

    if (chunksError) {
      console.error('Error storing chunks:', chunksError)
      throw chunksError
    }

    // Update PDF status to completed
    await supabase
      .from('pdf_files')
      .update({ 
        processing_status: 'completed',
        processed_at: new Date().toISOString(),
        total_chunks: chunksWithEmbeddings.length
      })
      .eq('id', fileId)

    console.log('✅ PDF processing completed successfully for:', fileId)

  } catch (error) {
    console.error('❌ PDF processing failed:', error)
    
    // Update status to failed
    await supabase
      .from('pdf_files')
      .update({ processing_status: 'failed' })
      .eq('id', fileId)
    
    throw error
  }
}

/**
 * Get user's PDF files
 */
router.get('/pdfs', requireAuth, async (req, res) => {
  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      })
    }

    // Fetch user's PDF files
    const { data: pdfs, error } = await supabase
      .from('pdf_files')
      .select('id, file_name, original_name, file_url, file_size, processing_status, total_pages, created_at, processed_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch PDF files'
      })
    }

    res.json({
      success: true,
      pdfs: pdfs || []
    })

  } catch (error) {
    console.error('Get PDFs endpoint error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

/**
 * Get PDF processing status
 */
router.get('/pdf/:fileId/status', requireAuth, async (req, res) => {
  try {
    const { fileId } = req.params

    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required'
      })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(fileId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file ID format'
      })
    }

    // Fetch PDF status
    const { data: pdf, error } = await supabase
      .from('pdf_files')
      .select('id, file_name, processing_status, total_pages, created_at, processed_at')
      .eq('id', fileId)
      .single()

    if (error) {
      console.error('Database error:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch PDF status'
      })
    }

    if (!pdf) {
      return res.status(404).json({
        success: false,
        error: 'PDF not found'
      })
    }

    // Also check if chunks exist for this PDF
    const { count: chunkCount, error: chunksError } = await supabase
      .from('pdf_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('pdf_id', fileId)

    const finalChunkCount = chunksError ? 0 : (chunkCount || 0)

    res.json({
      success: true,
      status: {
        id: pdf.id,
        fileName: pdf.file_name,
        processingStatus: pdf.processing_status,
        totalPages: pdf.total_pages,
        chunkCount: finalChunkCount,
        createdAt: pdf.created_at,
        processedAt: pdf.processed_at,
        isReady: pdf.processing_status === 'completed' && finalChunkCount > 0
      }
    })

  } catch (error) {
    console.error('Get PDF status endpoint error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
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

/**
 * Serve PDF file from Supabase storage
 */
router.get('/pdf/:fileId', requireAuth, async (req, res) => {
  try {
    const { fileId } = req.params
    const userId = req.user.id

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(fileId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file ID format'
      })
    }

    // Get PDF file info from database
    const { data: pdfFile, error: dbError } = await supabase
      .from('pdf_files')
      .select('id, file_name, file_url, user_id')
      .eq('id', fileId)
      .eq('user_id', userId) // Ensure user can only access their own files
      .single()

    if (dbError || !pdfFile) {
      console.error('PDF file not found:', dbError)
      return res.status(404).json({
        success: false,
        error: 'PDF file not found'
      })
    }

    // Download file from Supabase storage
    const { data: fileData, error: storageError } = await supabase.storage
      .from('pdfs')
      .download(pdfFile.file_url)

    if (storageError || !fileData) {
      console.error('Error downloading PDF from storage:', storageError)
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve PDF file'
      })
    }

    // Convert blob to buffer
    const buffer = Buffer.from(await fileData.arrayBuffer())

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${pdfFile.file_name}"`)
    res.setHeader('Content-Length', buffer.length)
    res.setHeader('Cache-Control', 'public, max-age=3600') // Cache for 1 hour

    // Send the PDF file
    res.send(buffer)

  } catch (error) {
    console.error('Serve PDF endpoint error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

/**
 * Delete PDF file and its metadata
 */
router.delete('/pdf/:pdfId', requireAuth, async (req, res) => {
  try {
    const { pdfId } = req.params
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    console.log(`🗑️ Deleting PDF ${pdfId} for user ${userId}`)

    // First, get the PDF metadata to check ownership and get storage path
    const { data: pdfData, error: fetchError } = await supabase
      .from('pdf_files')
      .select('*')
      .eq('id', pdfId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !pdfData) {
      console.error('PDF not found or access denied:', fetchError)
      return res.status(404).json({ error: 'PDF not found' })
    }

    // Delete PDF chunks from embeddings table
    const { error: chunksError } = await supabase
      .from('pdf_chunks')
      .delete()
      .eq('pdf_id', pdfId)

    if (chunksError) {
      console.warn('Error deleting PDF chunks:', chunksError)
    }

    // Delete the file from Supabase storage
    if (pdfData.file_url) {
      const { error: storageError } = await supabase.storage
        .from('pdfs')
        .remove([pdfData.file_url])

      if (storageError) {
        console.warn('Error deleting file from storage:', storageError)
      }
    }

    // Delete local file if it exists
    if (pdfData.file_name) {
      try {
        const localPath = join(config.uploadsDir, pdfData.file_name)
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath)
          console.log('📁 Deleted local file:', localPath)
        }
      } catch (error) {
        console.warn('Error deleting local file:', error)
      }
    }

    // Delete PDF metadata from database
    const { error: deleteError } = await supabase
      .from('pdf_files')
      .delete()
      .eq('id', pdfId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error deleting PDF metadata:', deleteError)
      return res.status(500).json({ error: 'Failed to delete PDF metadata' })
    }

    res.json({
      success: true,
      pdfId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error deleting PDF:', error)
    res.status(500).json({ error: 'Failed to delete PDF' })
  }
})

export default router