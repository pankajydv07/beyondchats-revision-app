// Chat service for handling AI conversations
import OpenAI from 'openai'
import { config } from '../config/index.js'
import {
  generateEmbedding,
  searchSimilarChunks
} from '../embeddings.js'
import {
  constructRAGPrompt,
  sanitizeMessage,
  parseAIResponse,
  createSystemPrompt,
  truncateContext
} from '../utils/ragUtils.js'
import { retrieveTopKChunks } from '../utils/vectorStorage.js'
import { getChatContext, addMessageToContext, getConversationHistory } from './chatCache.js'

// Initialize Nebius AI client
const nebiusClient = new OpenAI({
  baseURL: 'https://api.studio.nebius.com/v1/',
  apiKey: config.nebiusApiKey,
})

/**
 * Process chat message with optional PDF context and conversation history
 */
export async function processChatMessage(chatId, message, pdfId = null, userId = null) {
  try {
    const sanitizedMessage = sanitizeMessage(message)
    let retrievedChunks = []
    let citations = []

    // Get conversation context from cache (includes conversation history)
    let conversationContext = null
    if (userId) {
      conversationContext = await getChatContext(chatId, userId)
      console.log(`💭 Conversation context: ${conversationContext ? conversationContext.messages.length : 0} previous messages`)
    }

    // If pdfId is provided, retrieve relevant chunks using vector search
    if (pdfId) {
      const topK = config.topKChunks
      
      try {
        // Use Supabase vector search if configured
        if (config.supabaseUrl && config.supabaseKey) {
          // Generate embedding for the query
          const queryEmbedding = await generateEmbedding(sanitizedMessage)
          
          // Search for similar chunks
          const similarChunks = await searchSimilarChunks(pdfId, queryEmbedding, topK)
          
          // Convert to expected format
          retrievedChunks = similarChunks.map(chunk => ({
            id: chunk.id,
            text: chunk.text,
            page: chunk.page,
            similarity: chunk.similarity || 0,
            metadata: {
              chunkIndex: chunk.chunk_index
            }
          }))
          
          console.log(`🔍 Vector search found ${retrievedChunks.length} chunks for query:`, sanitizedMessage.substring(0, 100))
          console.log(`📊 Top similarities:`, retrievedChunks.slice(0, 3).map(c => c.similarity))
        } else {
          // Fallback to file-based search
          console.log('⚠️  Using fallback search - Supabase not configured')
          retrievedChunks = retrieveTopKChunks(pdfId, sanitizedMessage, topK)
        }
      } catch (searchError) {
        console.error('❌ Vector search failed, using fallback:', searchError.message)
        // Fallback to file-based search
        retrievedChunks = retrieveTopKChunks(pdfId, sanitizedMessage, topK)
      }
      
      // Truncate context to fit within token limits
      const maxContextLength = config.maxContextLength
      retrievedChunks = truncateContext(retrievedChunks, maxContextLength)
    }

    let aiResponse

    if (retrievedChunks.length > 0) {
      // RAG-based response with context and conversation history
      aiResponse = await generateRAGResponse(sanitizedMessage, retrievedChunks, conversationContext)
      
      // Add metadata about retrieved chunks
      citations = retrievedChunks.map(chunk => ({
        page: chunk.page,
        snippet: chunk.text.substring(0, 150) + (chunk.text.length > 150 ? '...' : ''),
        similarity: Math.round(chunk.similarity * 100) / 100
      }))
      
    } else {
      // General conversation without PDF context but with conversation history
      aiResponse = await generateGeneralResponse(sanitizedMessage, conversationContext)
    }

    // Only use citations from AI response if available, otherwise use retrieved chunk citations
    // But don't force citations if the answer indicates an error or empty response
    let finalCitations = aiResponse.citations || []
    
    if (finalCitations.length === 0 && 
        aiResponse.answer && 
        !aiResponse.answer.includes('empty response') && 
        !aiResponse.answer.includes('encountered an issue') &&
        citations.length > 0) {
      finalCitations = citations
    }

    // Save the conversation to cache (if userId provided)
    if (userId && chatId) {
      try {
        await addMessageToContext(chatId, userId, sanitizedMessage, aiResponse.answer, pdfId)
        console.log(`💾 Saved conversation to cache: ${chatId}`)
      } catch (cacheError) {
        console.error('❌ Error saving to cache:', cacheError)
        // Continue anyway - cache failure shouldn't break the response
      }
    }

    return {
      success: true,
      answer: aiResponse.answer,
      citations: finalCitations,
      metadata: {
        chatId,
        pdfId: pdfId || null,
        chunksUsed: retrievedChunks.length,
        timestamp: new Date().toISOString(),
        contextMessages: conversationContext ? conversationContext.messages.length : 0
      }
    }

  } catch (error) {
    console.error('Chat processing error:', error)
    throw error
  }
}

/**
 * Generate RAG response with PDF context and conversation history
 */
async function generateRAGResponse(message, retrievedChunks, conversationContext = null) {
  const ragPrompt = constructRAGPrompt(message, retrievedChunks)
  
  console.log('🤖 Making Nebius API call with RAG prompt and conversation history...')
  console.log('📝 RAG prompt preview:', ragPrompt.substring(0, 200) + '...')
  
  try {
    // Build messages array with conversation history
    const messages = [
      {
        role: "system",
        content: createSystemPrompt()
      }
    ]

    // Add conversation history if available (but limit to avoid token overflow)
    if (conversationContext && conversationContext.messages.length > 0) {
      const recentMessages = conversationContext.messages.slice(-10) // Last 10 messages
      messages.push(...recentMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      })))
      console.log(`📜 Including ${recentMessages.length} previous messages in context`)
    }

    // Add current RAG prompt
    messages.push({
      role: "user",
      content: ragPrompt
    })

    // Log prompt length for debugging
    const totalPromptLength = messages.reduce((sum, msg) => sum + msg.content.length, 0)
    console.log('📏 Total prompt length:', totalPromptLength)
    
    const chatCompletion = await nebiusClient.chat.completions.create({
      model: config.chatModel,
      temperature: 0.3,
      max_tokens: 10000,
      top_p: 0.95,
      messages
    })

    console.log('📡 Nebius API response received')
    console.log('🔍 API response structure:', {
      choices: chatCompletion.choices?.length || 0,
      usage: chatCompletion.usage,
      model: chatCompletion.model
    })
    
    const rawResponse = chatCompletion.choices[0]?.message?.content || ''
    console.log('🔍 Raw response length:', rawResponse.length)
    console.log('🔍 Raw response preview:', rawResponse.substring(0, 300) + '...')
    
    // For debugging, let's bypass parsing temporarily
    if (rawResponse.trim().length === 0) {
      console.log('❌ Empty response from Nebius API!')
      return {
        answer: "I found relevant information in your PDF, but received an empty response from the AI model. Please try asking your question again.",
        citations: []
      }
    } else {
      try {
        const aiResponse = parseAIResponse(rawResponse)
        console.log('✅ Parsed AI response:', {
          answerLength: aiResponse.answer?.length || 0,
          citationsCount: aiResponse.citations?.length || 0
        })
        return aiResponse
      } catch (parseError) {
        console.log('❌ Parse error:', parseError.message)
        // Use raw response as fallback
        return {
          answer: rawResponse.trim(),
          citations: []
        }
      }
    }
    
  } catch (apiError) {
    console.error('❌ Nebius API error:', apiError.message)
    console.error('📊 API error details:', {
      status: apiError.status,
      statusText: apiError.statusText,
      headers: apiError.headers
    })
    
    // Fallback response
    return {
      answer: `I found relevant information in the PDF but encountered an issue generating a response. Here's what I found from the context:\n\n${retrievedChunks.map(chunk => chunk.text.substring(0, 200) + '...').join('\n\n')}`,
      citations: []
    }
  }
}

/**
 * Generate general response without PDF context but with conversation history
 */
async function generateGeneralResponse(message, conversationContext = null) {
  try {
    // Build messages array with conversation history
    const messages = [
      {
        role: "system",
        content: "You are a helpful educational assistant. Provide clear, accurate, and educational responses to help students learn better. When explaining mathematical concepts, use LaTeX formatting: $expression$ for inline math and $$expression$$ for display math. Examples: $E=mc^2$, $$F = ma$$, $\\pi$, $\\alpha$, $\\frac{a}{b}$, $\\sqrt{x}$."
      }
    ]

    // Add conversation history if available
    if (conversationContext && conversationContext.messages.length > 0) {
      const recentMessages = conversationContext.messages.slice(-8) // Last 8 messages for general chat
      messages.push(...recentMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      })))
      console.log(`📜 Including ${recentMessages.length} previous messages in general chat`)
    }

    // Add current message
    messages.push({
      role: "user",
      content: message
    })

    const chatCompletion = await nebiusClient.chat.completions.create({
      model: config.chatModel,
      temperature: 0.6,
      max_tokens: 1024,
      top_p: 0.95,
      messages
    })

    const rawResponse = chatCompletion.choices[0]?.message?.content || ''
    return {
      answer: rawResponse,
      citations: []
    }
    
  } catch (error) {
    console.error('❌ Error in generateGeneralResponse:', error)
    throw error
  }
}