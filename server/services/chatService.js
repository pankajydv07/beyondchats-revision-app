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

// Initialize Nebius AI client
const nebiusClient = new OpenAI({
  baseURL: 'https://api.studio.nebius.com/v1/',
  apiKey: config.nebiusApiKey,
})

/**
 * Process chat message with optional PDF context
 */
export async function processChatMessage(chatId, message, pdfId = null) {
  try {
    const sanitizedMessage = sanitizeMessage(message)
    let retrievedChunks = []
    let citations = []

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
      // RAG-based response with context
      aiResponse = await generateRAGResponse(sanitizedMessage, retrievedChunks)
      
      // Add metadata about retrieved chunks
      citations = retrievedChunks.map(chunk => ({
        page: chunk.page,
        snippet: chunk.text.substring(0, 150) + (chunk.text.length > 150 ? '...' : ''),
        similarity: Math.round(chunk.similarity * 100) / 100
      }))
      
    } else {
      // General conversation without PDF context
      aiResponse = await generateGeneralResponse(sanitizedMessage)
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

    return {
      success: true,
      answer: aiResponse.answer,
      citations: finalCitations,
      metadata: {
        chatId,
        pdfId: pdfId || null,
        chunksUsed: retrievedChunks.length,
        timestamp: new Date().toISOString()
      }
    }

  } catch (error) {
    console.error('Chat processing error:', error)
    throw error
  }
}

/**
 * Generate RAG response with PDF context
 */
async function generateRAGResponse(message, retrievedChunks) {
  const ragPrompt = constructRAGPrompt(message, retrievedChunks)
  
  console.log('🤖 Making Nebius API call with RAG prompt...')
  console.log('📝 RAG prompt preview:', ragPrompt.substring(0, 200) + '...')
  
  try {
    // Log prompt length for debugging
    const totalPromptLength = createSystemPrompt().length + ragPrompt.length
    console.log('📏 Total prompt length:', totalPromptLength)
    
    const chatCompletion = await nebiusClient.chat.completions.create({
      model: config.chatModel,
      temperature: 0.3,
      max_tokens: 10000,
      top_p: 0.95,
      messages: [
        {
          role: "system",
          content: createSystemPrompt()
        },
        {
          role: "user",
          content: ragPrompt
        }
      ]
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
 * Generate general response without PDF context
 */
async function generateGeneralResponse(message) {
  const chatCompletion = await nebiusClient.chat.completions.create({
    model: config.chatModel,
    temperature: 0.6,
    max_tokens: 1024,
    top_p: 0.95,
    messages: [
      {
        role: "system",
        content: "You are a helpful educational assistant. Provide clear, accurate, and educational responses to help students learn better."
      },
      {
        role: "user",
        content: message
      }
    ]
  })

  const rawResponse = chatCompletion.choices[0]?.message?.content || ''
  return {
    answer: rawResponse,
    citations: []
  }
}