// Main routes configuration
import { Router } from 'express'
import filesRouter from './files.js'
import chatRouter from './chat.js'
import embeddingsRouter from './embeddings.js'
import authRouter from './auth.js'
import quizRouter from './quiz.js'
import usersRouter from './users.js'
import attemptsRouter from './attempts.js'

const router = Router()

// Mount route modules
router.use('/api', filesRouter)
router.use('/api', chatRouter)
router.use('/api', embeddingsRouter)
router.use('/api', quizRouter)
router.use('/api', usersRouter)
router.use('/api/attempts', attemptsRouter)
router.use('/api/auth', authRouter)

// API health check
router.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
})

// Root endpoint
router.get('/', (req, res) => {
  res.json({ 
    message: 'BeyondChats Revision App API',
    version: '1.0.0',
    endpoints: {
      upload: 'POST /api/upload',
      extractText: 'POST /api/extract-text',
      chat: 'POST /api/chat',
      embeddings: 'POST /api/create-embeddings',
      search: 'POST /api/search-chunks',
      generateQuiz: 'POST /api/generate-quiz',
      analyzeQuiz: 'POST /api/analyze-quiz',
      saveAttempt: 'POST /api/save-attempt',
      quizAttempts: 'GET /api/quiz-attempts/:fileId',
      users: {
        create: 'POST /api/users',
        get: 'GET /api/users/:id',
        update: 'PUT /api/users/:id'
      },
      auth: 'POST /api/auth/google',
      user: 'GET /api/auth/user',
      health: 'GET /api/health'
    }
  })
})

export default router