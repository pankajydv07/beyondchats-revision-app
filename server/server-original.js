import express from 'express'
import cors from 'cors'
import multer from 'multer'
import axios from 'axios'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'
import OpenAI from 'openai'
import { retrieveTopKChunks } from './utils/vectorStorage.js'
import { 
  constructRAGPrompt, 
  sanitizeMessage, 
  parseAIResponse, 
  createSystemPrompt,
  truncateContext 
} from './utils/ragUtils.js'
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  storePDFChunks,
  searchSimilarChunks,
  validateChunkData,
  initializeDatabase
} from './embeddings.js'
import {
  processPDFForEmbeddings
} from './utils/textChunking.js'

// Dynamic import for pdf-parse with proper error handling
let pdfParse
async function loadPdfParse() {
  if (!pdfParse) {
    try {
      const pdfParseModule = await import('pdf-parse')
      pdfParse = pdfParseModule.default
      console.log('✅ PDF parser loaded successfully')
    } catch (error) {
      console.error('❌ Failed to load PDF parser:', error.message)
      throw new Error('PDF parser initialization failed')
    }
  }
  return pdfParse
}

// Safe PDF parsing function
async function safeParsePDF(dataBuffer) {
  try {
    const pdfParseFunc = await loadPdfParse()
    
    // Parse the PDF with error handling for test file issues
    const result = await pdfParseFunc(dataBuffer, {
      // Set options to prevent test file access
      normalizeWhitespace: false,
      disableCombineTextItems: false
    })
    
    console.log('✅ PDF parsed successfully, text length:', result.text?.length || 0)
    return result
  } catch (error) {
    // Filter out test file errors and focus on actual parsing errors
    if (error.message?.includes('test/data') || error.message?.includes('05-versions-space.pdf')) {
      console.log('⚠️ Ignoring test file error, attempting direct parse...')
      try {
        const pdfParseFunc = await loadPdfParse()
        const result = await pdfParseFunc(dataBuffer)
        console.log('✅ PDF parsed successfully after ignoring test error, text length:', result.text?.length || 0)
        return result
      } catch (parseError) {
        console.error('PDF parsing error after retry:', parseError.message)
        throw new Error(`Failed to parse PDF: ${parseError.message}`)
      }
    } else {
      console.error('PDF parsing error:', error.message)
      throw new Error(`Failed to parse PDF: ${error.message}`)
    }
  }
}

dotenv.config()

// Initialize Nebius AI client
const nebiusClient = new OpenAI({
  baseURL: 'https://api.studio.nebius.com/v1/',
  apiKey: process.env.NEBIUS_API_KEY,
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Create uploads directory if it doesn't exist
const uploadsDir = join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Only PDF files are allowed'), false)
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
})

// Store for PDF texts and embeddings (in production, use a proper database)
const pdfStore = new Map()

// API Endpoints

// 1. Upload PDF endpoint
app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' })
    }

    const fileId = req.file.filename
    const filePath = req.file.path

    res.json({
      success: true,
      fileId,
      filename: req.file.originalname,
      size: req.file.size,
      message: 'PDF uploaded successfully'
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Failed to upload PDF' })
  }
})

// 2. Extract text from PDF endpoint
app.post('/api/extract-text', async (req, res) => {
  try {
    const { fileId, pdfBuffer } = req.body

    let dataBuffer
    if (fileId) {
      // Read from uploaded file
      const filePath = join(uploadsDir, fileId)
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' })
      }
      dataBuffer = fs.readFileSync(filePath)
    } else if (pdfBuffer) {
      // Use provided buffer
      dataBuffer = Buffer.from(pdfBuffer, 'base64')
    } else {
      return res.status(400).json({ error: 'No file ID or PDF buffer provided' })
    }

    // Parse PDF safely
    const data = await safeParsePDF(dataBuffer)
    const extractedText = data.text

    // Store the extracted text
    const textId = fileId || Date.now().toString()
    pdfStore.set(textId, {
      text: extractedText,
      pages: data.numpages,
      extractedAt: new Date()
    })

    // Generate embeddings automatically if Supabase is configured
    let embeddingsResult = null
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY && process.env.NEBIUS_API_KEY) {
      try {
        console.log(`🔄 Creating embeddings for PDF: ${textId}`)
        
        // Process PDF into chunks
        const processedData = processPDFForEmbeddings(data, {
          chunkSize: 800,
          overlap: 100,
          cleanText: true,
          validateChunks: true
        })

        const chunks = processedData.chunks.map(chunk => ({
          page: chunk.page,
          text: chunk.text
        }))

        if (chunks.length > 0) {
          // Generate embeddings
          const textChunks = chunks.map(chunk => chunk.text)
          const embeddings = await generateEmbeddingsBatch(textChunks)

          // Combine chunks with embeddings
          const chunksWithEmbeddings = chunks.map((chunk, index) => ({
            ...chunk,
            embedding: embeddings[index]
          }))

          // Store in Supabase
          const storedChunks = await storePDFChunks(textId, chunksWithEmbeddings)
          
          embeddingsResult = {
            chunksCreated: storedChunks.length,
            totalWords: processedData.metadata.totalWords,
            avgChunkSize: processedData.metadata.avgChunkSize
          }
          
          console.log(`✅ Created ${storedChunks.length} embeddings for PDF: ${textId}`)
        }
      } catch (embeddingError) {
        console.error('❌ Failed to create embeddings:', embeddingError.message)
        // Don't fail the entire request if embeddings fail
        embeddingsResult = { error: embeddingError.message }
      }
    }

    res.json({
      success: true,
      textId,
      text: extractedText,
      pages: data.numpages,
      wordCount: extractedText.split(' ').length,
      embeddings: embeddingsResult
    })
  } catch (error) {
    console.error('Text extraction error:', error)
    res.status(500).json({ error: 'Failed to extract text from PDF' })
  }
})

// 3. Generate quiz endpoint
app.post('/api/generate-quiz', async (req, res) => {
  try {
    const { textId, pdfUrl, text } = req.body

    let pdfText = text
    if (!pdfText && textId) {
      const stored = pdfStore.get(textId)
      pdfText = stored?.text
    }

    if (!pdfText) {
      return res.status(400).json({ error: 'No PDF text available for quiz generation' })
    }

    // Placeholder for LLM API call
    // In production, replace with actual API call to Nebius or other LLM service
    const mockQuiz = {
      questions: [
        {
          question: "What is the main topic discussed in this document?",
          options: ["Option A", "Option B", "Option C", "Option D"],
          correct: 0
        },
        {
          question: "Which key concept is emphasized throughout the text?",
          options: ["Concept 1", "Concept 2", "Concept 3", "Concept 4"],
          correct: 1
        }
      ]
    }

    // TODO: Replace with actual LLM API call
    /*
    const response = await axios.post('https://api.nebius.ai/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Generate a quiz with multiple choice questions based on the provided text.'
        },
        {
          role: 'user',
          content: `Generate 5 multiple choice questions based on this text: ${pdfText.substring(0, 2000)}`
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.NEBIUS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })
    */

    res.json({
      success: true,
      quiz: mockQuiz
    })
  } catch (error) {
    console.error('Quiz generation error:', error)
    res.status(500).json({ error: 'Failed to generate quiz' })
  }
})

// 4. Generate embeddings endpoint
app.post('/api/embeddings', async (req, res) => {
  try {
    const { textId, text, chunkSize = 1000 } = req.body

    let pdfText = text
    if (!pdfText && textId) {
      const stored = pdfStore.get(textId)
      pdfText = stored?.text
    }

    if (!pdfText) {
      return res.status(400).json({ error: 'No text available for embedding' })
    }

    // Chunk the text
    const chunks = []
    for (let i = 0; i < pdfText.length; i += chunkSize) {
      chunks.push(pdfText.substring(i, i + chunkSize))
    }

    // Placeholder for embedding generation
    // In production, replace with actual embedding API call
    const embeddings = chunks.map((chunk, index) => ({
      id: `${textId}_chunk_${index}`,
      text: chunk,
      embedding: new Array(768).fill(0).map(() => Math.random()), // Mock embedding
      metadata: {
        chunkIndex: index,
        textId
      }
    }))

    // TODO: Store embeddings in vector database (Supabase, Pinecone, etc.)
    /*
    const { data, error } = await supabase
      .from('embeddings')
      .insert(embeddings)
    */

    res.json({
      success: true,
      chunksCount: chunks.length,
      embeddings: embeddings.length,
      message: 'Embeddings generated and stored successfully'
    })
  } catch (error) {
    console.error('Embeddings error:', error)
    res.status(500).json({ error: 'Failed to generate embeddings' })
  }
})

// 5. RAG query endpoint
app.post('/api/rag-query', async (req, res) => {
  try {
    const { query, textId, pdfUrl } = req.body

    if (!query) {
      return res.status(400).json({ error: 'Query is required' })
    }

    // Placeholder for RAG implementation
    // 1. Generate query embedding
    // 2. Search similar chunks in vector database
    // 3. Retrieve relevant context
    // 4. Send to LLM with context

    const mockContext = "This is relevant context from the PDF document..."
    const mockAnswer = `Based on the document, ${query.toLowerCase()} relates to the key concepts discussed. Here's what I found: ${mockContext}`

    // TODO: Replace with actual RAG implementation
    /*
    // 1. Generate query embedding
    const queryEmbedding = await generateEmbedding(query)
    
    // 2. Search vector database
    const { data: similarChunks } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 5
    })
    
    // 3. Create context from similar chunks
    const context = similarChunks.map(chunk => chunk.content).join('\n\n')
    
    // 4. Send to LLM
    const response = await axios.post('https://api.nebius.ai/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Answer the question based on the provided context from the PDF document.'
        },
        {
          role: 'user',
          content: `Context: ${context}\n\nQuestion: ${query}`
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.NEBIUS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })
    */

    res.json({
      success: true,
      answer: mockAnswer,
      sources: ['Page 1', 'Page 3'] // Mock sources
    })
  } catch (error) {
    console.error('RAG query error:', error)
    res.status(500).json({ error: 'Failed to process query' })
  }
})

// Chat endpoint with RAG and Nebius AI integration
app.post('/api/chat', async (req, res) => {
  try {
    const { chatId, message, pdfId } = req.body

    // Validate input
    if (!chatId || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: chatId and message are required' 
      })
    }

    // Sanitize the user message
    const sanitizedMessage = sanitizeMessage(message)

    let retrievedChunks = []
    let citations = []

    // If pdfId is provided, retrieve relevant chunks using vector search
    if (pdfId) {
      const topK = parseInt(process.env.TOP_K_CHUNKS) || 5
      
      try {
        // Use Supabase vector search if configured
        if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
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
      const maxContextLength = parseInt(process.env.MAX_CONTEXT_LENGTH) || 4000
      retrievedChunks = truncateContext(retrievedChunks, maxContextLength)
    }

    let aiResponse
    
    if (retrievedChunks.length > 0) {
      // RAG-based response with context
      const ragPrompt = constructRAGPrompt(sanitizedMessage, retrievedChunks)
      
      console.log('🤖 Making Nebius API call with RAG prompt...')
      console.log('📝 RAG prompt preview:', ragPrompt.substring(0, 200) + '...')
      
      try {
        const chatCompletion = await nebiusClient.chat.completions.create({
          model: process.env.CHAT_MODEL || "Qwen/Qwen3-235B-A22B-Thinking-2507",
          temperature: 0.3,
          max_tokens: 1024,
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
        const rawResponse = chatCompletion.choices[0]?.message?.content || ''
        console.log('🔍 Raw response length:', rawResponse.length)
        console.log('🔍 Raw response preview:', rawResponse.substring(0, 300) + '...')
        
        // For debugging, let's bypass parsing temporarily
        if (rawResponse.trim().length === 0) {
          console.log('❌ Empty response from Nebius API!')
          aiResponse = {
            answer: "I found relevant information in your PDF, but received an empty response from the AI model. Please try asking your question again.",
            citations: []
          }
        } else {
          try {
            aiResponse = parseAIResponse(rawResponse)
            console.log('✅ Parsed AI response:', {
              answerLength: aiResponse.answer?.length || 0,
              citationsCount: aiResponse.citations?.length || 0
            })
          } catch (parseError) {
            console.log('❌ Parse error:', parseError.message)
            // Use raw response as fallback
            aiResponse = {
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
        aiResponse = {
          answer: `I found relevant information in the PDF but encountered an issue generating a response. Here's what I found from the context:\n\n${retrievedChunks.map(chunk => chunk.text.substring(0, 200) + '...').join('\n\n')}`,
          citations: []
        }
      }
      
      // Add metadata about retrieved chunks
      citations = retrievedChunks.map(chunk => ({
        page: chunk.page,
        snippet: chunk.text.substring(0, 150) + (chunk.text.length > 150 ? '...' : ''),
        similarity: Math.round(chunk.similarity * 100) / 100
      }))
      
    } else {
      // General conversation without PDF context
      const chatCompletion = await nebiusClient.chat.completions.create({
        model: process.env.CHAT_MODEL || "Qwen/Qwen3-235B-A22B-Thinking-2507",
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
            content: sanitizedMessage
          }
        ]
      })

      const rawResponse = chatCompletion.choices[0]?.message?.content || ''
      aiResponse = {
        answer: rawResponse,
        citations: []
      }
    }

    // Ensure citations are included
    if (!aiResponse.citations || aiResponse.citations.length === 0) {
      aiResponse.citations = citations
    }

    // Log for debugging
    console.log(`Chat response for ${chatId}:`, {
      messageLength: sanitizedMessage.length,
      chunksRetrieved: retrievedChunks.length,
      responseLength: aiResponse.answer.length,
      citationsCount: aiResponse.citations.length
    })

    res.json({
      success: true,
      answer: aiResponse.answer,
      citations: aiResponse.citations,
      metadata: {
        chatId,
        pdfId: pdfId || null,
        chunksUsed: retrievedChunks.length,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Chat endpoint error:', error)
    
    // Handle specific error types
    if (error.message.includes('Invalid message')) {
      return res.status(400).json({ error: error.message })
    }
    
    if (error.status === 401) {
      return res.status(401).json({ 
        error: 'Authentication failed. Please check your Nebius API key.' 
      })
    }
    
    if (error.status === 429) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.' 
      })
    }

    res.status(500).json({ 
      error: 'Failed to process chat message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Create embeddings endpoint
app.post('/api/create-embeddings', async (req, res) => {
  try {
    const { pdfId, chunks } = req.body;

    // Validate input
    if (!pdfId || !chunks) {
      return res.status(400).json({
        error: 'Missing required fields: pdfId and chunks are required'
      });
    }

    if (typeof pdfId !== 'string' || pdfId.trim().length === 0) {
      return res.status(400).json({
        error: 'pdfId must be a non-empty string'
      });
    }

    // Validate chunk data structure
    try {
      validateChunkData(chunks);
    } catch (validationError) {
      return res.status(400).json({
        error: `Invalid chunk data: ${validationError.message}`
      });
    }

    console.log(`Creating embeddings for PDF: ${pdfId} with ${chunks.length} chunks`);

    // Generate embeddings for all chunks
    const textChunks = chunks.map(chunk => chunk.text);
    const embeddings = await generateEmbeddingsBatch(textChunks);

    // Combine chunks with their embeddings
    const chunksWithEmbeddings = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index]
    }));

    // Store in Supabase
    const storedChunks = await storePDFChunks(pdfId, chunksWithEmbeddings);

    console.log(`Successfully created embeddings for ${storedChunks.length} chunks`);

    res.json({
      success: true,
      message: `Created embeddings for ${storedChunks.length} chunks`,
      data: {
        pdfId,
        chunksProcessed: storedChunks.length,
        embeddingDimensions: embeddings[0]?.length || 0,
        storedChunks: storedChunks.map(chunk => ({
          id: chunk.id,
          page: chunk.page,
          chunkIndex: chunk.chunk_index
        }))
      }
    });

  } catch (error) {
    console.error('Create embeddings error:', error);

    // Handle specific API errors
    if (error.message.includes('API key')) {
      return res.status(401).json({
        error: 'Invalid Nebius API key. Please check your configuration.'
      });
    }

    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        error: 'API rate limit exceeded. Please try again later.'
      });
    }

    if (error.message.includes('Supabase')) {
      return res.status(503).json({
        error: 'Database storage error. Please check Supabase configuration.'
      });
    }

    res.status(500).json({
      error: 'Failed to create embeddings',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Search chunks endpoint
app.post('/api/search-chunks', async (req, res) => {
  try {
    const { pdfId, query, top_k = 5 } = req.body;

    // Validate input
    if (!pdfId || !query) {
      return res.status(400).json({
        error: 'Missing required fields: pdfId and query are required'
      });
    }

    if (typeof pdfId !== 'string' || pdfId.trim().length === 0) {
      return res.status(400).json({
        error: 'pdfId must be a non-empty string'
      });
    }

    if (typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'query must be a non-empty string'
      });
    }

    const topK = Math.min(Math.max(parseInt(top_k) || 5, 1), 20); // Limit between 1 and 20

    console.log(`Searching chunks for PDF: ${pdfId}, query: "${query.substring(0, 100)}...", top_k: ${topK}`);

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Search for similar chunks
    const similarChunks = await searchSimilarChunks(pdfId, queryEmbedding, topK);

    console.log(`Found ${similarChunks.length} similar chunks with similarities:`, 
      similarChunks.map(c => c.similarity).slice(0, 3));

    res.json({
      success: true,
      query,
      pdfId,
      topK,
      results: similarChunks.map(chunk => ({
        id: chunk.id,
        page: chunk.page,
        text: chunk.text,
        similarity: Math.round((chunk.similarity || 0) * 10000) / 10000, // Round to 4 decimal places
        chunkIndex: chunk.chunk_index
      })),
      metadata: {
        totalResults: similarChunks.length,
        queryLength: query.length,
        embeddingDimensions: queryEmbedding.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Search chunks error:', error);

    // Handle specific API errors
    if (error.message.includes('API key')) {
      return res.status(401).json({
        error: 'Invalid Nebius API key. Please check your configuration.'
      });
    }

    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        error: 'API rate limit exceeded. Please try again later.'
      });
    }

    if (error.message.includes('Supabase')) {
      return res.status(503).json({
        error: 'Database search error. Please check Supabase configuration.'
      });
    }

    res.status(500).json({
      error: 'Failed to search chunks',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  })
})

// Diagnostic endpoint to check embeddings status
app.get('/api/embeddings-status/:pdfId', async (req, res) => {
  try {
    const { pdfId } = req.params;
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      return res.json({
        configured: false,
        message: 'Supabase not configured'
      });
    }

    // Import supabase client
    const { supabase } = await import('./embeddings.js');
    
    // Check if chunks exist for this PDF
    const { count, error } = await supabase
      .from('pdf_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('pdf_id', pdfId);

    if (error) {
      return res.status(500).json({
        configured: true,
        error: error.message,
        pdfId
      });
    }

    // Get sample chunks
    const { data: sampleChunks } = await supabase
      .from('pdf_chunks')
      .select('id, page, text, chunk_index')
      .eq('pdf_id', pdfId)
      .order('chunk_index')
      .limit(3);

    res.json({
      configured: true,
      pdfId,
      chunksCount: count || 0,
      sampleChunks: sampleChunks?.map(chunk => ({
        id: chunk.id,
        page: chunk.page,
        chunkIndex: chunk.chunk_index,
        textPreview: chunk.text?.substring(0, 100) + '...'
      })) || []
    });

  } catch (error) {
    console.error('Embeddings status check error:', error);
    res.status(500).json({
      error: 'Failed to check embeddings status',
      details: error.message
    });
  }
})

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' })
    }
  }
  
  console.error('Server error:', error)
  res.status(500).json({ error: 'Internal server error' })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Uploads directory: ${uploadsDir}`)
  
  // Initialize database connection
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    console.log('Initializing database connection...')
    const dbInitialized = await initializeDatabase()
    if (dbInitialized) {
      console.log('✅ Database connection successful')
    } else {
      console.log('⚠️  Database initialization failed - check Supabase configuration')
    }
  } else {
    console.log('⚠️  Supabase configuration missing - vector search will be unavailable')
  }
})