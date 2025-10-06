// Simple script to test Supabase connection and create tables manually
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

async function testAndSetupDatabase() {
  try {
    console.log('🔄 Testing Supabase connection...')
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY // Use anon key
    )
    
    console.log('✅ Supabase client created')
    
    // Try to access pdf_chunks table directly
    console.log('🔄 Testing pdf_chunks table access...')
    
    const { data: testChunks, error: testError } = await supabase
      .from('pdf_chunks')
      .select('id, pdf_id')
      .limit(1)
      
    if (testError) {
      console.error('❌ Cannot access pdf_chunks table:', testError.message)
      console.log('\n📋 The table likely doesn\'t exist. You need to:')
      console.log('1. Go to your Supabase dashboard SQL Editor')
      console.log('2. Copy and paste the contents of database/supabase_schema.sql')
      console.log('3. Execute the SQL to create tables and functions')
      return
    }
    
    console.log('✅ pdf_chunks table exists and is accessible')
    console.log('📊 Test query returned:', testChunks?.length || 0, 'chunks')
    
    // Check for the specific PDF
    const { data: pdfChunks, error: pdfError } = await supabase
      .from('pdf_chunks')
      .select('id, pdf_id, chunk_index')
      .eq('pdf_id', '1759749014165-Assignment_ BeyondChats - FSWD.pdf')
      
    if (pdfError) {
      console.error('❌ Error querying PDF chunks:', pdfError.message)
    } else {
      console.log('✅ Found', pdfChunks?.length || 0, 'chunks for the assignment PDF')
    }
    
    // Test the search function
    console.log('🔄 Testing search_pdf_chunks function...')
    try {
      const { data: searchResult, error: searchError } = await supabase.rpc('search_pdf_chunks', {
        query_embedding: Array(4096).fill(0.1), // Dummy embedding
        pdf_id_filter: '1759749014165-Assignment_ BeyondChats - FSWD.pdf',
        match_threshold: 0.1,
        match_count: 5
      })
      
      if (searchError) {
        console.error('❌ search_pdf_chunks function error:', searchError.message)
        console.log('⚠️ The search function is missing - you need to execute the SQL schema')
      } else {
        console.log('✅ search_pdf_chunks function is working')
        console.log('� Search returned:', searchResult?.length || 0, 'results')
      }
    } catch (err) {
      console.error('❌ search_pdf_chunks function not found:', err.message)
      console.log('⚠️ The search function is missing - you need to execute the SQL schema')
    }
    
    // Try to check for chunks
    try {
      const { data: chunks, error: chunksError } = await supabase
        .from('pdf_chunks')
        .select('count')
        .limit(1)
        
      if (chunksError) {
        console.log('❌ Cannot access pdf_chunks table:', chunksError.message)
      } else {
        console.log('✅ pdf_chunks table is accessible')
      }
    } catch (err) {
      console.log('❌ Error accessing pdf_chunks:', err.message)
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message)
  }
}

testAndSetupDatabase()