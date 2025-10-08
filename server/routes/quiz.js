// Quiz routes
import { Router } from 'express'
import { searchSimilarChunks, generateEmbedding } from '../embeddings.js'
import { retrieveTopKChunks } from '../utils/vectorStorage.js'
import { config } from '../config/index.js'
import { OpenAI } from 'openai'

const router = Router()
const openai = new OpenAI({
  baseURL: 'https://api.studio.nebius.com/v1/',
  apiKey: config.nebiusApiKey
})

/**
 * Generate quiz based on PDF content
 */
router.post('/generate-quiz', async (req, res) => {
  try {
    const { fileId, textId, types } = req.body

    // Validate input
    if (!fileId || !textId) {
      return res.status(400).json({ 
        error: 'Missing required fields: fileId and textId are required' 
      })
    }

    // Default types if not provided
    const quizTypes = types || {
      mcq: 3,
      shortAnswer: 2, 
      longAnswer: 1
    }

    // Get relevant content from vector store
    let searchResults = []
    
    try {
      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding("Generate a comprehensive quiz")
      
      // Use Supabase vector search if configured
      if (config.supabaseUrl && config.supabaseKey) {
        searchResults = await searchSimilarChunks(textId, queryEmbedding, 10)
      } else {
        // Fallback to file-based search
        searchResults = retrieveTopKChunks(textId, "Generate a comprehensive quiz", 10)
      }
    } catch (error) {
      console.error('Vector search error:', error)
      // Fallback to file-based search
      searchResults = retrieveTopKChunks(textId, "Generate a comprehensive quiz", 10)
    }
    
    if (!searchResults || searchResults.length === 0) {
      return res.status(404).json({ error: 'No content found for this PDF' })
    }

    // Extract text from search results
    const content = searchResults
      .map(result => result.text || result.content)
      .join('\n\n')

    // Generate quiz using OpenAI
    const mcqCount = quizTypes.mcq || 3
    const shortCount = quizTypes.shortAnswer || 2
    const longCount = quizTypes.longAnswer || 1

    const quizPrompt = `
      Generate a quiz based on the following content. The quiz should include:
      - ${mcqCount} multiple choice questions (MCQs) with 4 options each and one correct answer
      - ${shortCount} short answer questions that require brief explanations
      - ${longCount} long answer question that requires detailed response
      
      Format your response as a valid JSON object with the following structure:
      {
        "mcq": [
          {
            "question": "The question text",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswerIndex": 0 // Index of the correct answer (0-3)
          }
        ],
        "shortAnswer": [
          {
            "question": "Short answer question text"
          }
        ],
        "longAnswer": [
          {
            "question": "Long answer question text"
          }
        ]
      }

      Content:
      ${content}
    `

    const completion = await openai.chat.completions.create({
      model: config.chatModel || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful AI that generates educational quizzes.' },
        { role: 'user', content: quizPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    })

    let quizContent
    try {
      quizContent = JSON.parse(completion.choices[0].message.content.trim())
    } catch (error) {
      console.error('Error parsing quiz content:', error)
      return res.status(500).json({ error: 'Failed to generate quiz content' })
    }

    // Return quiz
    res.json({ 
      quiz: quizContent,
      fileId,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Quiz generation error:', error)
    res.status(500).json({ error: 'Failed to generate quiz' })
  }
})

/**
 * Analyze quiz answers
 */
router.post('/analyze-quiz', async (req, res) => {
  try {
    const { answers, quiz } = req.body

    // Validate input
    if (!answers || !quiz) {
      return res.status(400).json({ 
        error: 'Missing required fields: answers and quiz are required' 
      })
    }

    // Analyze MCQ answers first
    const mcqResults = answers.mcq.map((answer, index) => {
      const question = quiz.mcq[index]
      const correctAnswerIndex = question.correctAnswerIndex
      const isCorrect = answer.selectedAnswer === correctAnswerIndex
      
      return {
        questionIndex: answer.questionIndex,
        isCorrect,
        correctAnswerIndex,
        selectedAnswerIndex: answer.selectedAnswer,
        explanation: `The correct answer is ${String.fromCharCode(65 + correctAnswerIndex)}: ${question.options[correctAnswerIndex]}`
      }
    })
    
    // Use OpenAI to analyze short and long answers
    const shortAnswerPromises = answers.shortAnswer.map((answer, index) => {
      return analyzeTextAnswer(quiz.shortAnswer[index].question, answer.answer, 'short')
    })
    
    const longAnswerPromises = answers.longAnswer.map((answer, index) => {
      return analyzeTextAnswer(quiz.longAnswer[index].question, answer.answer, 'long')
    })
    
    // Wait for all text answers to be analyzed
    const [shortAnswerResults, longAnswerResults] = await Promise.all([
      Promise.all(shortAnswerPromises),
      Promise.all(longAnswerPromises)
    ])

    // Calculate overall score
    const mcqScore = mcqResults.reduce((sum, result) => sum + (result.isCorrect ? 1 : 0), 0) / mcqResults.length
    const shortScore = shortAnswerResults.reduce((sum, result) => sum + (result.score / 10), 0) / shortAnswerResults.length
    const longScore = longAnswerResults.reduce((sum, result) => sum + (result.score / 10), 0) / longAnswerResults.length
    
    // Weight the scores (MCQ: 40%, Short: 30%, Long: 30%)
    const overallScore = Math.round((mcqScore * 0.4 + shortScore * 0.3 + longScore * 0.3) * 100)

    // Generate feedback based on score
    let feedback = ''
    if (overallScore >= 90) feedback = 'Outstanding! You have an excellent understanding of the material.'
    else if (overallScore >= 80) feedback = 'Great job! You have a strong grasp of most concepts.'
    else if (overallScore >= 70) feedback = 'Good work! You understand the core concepts but could improve in some areas.'
    else if (overallScore >= 60) feedback = 'Not bad! You have a basic understanding but should review some topics.'
    else feedback = 'Keep studying! Focus on the areas where you scored lowest.'

    // Return results
    res.json({ 
      results: {
        mcq: mcqResults,
        shortAnswer: shortAnswerResults,
        longAnswer: longAnswerResults,
        overallScore,
        feedback,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Quiz analysis error:', error)
    res.status(500).json({ error: 'Failed to analyze quiz answers' })
  }
})

/**
 * Helper function to analyze text answers using OpenAI
 */
async function analyzeTextAnswer(question, answer, type) {
  const maxScore = 10
  
  // If answer is blank, return zero score
  if (!answer || answer.trim() === '') {
    return {
      score: 0,
      feedback: 'No answer provided.'
    }
  }
  
  const prompt = `
    You are grading a ${type} answer question. 
    
    Question: "${question}"
    
    Student's Answer: "${answer}"
    
    Grade this answer on a scale of 0-${maxScore} where ${maxScore} is perfect.
    Provide constructive feedback explaining what was good and what could be improved.
    
    Format your response as a valid JSON object with the following structure:
    {
      "score": 7, // A number between 0 and ${maxScore}
      "feedback": "Your detailed feedback here..."
    }
  `

  const completion = await openai.chat.completions.create({
    model: config.chatModel || 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are an educational assessment AI that grades student answers fairly.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: "json_object" }
  })

  try {
    const result = JSON.parse(completion.choices[0].message.content.trim())
    
    // Ensure score is within bounds
    result.score = Math.min(Math.max(parseInt(result.score), 0), maxScore)
    
    return result
  } catch (error) {
    console.error('Error parsing analysis result:', error)
    return {
      score: 0,
      feedback: 'Error analyzing answer. Please try again.'
    }
  }
}

/**
 * Get saved quiz attempts for a user
 */
router.get('/quiz-attempts/:fileId', async (req, res) => {
  // Placeholder - would be implemented with database integration
  res.json({ 
    attempts: [] 
  })
})

/**
 * Save a quiz attempt
 */
router.post('/save-attempt', async (req, res) => {
  try {
    const { fileId, quiz, results } = req.body
    
    // This would normally save to a database
    // For now, just return success
    
    res.json({
      success: true,
      attemptId: `attempt-${Date.now()}`,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error saving quiz attempt:', error)
    res.status(500).json({ error: 'Failed to save quiz attempt' })
  }
})

export default router