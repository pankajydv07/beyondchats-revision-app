/**
 * Simple test for chat cache functionality
 * This script tests the in-memory cache to ensure conversation context is maintained
 */

import { getChatContext, addMessageToContext, getCacheStats, clearAllCache } from '../services/chatCache.js'

async function testChatCache() {
  console.log('🧪 Testing Chat Cache Implementation...\n')

  try {
    // Clear cache for clean test
    clearAllCache()
    
    // Test data
    const testChatId = 'test-chat-' + Date.now()
    const testUserId = 'test-user-' + Date.now()
    const testMessage1 = 'Hello, can you explain photosynthesis?'
    const testResponse1 = 'Photosynthesis is the process by which plants convert light energy into chemical energy...'
    const testMessage2 = 'What are the main steps involved?'
    const testResponse2 = 'The main steps of photosynthesis are: 1) Light absorption, 2) Water splitting, 3) Carbon fixation...'

    console.log('1️⃣ Testing cache miss (new chat)')
    const initialContext = await getChatContext(testChatId, testUserId)
    console.log('   Result:', initialContext ? `Found ${initialContext.messages.length} messages` : 'No context found (expected)')

    console.log('\n2️⃣ Testing adding first message to context')
    const context1 = await addMessageToContext(testChatId, testUserId, testMessage1, testResponse1)
    console.log('   Result:', context1 ? `Context created with ${context1.messages.length} messages` : 'Failed to create context')

    console.log('\n3️⃣ Testing cache hit (existing chat)')
    const retrievedContext = await getChatContext(testChatId, testUserId)
    console.log('   Result:', retrievedContext ? `Found ${retrievedContext.messages.length} messages` : 'Cache miss (unexpected)')

    console.log('\n4️⃣ Testing conversation continuity')
    const context2 = await addMessageToContext(testChatId, testUserId, testMessage2, testResponse2)
    console.log('   Result:', context2 ? `Context has ${context2.messages.length} total messages` : 'Failed to add message')

    console.log('\n5️⃣ Testing cache statistics')
    const stats = getCacheStats()
    console.log('   Cache stats:', {
      totalChats: stats.totalChats,
      maxChats: stats.maxChats
    })

    console.log('\n✅ Chat Cache Test Completed Successfully!')
    
    // Display final context for verification
    if (context2) {
      console.log('\n📜 Final conversation context:')
      context2.messages.forEach((msg, index) => {
        console.log(`   ${index + 1}. [${msg.role}]: ${msg.content.substring(0, 60)}...`)
      })
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

// Run the test
testChatCache()