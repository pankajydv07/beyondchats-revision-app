// Test script to check chat responses in sequence
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';
const PDF_ID = '1759776381886-Assignment_ BeyondChats - FSWD.pdf';

const queries = [
  'What are optional features?',
  'What are must have features?', 
  'Give full list of must have and optional features',
  'What is the scope of this project?',
  'What technologies should be used?'
];

async function testChat() {
  console.log('🧪 Testing chat responses in sequence...\n');
  
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const chatId = `test_sequence_${i + 1}`;
    
    console.log(`\n🔍 Query ${i + 1}: "${query}"`);
    console.log('⏱️  Sending request...');
    
    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          chatId: chatId,
          pdfId: PDF_ID
        })
      });
      
      if (!response.ok) {
        console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
        continue;
      }
      
      const result = await response.json();
      
      console.log(`✅ Response received:`);
      console.log(`   - Answer length: ${result.answer?.length || 0} chars`);
      console.log(`   - Citations: ${result.citations?.length || 0}`);
      console.log(`   - Chunks used: ${result.metadata?.chunksUsed || 0}`);
      
      if (result.answer) {
        console.log(`   - Answer preview: ${result.answer.substring(0, 100)}...`);
      }
      
      // Wait 2 seconds between requests to avoid rate limiting
      if (i < queries.length - 1) {
        console.log('⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
  }
  
  console.log('\n🏁 Test completed!');
}

// Run the test
testChat().catch(console.error);