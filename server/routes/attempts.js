import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabase } from '../supabaseClient.js'

const router = express.Router()

/**
 * @route GET /api/attempts
 * @desc Get quiz attempts for a user
 * @access Private
 * @query userId - User ID to get attempts for
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      })
    }

    // Fetch quiz attempts from database
    const { data: attempts, error } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch quiz attempts'
      })
    }

    res.json({
      success: true,
      attempts: attempts || []
    })

  } catch (error) {
    console.error('Server error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

/**
 * @route POST /api/attempts
 * @desc Create a new quiz attempt
 * @access Private
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      user_id,
      pdf_id,
      topic,
      questions,
      answers,
      score,
      total_questions,
      correct_answers,
      time_taken
    } = req.body

    // Validate required fields
    if (!user_id || !topic || !questions || !answers || score === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user_id, topic, questions, answers, score'
      })
    }

    // Validate UUID format for user_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(user_id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      })
    }

    // Validate score is between 0 and 1
    if (score < 0 || score > 1) {
      return res.status(400).json({
        success: false,
        error: 'Score must be between 0 and 1'
      })
    }

    // Create quiz attempt
    const attemptData = {
      user_id,
      quiz_id: pdf_id || `quiz_${Date.now()}`,
      topic,
      quiz_data: JSON.stringify(questions),
      user_answers: JSON.stringify(answers),
      score: Math.round(score * (total_questions || questions.length)),
      total: total_questions || questions.length,
      time_taken: time_taken || null
    }

    const { data: attempt, error } = await supabase
      .from('quiz_attempts')
      .insert([attemptData])
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to create quiz attempt'
      })
    }

    res.status(201).json({
      success: true,
      attempt
    })

  } catch (error) {
    console.error('Server error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

/**
 * @route POST /api/save-attempt
 * @desc Save quiz attempt (alias for POST /api/attempts)
 * @access Private
 */
router.post('/save-attempt', requireAuth, async (req, res) => {
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
      quiz_data: JSON.stringify(questions),
      user_answers: JSON.stringify(answers),
      score: Math.round(score * (total_questions || questions.length)),
      total: total_questions || questions.length,
      time_taken: time_taken || null,
      feedback: feedback || null
    }

    console.log('Prepared attempt data for database:', attemptData)

    const { data: attempt, error } = await supabase
      .from('quiz_attempts')
      .insert([attemptData])
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
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
    console.error('Save attempt endpoint error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

/**
 * @route GET /api/attempts/:id
 * @desc Get a specific quiz attempt
 * @access Private
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid attempt ID format'
      })
    }

    // Fetch quiz attempt
    const { data: attempt, error } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Quiz attempt not found'
        })
      }
      console.error('Database error:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch quiz attempt'
      })
    }

    res.json({
      success: true,
      attempt
    })

  } catch (error) {
    console.error('Server error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

export default router