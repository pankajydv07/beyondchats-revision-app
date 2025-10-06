// Embeddings routes
import { Router } from 'express'
import { 
  generateEmbedding, 
  generateEmbeddingsBatch,
  searchSimilarChunks
} from '../embeddings.js'
import { supabase } from '../embeddings.js'

const router = Router()

/**
 * Create embeddings for text chunks
 */
router.post('/create-embeddings', async (req, res) => {
  try {
    const { texts, pdfId } = req.body
    
    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ error: 'texts array is required' })
    }
    
    if (!pdfId) {
      return res.status(400).json({ error: 'pdfId is required' })
    }

    console.log(`🔄 Creating embeddings for ${texts.length} chunks`)
    
    const embeddings = await generateEmbeddingsBatch(texts)
    
    res.json({
      success: true,
      embeddings: embeddings.length,
      pdfId
    })

  } catch (error) {
    console.error('Create embeddings error:', error)
    res.status(500).json({ error: 'Failed to create embeddings' })
  }
})

/**
 * Search for similar chunks
 */
router.post('/search-chunks', async (req, res) => {
  try {
    const { query, pdfId, limit = 5 } = req.body
    
    if (!query) {
      return res.status(400).json({ error: 'query is required' })
    }

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query)
    
    // Search for similar chunks
    const chunks = await searchSimilarChunks(pdfId, queryEmbedding, limit)
    
    res.json({
      success: true,
      query,
      chunks,
      total: chunks.length
    })

  } catch (error) {
    console.error('Search chunks error:', error)
    res.status(500).json({ error: 'Failed to search chunks' })
  }
})

/**
 * Get embeddings status for a PDF
 */
router.get('/embeddings-status/:pdfId', async (req, res) => {
  try {
    const { pdfId } = req.params
    
    if (!pdfId) {
      return res.status(400).json({ error: 'pdfId is required' })
    }

    // Check if embeddings exist for this PDF
    let configured = false
    let chunksCount = 0
    
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('pdf_chunks')
          .select('id')
          .eq('pdf_id', pdfId)
        
        if (!error) {
          configured = true
          chunksCount = data?.length || 0
        }
      } catch (dbError) {
        console.log('Database check failed:', dbError.message)
      }
    }

    res.json({
      configured,
      pdfId: decodeURIComponent(pdfId),
      chunksCount
    })

  } catch (error) {
    console.error('Embeddings status error:', error)
    res.status(500).json({ error: 'Failed to get embeddings status' })
  }
})

export default router