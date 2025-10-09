/**
 * In-Memory Chat Context Cache
 * 
 * This module provides fast, in-memory caching of chat conversations while maintaining
 * full persistence to Supabase. It enables continuous conversation context without
 * needing to fetch chat history on every API call.
 * 
 * Key features:
 * - In-memory storage of recent messages per chatId
 * - Automatic cache miss handling by fetching from Supabase
 * - Message trimming to manage token usage (configurable limit)
 * - Inactive session cleanup to prevent memory bloat
 * - Thread-safe operations with proper error handling
 * - Graceful degradation on cache failures
 */

import { supabase } from '../supabaseClient.js'

// Cache configuration
const CACHE_CONFIG = {
  maxMessagesPerChat: 20,        // Keep last 20 messages (10 user + 10 assistant)
  cleanupIntervalMs: 300000,     // Cleanup every 5 minutes
  inactiveTimeoutMs: 1800000,    // Mark inactive after 30 minutes
  maxCachedChats: 1000           // Prevent unlimited memory growth
}

// In-memory storage
const chatCache = new Map()

// Track last access times for cleanup
const lastAccessTimes = new Map()

/**
 * Chat context structure:
 * {
 *   chatId: string,
 *   userId: string,
 *   pdfId: string|null,
 *   messages: [
 *     { role: 'user'|'assistant', content: string, timestamp: string },
 *     ...
 *   ],
 *   lastAccessed: number,
 *   isLoaded: boolean
 * }
 */

/**
 * Get chat context from cache or fetch from Supabase
 */
export async function getChatContext(chatId, userId) {
  try {
    // Update access time
    lastAccessTimes.set(chatId, Date.now())
    
    // Check if already cached
    if (chatCache.has(chatId)) {
      const context = chatCache.get(chatId)
      context.lastAccessed = Date.now()
      
      console.log(`📋 Cache hit for chatId: ${chatId} (${context.messages.length} messages)`)
      return context
    }

    console.log(`🔍 Cache miss for chatId: ${chatId}, fetching from Supabase...`)
    
    // Fetch chat session info
    const { data: chatSession, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id, user_id, pdf_id, title')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single()

    if (sessionError || !chatSession) {
      console.log(`❌ Chat session not found: ${chatId}`)
      return null
    }

    // Fetch recent messages for context
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('content, is_user, timestamp')
      .eq('chat_id', chatId)
      .order('timestamp', { ascending: true })
      .limit(CACHE_CONFIG.maxMessagesPerChat)

    if (messagesError) {
      console.error('❌ Error fetching messages for cache:', messagesError)
      return null
    }

    // Convert to LLM-friendly format
    const formattedMessages = (messages || []).map(msg => ({
      role: msg.is_user ? 'user' : 'assistant',
      content: msg.content,
      timestamp: msg.timestamp
    }))

    // Create context object
    const context = {
      chatId: chatSession.id,
      userId: chatSession.user_id,
      pdfId: chatSession.pdf_id,
      title: chatSession.title,
      messages: formattedMessages,
      lastAccessed: Date.now(),
      isLoaded: true
    }

    // Store in cache
    setCacheWithLimits(chatId, context)
    
    console.log(`✅ Loaded chat context: ${chatId} (${formattedMessages.length} messages)`)
    return context

  } catch (error) {
    console.error('❌ Error in getChatContext:', error)
    return null
  }
}

/**
 * Add new message to chat context and persist to Supabase
 */
export async function addMessageToContext(chatId, userId, userMessage, assistantResponse, pdfId = null) {
  try {
    const timestamp = new Date().toISOString()
    
    // Get or create context
    let context = await getChatContext(chatId, userId)
    
    if (!context) {
      // Create new context for new chat
      context = {
        chatId,
        userId,
        pdfId,
        title: userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''),
        messages: [],
        lastAccessed: Date.now(),
        isLoaded: true
      }
      
      // Create chat session in Supabase
      const { error: sessionError } = await supabase
        .from('chat_sessions')
        .insert([{
          id: chatId,
          user_id: userId,
          title: context.title,
          pdf_id: pdfId,
          created_at: timestamp,
          updated_at: timestamp
        }])

      if (sessionError) {
        console.error('❌ Error creating chat session:', sessionError)
        throw new Error('Failed to create chat session')
      }
    }

    // Add user message to context
    const userMsg = {
      role: 'user',
      content: userMessage,
      timestamp
    }
    context.messages.push(userMsg)

    // Add assistant response to context
    const assistantMsg = {
      role: 'assistant', 
      content: assistantResponse,
      timestamp
    }
    context.messages.push(assistantMsg)

    // Trim messages if needed (keep conversation manageable)
    if (context.messages.length > CACHE_CONFIG.maxMessagesPerChat) {
      const excess = context.messages.length - CACHE_CONFIG.maxMessagesPerChat
      context.messages = context.messages.slice(excess)
      console.log(`✂️  Trimmed ${excess} old messages from cache for chatId: ${chatId}`)
    }

    // Update cache
    context.lastAccessed = Date.now()
    setCacheWithLimits(chatId, context)

    // Persist to Supabase (both messages)
    const messagesToSave = [
      {
        chat_id: chatId,
        content: userMessage,
        is_user: true,
        timestamp
      },
      {
        chat_id: chatId,
        content: assistantResponse,
        is_user: false,
        timestamp
      }
    ]

    const { error: messagesError } = await supabase
      .from('chat_messages')
      .insert(messagesToSave)

    if (messagesError) {
      console.error('❌ Error persisting messages to Supabase:', messagesError)
      // Don't throw here - cache still works, just persistence failed
    }

    // Update chat session timestamp
    const { error: updateError } = await supabase
      .from('chat_sessions')
      .update({ updated_at: timestamp })
      .eq('id', chatId)

    if (updateError) {
      console.error('❌ Error updating chat session timestamp:', updateError)
    }

    console.log(`💾 Added messages to context: ${chatId} (cache: ${context.messages.length} messages)`)
    return context

  } catch (error) {
    console.error('❌ Error in addMessageToContext:', error)
    throw error
  }
}

/**
 * Get conversation history for LLM context
 * Returns messages in format suitable for AI models
 */
export function getConversationHistory(context, includeSystemPrompt = false) {
  if (!context || !context.messages) {
    return []
  }

  const messages = context.messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }))

  if (includeSystemPrompt) {
    return [
      {
        role: 'system',
        content: 'You are a helpful educational assistant. Provide clear, accurate responses. When explaining mathematical concepts, use LaTeX formatting: $expression$ for inline math and $$expression$$ for display math.'
      },
      ...messages
    ]
  }

  return messages
}

/**
 * Set cache entry with size limits
 */
function setCacheWithLimits(chatId, context) {
  // Check if we need to evict old entries
  if (chatCache.size >= CACHE_CONFIG.maxCachedChats) {
    evictOldestEntries(Math.floor(CACHE_CONFIG.maxCachedChats * 0.1)) // Remove 10% of oldest
  }
  
  chatCache.set(chatId, context)
  lastAccessTimes.set(chatId, Date.now())
}

/**
 * Evict oldest cache entries
 */
function evictOldestEntries(count) {
  const entries = Array.from(lastAccessTimes.entries())
    .sort((a, b) => a[1] - b[1]) // Sort by access time (oldest first)
    .slice(0, count)

  for (const [chatId] of entries) {
    chatCache.delete(chatId)
    lastAccessTimes.delete(chatId)
  }

  console.log(`🧹 Evicted ${count} oldest cache entries`)
}

/**
 * Clean up inactive chat sessions
 */
function cleanupInactiveChats() {
  const now = Date.now()
  const inactiveThreshold = now - CACHE_CONFIG.inactiveTimeoutMs
  
  let cleanedCount = 0
  
  for (const [chatId, lastAccess] of lastAccessTimes.entries()) {
    if (lastAccess < inactiveThreshold) {
      chatCache.delete(chatId)
      lastAccessTimes.delete(chatId)
      cleanedCount++
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} inactive chat sessions`)
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    totalChats: chatCache.size,
    maxChats: CACHE_CONFIG.maxCachedChats,
    oldestAccess: Math.min(...lastAccessTimes.values()),
    newestAccess: Math.max(...lastAccessTimes.values()),
    config: CACHE_CONFIG
  }
}

/**
 * Clear specific chat from cache (useful for testing)
 */
export function clearChatFromCache(chatId) {
  const removed = chatCache.delete(chatId)
  lastAccessTimes.delete(chatId)
  return removed
}

/**
 * Clear entire cache (useful for testing/debugging)
 */
export function clearAllCache() {
  const count = chatCache.size
  chatCache.clear()
  lastAccessTimes.clear()
  console.log(`🧹 Cleared entire cache (${count} entries)`)
  return count
}

// Start cleanup interval
const cleanupInterval = setInterval(cleanupInactiveChats, CACHE_CONFIG.cleanupIntervalMs)

// Graceful shutdown cleanup
process.on('SIGINT', () => {
  clearInterval(cleanupInterval)
})

process.on('SIGTERM', () => {
  clearInterval(cleanupInterval)
})

console.log('📋 Chat context cache initialized')
console.log(`   Max messages per chat: ${CACHE_CONFIG.maxMessagesPerChat}`)
console.log(`   Cleanup interval: ${CACHE_CONFIG.cleanupIntervalMs / 1000}s`)
console.log(`   Inactive timeout: ${CACHE_CONFIG.inactiveTimeoutMs / 1000}s`)