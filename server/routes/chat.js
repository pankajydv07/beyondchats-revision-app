// Chat routes
import { Router } from 'express'
import { processChatMessage } from '../services/chatService.js'
import { sanitizeMessage } from '../utils/ragUtils.js'
import { requireAuth } from '../middleware/auth.js'
import { supabase } from '../supabaseClient.js'

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
 * Save chat message to database
 */
router.post('/save-chat', requireAuth, async (req, res) => {
  try {
    const { userId, chatId, message, isUser = true, response = null } = req.body

    // Validate input
    if (!userId || !chatId || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, chatId, and message are required' 
      })
    }

    // Validate UUID format for userId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID format'
      })
    }

    // Check if chat session exists, create if not
    const { data: existingChat, error: chatCheckError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single()

    if (chatCheckError && chatCheckError.code === 'PGRST116') {
      // Chat session doesn't exist, create it
      const { error: createChatError } = await supabase
        .from('chat_sessions')
        .insert([{
          id: chatId,
          user_id: userId,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])

      if (createChatError) {
        console.error('Error creating chat session:', createChatError)
        return res.status(500).json({ error: 'Failed to create chat session' })
      }
    } else if (chatCheckError) {
      console.error('Error checking chat session:', chatCheckError)
      return res.status(500).json({ error: 'Failed to verify chat session' })
    }

    // Save the message
    const messageData = {
      chat_id: chatId,
      content: message,
      is_user: isUser,
      timestamp: new Date().toISOString()
    }

    const { data: savedMessage, error: messageError } = await supabase
      .from('chat_messages')
      .insert([messageData])
      .select()
      .single()

    if (messageError) {
      console.error('Error saving message:', messageError)
      return res.status(500).json({ error: 'Failed to save message' })
    }

    // If there's a response (AI message), save it too
    if (response && !isUser) {
      const responseData = {
        chat_id: chatId,
        content: response,
        is_user: false,
        timestamp: new Date().toISOString()
      }

      const { error: responseError } = await supabase
        .from('chat_messages')
        .insert([responseData])

      if (responseError) {
        console.error('Error saving AI response:', responseError)
      }
    }

    // Update chat session's updated_at timestamp
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId)

    res.json({
      success: true,
      message: savedMessage
    })

  } catch (error) {
    console.error('Save chat endpoint error:', error)
    res.status(500).json({ error: 'Failed to save chat message' })
  }
})

/**
 * Get chat history for a user
 */
router.get('/chats', requireAuth, async (req, res) => {
  try {
    const { userId } = req.query

    // Validate input
    if (!userId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: userId' 
      })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID format'
      })
    }

    // Fetch chat sessions for the user
    const { data: chatSessions, error: sessionsError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (sessionsError) {
      console.error('Error fetching chat sessions:', sessionsError)
      return res.status(500).json({ error: 'Failed to fetch chat sessions' })
    }

    // For each chat session, get the latest message for preview
    const chatsWithPreview = await Promise.all(
      chatSessions.map(async (chat) => {
        const { data: latestMessage, error: messageError } = await supabase
          .from('chat_messages')
          .select('content, timestamp, is_user')
          .eq('chat_id', chat.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single()

        return {
          ...chat,
          lastMessage: messageError ? null : latestMessage
        }
      })
    )

    res.json({
      success: true,
      chats: chatsWithPreview
    })

  } catch (error) {
    console.error('Get chats endpoint error:', error)
    res.status(500).json({ error: 'Failed to fetch chat history' })
  }
})

/**
 * Get messages for a specific chat
 */
router.get('/chat/:chatId/messages', requireAuth, async (req, res) => {
  try {
    const { chatId } = req.params
    const { userId } = req.query

    // Validate input
    if (!userId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: userId' 
      })
    }

    // Verify chat belongs to user
    const { data: chatSession, error: chatError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single()

    if (chatError || !chatSession) {
      return res.status(404).json({ error: 'Chat not found or access denied' })
    }

    // Fetch messages for the chat
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('timestamp', { ascending: true })

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return res.status(500).json({ error: 'Failed to fetch messages' })
    }

    res.json({
      success: true,
      messages: messages || []
    })

  } catch (error) {
    console.error('Get messages endpoint error:', error)
    res.status(500).json({ error: 'Failed to fetch chat messages' })
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