// Main routes configuration
import { Router } from 'express'
import filesRouter from './files.js'
import chatRouter from './chat.js'
import embeddingsRouter from './embeddings.js'

const router = Router()

// Mount route modules
router.use('/api', filesRouter)
router.use('/api', chatRouter)
router.use('/api', embeddingsRouter)

// API health check
router.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
})

// Root endpoint
router.get('/', (req, res) => {
  res.json({ 
    message: 'BeyondChats Revision App API',
    version: '1.0.0',
    endpoints: {
      upload: 'POST /api/upload',
      extractText: 'POST /api/extract-text',
      chat: 'POST /api/chat',
      embeddings: 'POST /api/create-embeddings',
      search: 'POST /api/search-chunks',
      health: 'GET /api/health'
    }
  })
})

export default router