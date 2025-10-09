import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Nebius AI client for embeddings
const nebiusClient = new OpenAI({
  baseURL: 'https://api.studio.nebius.com/v1/',
  apiKey: process.env.NEBIUS_API_KEY,
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Generate embeddings for a single text using Nebius API
 */
async function generateEmbedding(text) {
  try {
    const response = await nebiusClient.embeddings.create({
      model: process.env.EMBED_MODEL || "Qwen/Qwen3-Embedding-8B",
      input: text
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No embedding data received from API');
    }

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Generate embeddings for multiple text chunks in batches
 */
async function generateEmbeddingsBatch(textChunks, batchSize = 10) {
  const embeddings = [];
  
  for (let i = 0; i < textChunks.length; i += batchSize) {
    const batch = textChunks.slice(i, i + batchSize);
    console.log(`Processing embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(textChunks.length / batchSize)}`);
    
    try {
      // Process batch sequentially to avoid rate limits
      const batchEmbeddings = [];
      for (const text of batch) {
        const embedding = await generateEmbedding(text);
        batchEmbeddings.push(embedding);
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      embeddings.push(...batchEmbeddings);
    } catch (error) {
      console.error(`Error processing batch starting at index ${i}:`, error);
      throw error;
    }
  }
  
  return embeddings;
}

/**
 * Store PDF chunks with embeddings in Supabase
 */
async function storePDFChunks(pdfId, chunks) {
  try {
    // Prepare data for insertion with enhanced page information
    const chunkData = chunks.map((chunk, index) => ({
      pdf_id: pdfId,
      page: typeof chunk.page === 'string' && chunk.page.includes('-') 
        ? parseInt(chunk.page.split('-')[0]) // Use first page for range
        : (parseInt(chunk.page) || chunk.page || 1),
      text: chunk.text,
      embedding: chunk.embedding,
      chunk_index: index,
      created_at: new Date().toISOString(),
      // Store additional metadata including page range and confidence
      metadata: JSON.stringify({
        pageRange: chunk.pageRange || chunk.page,
        estimationMethod: chunk.metadata?.estimationMethod || 'basic',
        confidence: chunk.metadata?.confidence || 'medium',
        startChar: chunk.startChar,
        endChar: chunk.endChar
      })
    }));

    // Insert chunks into Supabase
    const { data, error } = await supabase
      .from('pdf_chunks')
      .insert(chunkData)
      .select('id, pdf_id, page, chunk_index');

    if (error) {
      throw new Error(`Supabase insertion error: ${error.message}`);
    }

    console.log(`Successfully stored ${data.length} chunks for PDF: ${pdfId}`);
    return data;
  } catch (error) {
    console.error('Error storing PDF chunks:', error);
    throw error;
  }
}

/**
 * Search for similar chunks using vector similarity
 */
async function searchSimilarChunks(pdfId, queryEmbedding, topK = 5) {
  try {
    // Use Supabase's vector similarity search
    const { data, error } = await supabase.rpc('search_pdf_chunks', {
      query_embedding: queryEmbedding,
      pdf_id_filter: pdfId,
      match_threshold: 0.1, // Minimum similarity threshold
      match_count: topK
    });

    if (error) {
      console.error('Supabase vector search error:', error);
      // Fallback to basic search if vector search fails
      return await fallbackTextSearch(pdfId, topK);
    }

    // Enhance results with metadata information
    return (data || []).map(chunk => ({
      ...chunk,
      // Extract enhanced page information from metadata
      pageRange: chunk.metadata?.pageRange || chunk.page,
      metadata: {
        ...chunk.metadata,
        confidence: chunk.metadata?.confidence || 'medium',
        estimationMethod: chunk.metadata?.estimationMethod || 'basic'
      }
    }));
  } catch (error) {
    console.error('Error in vector search:', error);
    // Fallback to basic search
    return await fallbackTextSearch(pdfId, topK);
  }
}

/**
 * Fallback text-based search when vector search is unavailable
 */
async function fallbackTextSearch(pdfId, topK = 5) {
  try {
    const { data, error } = await supabase
      .from('pdf_chunks')
      .select('id, pdf_id, page, text, chunk_index, metadata')
      .eq('pdf_id', pdfId)
      .order('chunk_index')
      .limit(topK);

    if (error) {
      throw new Error(`Fallback search error: ${error.message}`);
    }

    return data.map(chunk => ({
      ...chunk,
      similarity: 0.5, // Default similarity for fallback
      pageRange: chunk.metadata?.pageRange || chunk.page,
      metadata: {
        ...chunk.metadata,
        confidence: chunk.metadata?.confidence || 'low',
        estimationMethod: chunk.metadata?.estimationMethod || 'fallback'
      }
    }));
  } catch (error) {
    console.error('Error in fallback search:', error);
    return [];
  }
}

/**
 * Delete all chunks for a specific PDF
 */
async function deletePDFChunks(pdfId) {
  try {
    const { error } = await supabase
      .from('pdf_chunks')
      .delete()
      .eq('pdf_id', pdfId);

    if (error) {
      throw new Error(`Error deleting PDF chunks: ${error.message}`);
    }

    console.log(`Deleted all chunks for PDF: ${pdfId}`);
  } catch (error) {
    console.error('Error deleting PDF chunks:', error);
    throw error;
  }
}

/**
 * Get chunks count for a PDF
 */
async function getPDFChunksCount(pdfId) {
  try {
    const { count, error } = await supabase
      .from('pdf_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('pdf_id', pdfId);

    if (error) {
      throw new Error(`Error counting PDF chunks: ${error.message}`);
    }

    return count || 0;
  } catch (error) {
    console.error('Error counting PDF chunks:', error);
    return 0;
  }
}

/**
 * Validate chunk data structure
 */
function validateChunkData(chunks) {
  if (!Array.isArray(chunks)) {
    throw new Error('Chunks must be an array');
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.text || typeof chunk.text !== 'string') {
      throw new Error(`Chunk ${i}: text is required and must be a string`);
    }
    if (!chunk.page || typeof chunk.page !== 'number') {
      throw new Error(`Chunk ${i}: page is required and must be a number`);
    }
    if (chunk.text.length === 0) {
      throw new Error(`Chunk ${i}: text cannot be empty`);
    }
    if (chunk.text.length > 8000) {
      throw new Error(`Chunk ${i}: text too long (max 8000 characters)`);
    }
  }
}

/**
 * Initialize database table (call this once during setup)
 */
async function initializeDatabase() {
  try {
    // Check if the table exists and has the required structure
    const { data, error } = await supabase
      .from('pdf_chunks')
      .select('count(*)')
      .limit(1);

    if (error && error.code === 'PGRST116') {
      console.log('pdf_chunks table does not exist. Please create it in Supabase.');
      console.log('Required SQL:');
      console.log(`
        CREATE TABLE pdf_chunks (
          id BIGSERIAL PRIMARY KEY,
          pdf_id TEXT NOT NULL,
          page INTEGER NOT NULL,
          text TEXT NOT NULL,
          embedding VECTOR(4096),
          chunk_index INTEGER,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX idx_pdf_chunks_pdf_id ON pdf_chunks(pdf_id);
        CREATE INDEX idx_pdf_chunks_page ON pdf_chunks(page);
        
        -- Create vector similarity search function
        CREATE OR REPLACE FUNCTION search_pdf_chunks(
          query_embedding VECTOR(4096),
          pdf_id_filter TEXT,
          match_threshold FLOAT DEFAULT 0.1,
          match_count INT DEFAULT 5
        )
        RETURNS TABLE (
          id BIGINT,
          pdf_id TEXT,
          page INTEGER,
          text TEXT,
          chunk_index INTEGER,
          similarity FLOAT
        )
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RETURN QUERY
          SELECT
            pc.id,
            pc.pdf_id,
            pc.page,
            pc.text,
            pc.chunk_index,
            1 - (pc.embedding <=> query_embedding) AS similarity
          FROM pdf_chunks pc
          WHERE pc.pdf_id = pdf_id_filter
            AND 1 - (pc.embedding <=> query_embedding) > match_threshold
          ORDER BY pc.embedding <=> query_embedding
          LIMIT match_count;
        END;
        $$;
      `);
      return false;
    }

    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    return false;
  }
}

export {
  generateEmbedding,
  generateEmbeddingsBatch,
  storePDFChunks,
  searchSimilarChunks,
  deletePDFChunks,
  getPDFChunksCount,
  validateChunkData,
  initializeDatabase,
  supabase
};