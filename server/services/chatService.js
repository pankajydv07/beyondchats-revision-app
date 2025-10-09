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
  truncateContext,
  estimateTokenCount,
  logRAGOperation
} from '../utils/ragUtils.js'
import { retrieveTopKChunks } from '../utils/vectorStorage.js'
import { getChatContext, addMessageToContext, getConversationHistory } from './chatCache.js'

// Initialize Nebius AI client
const nebiusClient = new OpenAI({
  baseURL: 'https://api.studio.nebius.com/v1/',
  apiKey: config.nebiusApiKey,
})

/**
 * Process chat message with enhanced conversation persistence and RAG optimization
 * @param {string} chatId - Unique chat session identifier
 * @param {string} message - User message
 * @param {string|null} pdfId - Optional PDF document ID for RAG
 * @param {string|null} userId - User ID for conversation persistence
 */
export async function processChatMessage(chatId, message, pdfId = null, userId = null) {
  try {
    const sanitizedMessage = sanitizeMessage(message);
    let retrievedChunks = [];
    let citations = [];

    // Automatic conversation context loading
    let conversationContext = null;
    if (chatId) {
      try {
        // Use a default userId if none provided (for anonymous sessions)
        const effectiveUserId = userId || `anonymous_${chatId}`;
        conversationContext = await getChatContext(chatId, effectiveUserId);
        
        logRAGOperation('context_loaded', {
          chatId,
          userId: effectiveUserId,
          messageCount: conversationContext?.messages?.length || 0
        });
      } catch (contextError) {
        logRAGOperation('context_load_failed', {
          chatId,
          error: contextError.message
        }, true);
        // Continue without context - don't fail the entire request
      }
    }

    // Enhanced PDF chunk retrieval with smart context management
    if (pdfId) {
      retrievedChunks = await retrievePDFChunks(pdfId, sanitizedMessage);
      
      // Generate citations from retrieved chunks
      citations = retrievedChunks.map(chunk => ({
        page: chunk.page,
        snippet: chunk.text.substring(0, 150) + (chunk.text.length > 150 ? '...' : ''),
        similarity: Math.round(chunk.similarity * 100) / 100
      }));
    }

    let aiResponse;

    if (retrievedChunks.length > 0) {
      // RAG-based response with enhanced context and conversation history
      aiResponse = await generateRAGResponse(sanitizedMessage, retrievedChunks, conversationContext);
    } else {
      // General conversation with conversation history
      aiResponse = await generateGeneralResponse(sanitizedMessage, conversationContext);
    }

    // Merge citations intelligently
    let finalCitations = aiResponse.citations || [];
    if (finalCitations.length === 0 && 
        aiResponse.answer && 
        !aiResponse.answer.includes('error') && 
        !aiResponse.answer.includes('empty response') &&
        citations.length > 0) {
      finalCitations = citations.slice(0, 5); // Limit to top 5 citations
    }

    // Automatic conversation persistence
    if (chatId) {
      try {
        const effectiveUserId = userId || `anonymous_${chatId}`;
        await addMessageToContext(chatId, effectiveUserId, sanitizedMessage, aiResponse.answer, pdfId);
        
        logRAGOperation('context_saved', {
          chatId,
          userId: effectiveUserId,
          messageLength: sanitizedMessage.length,
          responseLength: aiResponse.answer.length
        });
      } catch (saveError) {
        logRAGOperation('context_save_failed', {
          chatId,
          error: saveError.message
        }, true);
        // Continue anyway - save failure shouldn't break the response
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
        contextMessages: conversationContext?.messages?.length || 0,
        hasHistory: !!(conversationContext?.messages?.length)
      }
    };

  } catch (error) {
    logRAGOperation('processing_error', {
      chatId,
      error: error.message,
      stack: error.stack
    }, true);
    
    throw error;
  }
}

/**
 * Enhanced PDF chunk retrieval with fallback strategies
 */
async function retrievePDFChunks(pdfId, message) {
  const topK = config.topKChunks || 10;
  
  try {
    // Primary: Use Supabase vector search if configured
    if (config.supabaseUrl && config.supabaseKey) {
      const queryEmbedding = await generateEmbedding(message);
      const similarChunks = await searchSimilarChunks(pdfId, queryEmbedding, topK);
      
      const retrievedChunks = similarChunks.map(chunk => ({
        id: chunk.id,
        text: chunk.text,
        page: chunk.page,
        similarity: chunk.similarity || 0,
        metadata: {
          chunkIndex: chunk.chunk_index
        }
      }));
      
      logRAGOperation('vector_search_success', {
        pdfId,
        query: message.substring(0, 100),
        chunksFound: retrievedChunks.length,
        topSimilarity: retrievedChunks[0]?.similarity || 0
      });
      
      return truncateContext(retrievedChunks, config.maxContextLength || 4000);
    }
  } catch (vectorError) {
    logRAGOperation('vector_search_failed', {
      pdfId,
      error: vectorError.message
    }, true);
  }

  // Fallback: Use file-based search
  try {
    const fallbackChunks = retrieveTopKChunks(pdfId, message, topK);
    
    logRAGOperation('fallback_search_success', {
      pdfId,
      chunksFound: fallbackChunks.length
    });
    
    return truncateContext(fallbackChunks, config.maxContextLength || 4000);
  } catch (fallbackError) {
    logRAGOperation('all_search_failed', {
      pdfId,
      error: fallbackError.message
    }, true);
    
    return [];
  }
}

/**
 * Generate RAG response with PDF context and conversation history
 * Enhanced with better prompt construction, context management, and error handling
 */
async function generateRAGResponse(message, retrievedChunks, conversationContext = null) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Enhanced prompt construction with dynamic chunk selection and context
  const ragPrompt = constructRAGPrompt(message, retrievedChunks, conversationContext, {
    maxChunks: 8,                    // Optimize for token usage
    includeContextSummary: true,     // Add conversation continuity
    includeSimilarityScores: isDevelopment // Debug info in dev only
  });
  
  // Smart message building with conversation history management
  const messages = buildMessagesArray(ragPrompt, conversationContext);
  
  // Log essential operation details
  logRAGOperation('prompt_construction', {
    chunkCount: retrievedChunks.length,
    selectedChunks: Math.min(8, retrievedChunks.length),
    estimatedTokens: estimateTokenCount(ragPrompt),
    hasConversationHistory: !!(conversationContext?.messages?.length),
    messageCount: messages.length
  }, true); // Force log for monitoring
  
  try {
    const chatCompletion = await nebiusClient.chat.completions.create({
      model: config.chatModel,
      temperature: 0.3,
      max_tokens: 10000,
      top_p: 0.95,
      messages
    });

    // Log API response details (essential info only)
    logRAGOperation('api_response', {
      choices: chatCompletion.choices?.length || 0,
      usage: chatCompletion.usage,
      model: chatCompletion.model
    }, true);
    
    const rawResponse = chatCompletion.choices[0]?.message?.content || '';
    
    // Handle empty response
    if (rawResponse.trim().length === 0) {
      logRAGOperation('empty_response', { chunks: retrievedChunks.length }, true);
      return createFallbackResponse(retrievedChunks, 'empty_ai_response');
    }

    // Enhanced JSON parsing with multiple fallback strategies
    const aiResponse = parseAIResponse(rawResponse);
    
    // Log parsing success
    logRAGOperation('parse_success', {
      answerLength: aiResponse.answer?.length || 0,
      citationsCount: aiResponse.citations?.length || 0,
      hasValidStructure: !!(aiResponse.answer && Array.isArray(aiResponse.citations))
    }, true);
    
    return aiResponse;
    
  } catch (apiError) {
    // Enhanced error handling with categorization
    const errorCategory = categorizeApiError(apiError);
    
    logRAGOperation('api_error', {
      category: errorCategory,
      message: apiError.message,
      status: apiError.status
    }, true);
    
    return createFallbackResponse(retrievedChunks, errorCategory);
  }
}

/**
 * Build messages array with optimized conversation history
 */
function buildMessagesArray(ragPrompt, conversationContext) {
  const messages = [{
    role: "system",
    content: createSystemPrompt()
  }];

  // Add conversation history with intelligent truncation
  if (conversationContext?.messages?.length > 0) {
    const maxHistoryMessages = 12; // 6 exchanges max
    const recentMessages = conversationContext.messages.slice(-maxHistoryMessages);
    
    // Estimate token usage and truncate if needed
    let totalHistoryTokens = 0;
    const maxHistoryTokens = 2000; // Reserve tokens for current prompt
    const includedHistory = [];
    
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const messageTokens = estimateTokenCount(recentMessages[i].content);
      if (totalHistoryTokens + messageTokens > maxHistoryTokens) {
        break;
      }
      includedHistory.unshift({
        role: recentMessages[i].role,
        content: recentMessages[i].content
      });
      totalHistoryTokens += messageTokens;
    }
    
    messages.push(...includedHistory);
    
    logRAGOperation('history_inclusion', {
      availableMessages: recentMessages.length,
      includedMessages: includedHistory.length,
      estimatedTokens: totalHistoryTokens
    });
  }

  // Add current RAG prompt
  messages.push({
    role: "user",
    content: ragPrompt
  });

  return messages;
}

/**
 * Categorize API errors for better handling
 */
function categorizeApiError(error) {
  if (error.status === 429) return 'rate_limit';
  if (error.status >= 500) return 'server_error';
  if (error.status === 401 || error.status === 403) return 'auth_error';
  if (error.message?.includes('timeout')) return 'timeout';
  if (error.message?.includes('network')) return 'network_error';
  return 'unknown_error';
}

/**
 * Create appropriate fallback responses based on error type
 */
function createFallbackResponse(retrievedChunks, errorType) {
  const responses = {
    empty_ai_response: "I found relevant information in your PDF, but received an empty response from the AI model. Please try asking your question again.",
    rate_limit: "I'm currently experiencing high demand. Please wait a moment and try your question again.",
    server_error: "The AI service is temporarily unavailable. Please try again in a few moments.",
    auth_error: "There's an authentication issue with the AI service. Please contact support.",
    timeout: "The request took too long to process. Please try asking a more specific question.",
    network_error: "There's a connectivity issue. Please check your connection and try again.",
    unknown_error: "An unexpected error occurred while processing your question."
  };

  const answer = responses[errorType] || responses.unknown_error;
  
  // If we have retrieved chunks, append some context
  if (retrievedChunks?.length > 0) {
    const contextPreview = retrievedChunks
      .slice(0, 3) // Top 3 most relevant
      .map(chunk => `Page ${chunk.page}: ${chunk.text.substring(0, 150)}...`)
      .join('\n\n');
    
    return {
      answer: `${answer}\n\nHowever, I found some relevant information in the PDF:\n\n${contextPreview}`,
      citations: retrievedChunks.slice(0, 3).map(chunk => ({
        page: chunk.page,
        snippet: chunk.text.substring(0, 150) + '...'
      }))
    };
  }

  return { answer, citations: [] };
}

/**
 * Generate general response without PDF context but with enhanced conversation history
 */
async function generateGeneralResponse(message, conversationContext = null) {
  try {
    // Build messages with optimized conversation history
    const messages = [
      {
        role: "system",
        content: "You are a helpful educational assistant. Provide clear, accurate, and educational responses to help students learn better. When explaining mathematical concepts, use LaTeX formatting: $expression$ for inline math and $$expression$$ for display math. Examples: $E=mc^2$, $$F = ma$$, $\\pi$, $\\alpha$, $\\frac{a}{b}$, $\\sqrt{x}$."
      }
    ];

    // Add conversation history with intelligent management
    if (conversationContext?.messages?.length > 0) {
      const maxHistoryMessages = 8; // Last 4 exchanges for general chat
      const recentMessages = conversationContext.messages.slice(-maxHistoryMessages);
      
      messages.push(...recentMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      })));
      
      logRAGOperation('general_chat_history', {
        availableMessages: conversationContext.messages.length,
        includedMessages: recentMessages.length
      });
    }

    // Add current message
    messages.push({
      role: "user",
      content: message
    });

    const chatCompletion = await nebiusClient.chat.completions.create({
      model: config.chatModel,
      temperature: 0.6,
      max_tokens: 10000,
      top_p: 0.95,
      messages
    });

    const rawResponse = chatCompletion.choices[0]?.message?.content || '';
    
    logRAGOperation('general_response', {
      responseLength: rawResponse.length,
      hasHistory: !!(conversationContext?.messages?.length)
    });
    
    return {
      answer: rawResponse,
      citations: []
    };
    
  } catch (error) {
    logRAGOperation('general_response_error', {
      error: error.message
    }, true);
    
    throw error;
  }
}