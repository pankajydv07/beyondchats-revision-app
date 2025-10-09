// Refactored BeyondChats Revision App Server
// Clean, modular architecture with separated concerns

import express from 'express'
import { config } from './config/index.js'
import { configureMiddleware } from './middleware/index.js'
import routes from './routes/index.js'
import { initializeDatabase } from './embeddings.js'

// Create Express application
const app = express()

// Configure middleware
configureMiddleware(app)

// Configure routes
app.use('/', routes)

// 404 handler - must be after all routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    availableEndpoints: {
      upload: 'POST /api/upload',
      extractText: 'POST /api/extract-text', 
      chat: 'POST /api/chat',
      generateQuiz: 'POST /api/generate-quiz',
      analyzeQuiz: 'POST /api/analyze-quiz',
      embeddings: 'POST /api/create-embeddings',
      search: 'POST /api/search-chunks',
      users: 'POST /api/users, GET /api/users/:id, PUT /api/users/:id',
      pdfs: 'GET /api/pdfs, GET /api/pdf/:fileId',
      attempts: 'GET /api/attempts, POST /api/attempts, POST /api/attempts/save-attempt',
      health: 'GET /api/health'
    }
  })
})

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error)
  
  if (res.headersSent) {
    return next(error)
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? error.message : 'Something went wrong'
  })
})

// Start server
async function startServer() {
  try {
    // Initialize database connection
    if (config.supabaseUrl && config.supabaseKey) {
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

    // Start listening
    app.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port}`)
      console.log(`📍 Environment: ${config.nodeEnv}`)
      console.log(`📁 Uploads directory: ${config.uploadsDir}`)
      console.log(`🤖 AI Model: ${config.chatModel}`)
      console.log(`🔗 Vector dimensions: ${config.embeddingDimensions}`)
      
      if (config.nodeEnv === 'development') {
        console.log(`\n🔗 Available endpoints:`)
        console.log(`   Health: http://localhost:${config.port}/api/health`)
        console.log(`   Upload: POST http://localhost:${config.port}/api/upload`)
        console.log(`   Chat: POST http://localhost:${config.port}/api/chat`)
        console.log(`   Quiz: POST http://localhost:${config.port}/api/generate-quiz`)
        console.log('   📚 Full API docs at: http://localhost:' + config.port)
      }
    })

  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...')
  process.exit(0)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Start the server
startServer()

export default app