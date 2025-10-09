// Main routes configuration
import { Router } from 'express'
import filesRouter from './files.js'
import chatRouter from './chat.js'
import embeddingsRouter from './embeddings.js'
import authRouter from './auth.js'
import quizRouter from './quiz.js'
import usersRouter from './users.js'
import attemptsRouter from './attempts.js'
import { requireAuth } from '../middleware/auth.js'
import { supabase } from '../supabaseClient.js'

const router = Router()

// Mount route modules
router.use('/api', filesRouter)
router.use('/api', chatRouter)
router.use('/api', embeddingsRouter)
router.use('/api', quizRouter)
router.use('/api', usersRouter)
router.use('/api/attempts', attemptsRouter)
router.use('/api/auth', authRouter)

// Direct API route for saving quiz attempts
router.post('/api/save-attempt', requireAuth, async (req, res) => {
  try {
    console.log('🚨🚨🚨 SAVE-ATTEMPT ENDPOINT REACHED! 🚨🚨🚨')
    console.log('🎯 Save-attempt endpoint called')
    console.log('🎯 Request headers:', req.headers)
    console.log('🎯 Request body:', JSON.stringify(req.body, null, 2))
    console.log('🎯 Authenticated user:', req.user)
    
    const {
      user_id,
      pdf_id,
      topic,
      questions,
      answers,
      score,
      total_questions,
      correct_answers,
      time_taken,
      feedback
    } = req.body

    console.log('🎯 Extracted fields:', {
      user_id,
      pdf_id,
      topic,
      score,
      total_questions,
      correct_answers,
      time_taken
    })

    // Calculate total questions from answers structure if not provided
    let totalQuestions = total_questions
    if (!totalQuestions && answers) {
      const answersObj = typeof answers === 'string' ? JSON.parse(answers) : answers
      totalQuestions = (answersObj.mcq?.length || 0) + 
                      (answersObj.shortAnswer?.length || 0) + 
                      (answersObj.longAnswer?.length || 0)
      console.log('🎯 Calculated total questions from answers:', totalQuestions)
    }

    // Ensure we have a valid total
    if (!totalQuestions || totalQuestions === 0) {
      totalQuestions = 1 // Prevent division by zero
      console.log('🎯 Using fallback total questions:', totalQuestions)
    }

    // Calculate integer score (out of totalQuestions)
    const integerScore = Math.round(score * totalQuestions)
    console.log('🎯 Calculated integer score:', integerScore, 'out of', totalQuestions)

    // Validate required fields
    if (!user_id || !topic || !questions || !answers || score === undefined) {
      console.log('❌ Missing required fields validation failed')
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user_id, topic, questions, answers, score',
        received: { user_id, topic, questions: !!questions, answers: !!answers, score }
      })
    }

    // Validate UUID format for user_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(user_id)) {
      console.log('❌ UUID validation failed for user_id:', user_id)
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      })
    }

    // Validate score is between 0 and 1
    console.log('🎯 Validating score:', score, 'Type:', typeof score)
    if (score < 0 || score > 1) {
      console.error('❌ Score validation failed:', score)
      return res.status(400).json({
        success: false,
        error: 'Score must be between 0 and 1'
      })
    }

    // Create quiz attempt with feedback
    const attemptData = {
      user_id,
      quiz_id: pdf_id || `quiz_${Date.now()}`,
      topic,
      quiz_data: JSON.stringify(questions || {}),
      user_answers: JSON.stringify(answers),
      score: integerScore,
      total: totalQuestions,
      time_taken: time_taken || null,
      feedback: feedback || null
    }

    console.log('🎯 Prepared attempt data for database:', attemptData)

    const { data: attempt, error } = await supabase
      .from('quiz_attempts')
      .insert([attemptData])
      .select()
      .single()

    if (error) {
      console.error('❌ Database error:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to save quiz attempt'
      })
    }

    console.log('🎯 Database operation successful!')
    console.log('🎯 Saved attempt:', attempt)

    res.status(201).json({
      success: true,
      attempt,
      message: 'Quiz attempt saved successfully'
    })

  } catch (error) {
    console.error('❌ Save attempt endpoint error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

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