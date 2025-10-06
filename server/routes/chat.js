// Chat routes
import { Router } from 'express'
import { processChatMessage } from '../services/chatService.js'
import { sanitizeMessage } from '../utils/ragUtils.js'

const router = Router()

/**
 * Chat endpoint with RAG and Nebius AI integration
 */
router.post('/chat', async (req, res) => {
  try {
    const { chatId, message, pdfId } = req.body

    // Validate input
    if (!chatId || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: chatId and message are required' 
      })
    }

    // Process the chat message
    const result = await processChatMessage(chatId, message, pdfId)

    // Log for debugging
    console.log(`Chat response for ${chatId}:`, {
      messageLength: message.length,
      chunksRetrieved: result.metadata.chunksUsed,
      responseLength: result.answer.length,
      citationsCount: result.citations.length
    })

    res.json(result)

  } catch (error) {
    console.error('Chat endpoint error:', error)
    
    // Handle specific error types
    if (error.message.includes('Invalid message')) {
      return res.status(400).json({ error: error.message })
    }
    
    if (error.message.includes('API key')) {
      return res.status(500).json({ error: 'AI service configuration error' })
    }
    
    res.status(500).json({ error: 'Failed to process chat message' })
  }
})

/**
 * Health check for chat service
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'chat'
  })
})

export default router