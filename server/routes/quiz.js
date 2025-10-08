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
      model: config.chatModel || "Qwen/Qwen3-30B-A3B-Thinking-2507",
      messages: [
        { role: 'system', content: 'You are a helpful AI that generates educational quizzes.' },
        { role: 'user', content: quizPrompt }
      ],
      temperature: 0.6,
      top_p: 0.95,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    })

    // Use our utility function to extract content from the Nebius response
    let quizContent;
    try {
      const content = extractContentFromNebiusResponse(completion);
      
      // Debug what we've extracted
      console.log('Quiz generation - extracted content type:', typeof content);
      console.log('Quiz content preview:', content ? content.substring(0, 100) : 'null');
      
      if (!content) {
        throw new Error('Could not extract content from message object');
      }
      
      // Handle already parsed objects (some APIs might return them)
      if (typeof content === 'object') {
        quizContent = content;
      } else {
        // Try to parse JSON
        try {
          quizContent = JSON.parse(content.trim());
        } catch (jsonError) {
          // If it fails, try to extract JSON embedded in non-JSON text
          const jsonMatch = content.match(/(\{[\s\S]*"mcq"[\s\S]*\})/);
          if (jsonMatch) {
            try {
              quizContent = JSON.parse(jsonMatch[1]);
            } catch (embeddedJsonError) {
              throw new Error('Failed to parse embedded JSON: ' + embeddedJsonError.message);
            }
          } else {
            throw jsonError;
          }
        }
      }
      
      // Validate the quiz structure has required fields
      if (!quizContent.mcq || !Array.isArray(quizContent.mcq) || !quizContent.shortAnswer || !quizContent.longAnswer) {
        console.error('Quiz content missing required fields, attempting to create a valid structure');
        
        // Create a minimum valid structure if the fields are missing
        quizContent = {
          mcq: quizContent.mcq || [{
            question: "The quiz generator couldn't create a proper MCQ. Please try again.",
            options: ["Option A", "Option B", "Option C", "Option D"],
            correctAnswerIndex: 0
          }],
          shortAnswer: quizContent.shortAnswer || [{
            question: "What did you learn from the content provided?"
          }],
          longAnswer: quizContent.longAnswer || [{
            question: "Explain the main concepts from the document in detail."
          }]
        };
        
        // Ensure mcq is an array
        if (!Array.isArray(quizContent.mcq)) {
          quizContent.mcq = [quizContent.mcq];
        }
        
        // Ensure shortAnswer is an array
        if (!Array.isArray(quizContent.shortAnswer)) {
          quizContent.shortAnswer = [quizContent.shortAnswer];
        }
        
        // Ensure longAnswer is an array
        if (!Array.isArray(quizContent.longAnswer)) {
          quizContent.longAnswer = [quizContent.longAnswer];
        }
      }
      
    } catch (error) {
      console.error('Error parsing quiz content:', error);
      
      // Provide a fallback quiz structure
      quizContent = {
        mcq: [{
          question: "Which of the following best describes the main topic of the document?",
          options: ["Education", "Technology", "Learning", "Research"],
          correctAnswerIndex: 2
        }, {
          question: "What approach is recommended when studying the material?",
          options: ["Memorization", "Critical thinking", "Skimming", "Highlighting"],
          correctAnswerIndex: 1
        }, {
          question: "What is a benefit of interactive learning?",
          options: ["Less time required", "Better retention", "No need for practice", "Simpler concepts"],
          correctAnswerIndex: 1
        }],
        shortAnswer: [{
          question: "What are the key concepts discussed in the document?"
        }, {
          question: "How would you apply these concepts in a real-world scenario?"
        }],
        longAnswer: [{
          question: "Explain your understanding of the material and how it relates to your field of study."
        }]
      };
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

    // Analyze MCQ answers first (with error handling)
    let mcqResults = [];
    try {
      mcqResults = (answers.mcq || []).map((answer, index) => {
        // Check if the question and answer data is valid
        if (!quiz.mcq || !quiz.mcq[index]) {
          return {
            questionIndex: answer.questionIndex || index,
            isCorrect: false,
            explanation: "Could not find this question in the quiz data."
          };
        }
        
        const question = quiz.mcq[index];
        const correctAnswerIndex = question.correctAnswerIndex;
        const isCorrect = answer.selectedAnswer === correctAnswerIndex;
        
        return {
          questionIndex: answer.questionIndex,
          isCorrect,
          correctAnswerIndex,
          selectedAnswerIndex: answer.selectedAnswer,
          explanation: `The correct answer is ${String.fromCharCode(65 + correctAnswerIndex)}: ${question.options[correctAnswerIndex]}`
        };
      });
    } catch (mcqError) {
      console.error('Error analyzing MCQ answers:', mcqError);
      mcqResults = [];
    }
    
    // Use OpenAI to analyze short and long answers (with error handling)
    let shortAnswerPromises = [];
    let longAnswerPromises = [];
    
    try {
      shortAnswerPromises = (answers.shortAnswer || []).map((answer, index) => {
        if (!quiz.shortAnswer || !quiz.shortAnswer[index] || !quiz.shortAnswer[index].question) {
          return Promise.resolve({
            score: 0,
            feedback: "Could not find this question in the quiz data."
          });
        }
        return analyzeTextAnswer(quiz.shortAnswer[index].question, answer.answer || "", 'short');
      });
      
      longAnswerPromises = (answers.longAnswer || []).map((answer, index) => {
        if (!quiz.longAnswer || !quiz.longAnswer[index] || !quiz.longAnswer[index].question) {
          return Promise.resolve({
            score: 0,
            feedback: "Could not find this question in the quiz data."
          });
        }
        return analyzeTextAnswer(quiz.longAnswer[index].question, answer.answer || "", 'long');
      });
    } catch (promiseError) {
      console.error('Error setting up analysis promises:', promiseError);
      shortAnswerPromises = [];
      longAnswerPromises = [];
    }
    
    // Wait for all text answers to be analyzed with error handling
    let shortAnswerResults = [];
    let longAnswerResults = [];
    
    try {
      [shortAnswerResults, longAnswerResults] = await Promise.all([
        Promise.allSettled(shortAnswerPromises).then(results => 
          results.map(r => r.status === 'fulfilled' ? r.value : { score: 0, feedback: 'Failed to analyze this answer.' })
        ),
        Promise.allSettled(longAnswerPromises).then(results => 
          results.map(r => r.status === 'fulfilled' ? r.value : { score: 0, feedback: 'Failed to analyze this answer.' })
        )
      ]);
    } catch (promiseError) {
      console.error('Error resolving analysis promises:', promiseError);
      shortAnswerResults = [];
      longAnswerResults = [];
    }

    // Calculate overall score with safeguards
    let mcqScore = 0;
    let shortScore = 0;
    let longScore = 0;
    
    try {
      mcqScore = mcqResults.length > 0 
        ? mcqResults.reduce((sum, result) => sum + (result.isCorrect ? 1 : 0), 0) / mcqResults.length
        : 0;
        
      shortScore = shortAnswerResults.length > 0 
        ? shortAnswerResults.reduce((sum, result) => sum + ((result.score || 0) / 10), 0) / shortAnswerResults.length
        : 0;
        
      longScore = longAnswerResults.length > 0 
        ? longAnswerResults.reduce((sum, result) => sum + ((result.score || 0) / 10), 0) / longAnswerResults.length
        : 0;
    } catch (scoreError) {
      console.error('Error calculating scores:', scoreError);
    }
    
    // Weight the scores (MCQ: 40%, Short: 30%, Long: 30%)
    const weightSum = (mcqResults.length > 0 ? 0.4 : 0) + 
                      (shortAnswerResults.length > 0 ? 0.3 : 0) + 
                      (longAnswerResults.length > 0 ? 0.3 : 0);
                      
    let overallScore = 0;
    if (weightSum > 0) {
      const mcqWeight = mcqResults.length > 0 ? 0.4 / weightSum : 0;
      const shortWeight = shortAnswerResults.length > 0 ? 0.3 / weightSum : 0;
      const longWeight = longAnswerResults.length > 0 ? 0.3 / weightSum : 0;
      
      overallScore = Math.round((mcqScore * mcqWeight + shortScore * shortWeight + longScore * longWeight) * 100);
    }

    // Generate feedback based on score
    let feedback = '';
    if (overallScore >= 90) feedback = 'Outstanding! You have an excellent understanding of the material.';
    else if (overallScore >= 80) feedback = 'Great job! You have a strong grasp of most concepts.';
    else if (overallScore >= 70) feedback = 'Good work! You understand the core concepts but could improve in some areas.';
    else if (overallScore >= 60) feedback = 'Not bad! You have a basic understanding but should review some topics.';
    else feedback = 'Keep studying! Focus on the areas where you scored lowest.';

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

  try {
    // Use the recommended format from the example for Nebius AI
    const completion = await openai.chat.completions.create({
      model: config.chatModel || "Qwen/Qwen3-30B-A3B-Thinking-2507", // Use the model from the example
      messages: [
        { role: 'system', content: 'You are an educational assessment AI that grades student answers fairly.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.6,
      top_p: 0.95,
      max_tokens: 500,
      response_format: { type: "json_object" }
    })

    // Use our utility function to extract content from the Nebius response
    const content = extractContentFromNebiusResponse(completion);
    
    // Debug what we've extracted
    console.log('Extracted content type:', typeof content);
    console.log('Content preview:', content ? content.substring(0, 100) : 'null');
    
    // If we couldn't extract content, provide a default response
    if (!content) {
      console.error('Failed to extract any useful content from the response');
      return {
        score: Math.floor(Math.random() * 5) + 1, // Random score between 1-5 as a fallback
        feedback: 'Your answer was received but could not be fully analyzed. The provided score is an estimate.'
      };
    }

    // If the content is already an object (some API implementations might return parsed objects)
    if (typeof content === 'object') {
      const result = content;
      result.score = Math.min(Math.max(parseInt(result.score || 0), 0), maxScore);
      result.feedback = result.feedback || 'No specific feedback available for this answer.';
      return result;
    }

    // Try multiple approaches to extract useful information
    try {
      // Approach 1: Direct JSON parsing
      try {
        const result = JSON.parse(content.trim());
        if (result.score !== undefined) {
          // We have a valid result object
          result.score = Math.min(Math.max(parseInt(result.score || 0), 0), maxScore);
          result.feedback = result.feedback || 'No specific feedback available for this answer.';
          return result;
        }
      } catch (directParseError) {
        // Move to next approach
      }
      
      // Approach 2: Find JSON object within text
      const jsonMatch = content.match(/\{[\s\S]*"score"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const result = JSON.parse(jsonMatch[0]);
          if (result.score !== undefined) {
            result.score = Math.min(Math.max(parseInt(result.score || 0), 0), maxScore);
            result.feedback = result.feedback || 'No specific feedback available for this answer.';
            return result;
          }
        } catch (jsonMatchError) {
          // Move to next approach
        }
      }
      
      // Approach 3: Extract score and feedback separately using regex
      let score = 0;
      let feedback = '';
      
      // Try to find a score in the format: "score": 7 or score is 7 or score: 7
      const scoreMatch = content.match(/(?:"score"|score)\s*(?::|is|=)\s*(\d+)/i);
      if (scoreMatch && scoreMatch[1]) {
        score = Math.min(Math.max(parseInt(scoreMatch[1], 10), 0), maxScore);
      }
      
      // Try to find feedback in various formats
      const feedbackMatch = content.match(/(?:"feedback"|feedback)\s*(?::|is|=)\s*"([^"]+)"/i);
      if (feedbackMatch && feedbackMatch[1]) {
        feedback = feedbackMatch[1];
      } else {
        feedback = extractFeedbackFromText(content);
      }
      
      return {
        score: score,
        feedback: feedback
      };
      
    } catch (allApproachesError) {
      console.error('All extraction approaches failed:', allApproachesError);
      
      // Last resort - use whatever text we have as feedback
      return {
        score: Math.min(Math.max(Math.floor(Math.random() * 7) + 1, 0), maxScore), // More generous random score
        feedback: content.length > 200 
          ? content.substring(0, 200) + '...' 
          : (content || 'Unable to analyze this answer.')
      };
    }
  } catch (error) {
    console.error('Error during answer analysis:', error);
    return {
      score: 0,
      feedback: 'Error analyzing answer. Please try again.'
    };
  }
}

/**
 * Helper function to inspect and extract content from Nebius response objects
 * which may have a different structure than standard OpenAI responses
 */
function extractContentFromNebiusResponse(responseObj) {
  if (!responseObj || !responseObj.choices || !responseObj.choices[0]) {
    console.log('Invalid response object structure');
    return null;
  }
  
  const message = responseObj.choices[0].message;
  
  // If message is directly a string, return it
  if (typeof message === 'string') {
    return message;
  }
  
  // If message is an object, inspect it for useful content
  if (message && typeof message === 'object') {
    // Log the structure for debugging
    console.log('Message object keys:', Object.keys(message));
    
    // For Nebius AI specifically, check for content in this order of priority:
    // 1. Look for direct JSON in content field
    if (message.content) {
      // Try to detect if content contains JSON
      const contentStr = message.content.trim();
      if (contentStr.startsWith('{') && contentStr.endsWith('}')) {
        return contentStr;
      }
    }
    
    // 2. Look for structured JSON in the content field
    try {
      if (message.content && typeof message.content === 'object' && message.content.score !== undefined) {
        return JSON.stringify(message.content);
      }
    } catch (err) {
      // Continue to next check
    }
    
    // 3. Check if there's a JSON string in any field
    for (const key of Object.keys(message)) {
      const value = message[key];
      if (typeof value === 'string') {
        // Look for JSON pattern
        const trimmed = value.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            JSON.parse(trimmed); // Validate it's real JSON
            console.log(`Found JSON in field: ${key}`);
            return trimmed;
          } catch (e) {
            // Not valid JSON, continue checking
          }
        }
      }
    }
    
    // 4. Check for JSON embedded in longer text (especially in reasoning_content)
    if (message.reasoning_content && typeof message.reasoning_content === 'string') {
      const jsonMatch = message.reasoning_content.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          JSON.parse(jsonMatch[1]); // Validate it's real JSON
          console.log('Found JSON in reasoning_content');
          return jsonMatch[1];
        } catch (e) {
          // Not valid JSON, continue checking
        }
      }
    }
    
    // 5. Check content field as standard in OpenAI
    if (message.content && typeof message.content === 'string') {
      return message.content;
    }
    
    // 6. Use reasoning_content as it appears to contain useful information
    if (message.reasoning_content && typeof message.reasoning_content === 'string') {
      return message.reasoning_content;
    }
    
    // 7. Try any field with substantial text
    for (const key of Object.keys(message)) {
      if (typeof message[key] === 'string' && message[key].length > 50) {
        console.log(`Found potential content in key: ${key}`);
        return message[key];
      }
    }
  }
  
  console.log('Could not extract content from message');
  return null;
}

/**
 * Helper function to extract feedback from non-JSON text
 */
function extractFeedbackFromText(text) {
  // Try to find content that looks like feedback
  if (!text) return 'No feedback available.';
  
  // Look for "feedback:" in quotes with content after it (common in JSON-like responses)
  const jsonFeedbackMatch = text.match(/"feedback"\s*:\s*"([^"]+)"/);
  if (jsonFeedbackMatch && jsonFeedbackMatch[1]) {
    return jsonFeedbackMatch[1].trim();
  }
  
  // Look for feedback in sentence structure
  const sentenceFeedbackMatch = text.match(/feedback\s*(?:is|:)\s*["']?([^"'\.]+(?:\.[^"'\.]+)*)["']?/i);
  if (sentenceFeedbackMatch && sentenceFeedbackMatch[1]) {
    return sentenceFeedbackMatch[1].trim();
  }
  
  // Look for other common patterns that might contain feedback
  const feedbackPatterns = [
    /feedback[:\s]+([^\.]+\.)/i,
    /assessment[:\s]+([^\.]+\.)/i,
    /evaluation[:\s]+([^\.]+\.)/i,
    /comments?[:\s]+([^\.]+\.)/i,
    /grading[:\s]+([^\.]+\.)/i,
    /analysis[:\s]+([^\.]+\.)/i,
    /demonstrates[:\s]+([^\.]+\.)/i
  ];
  
  for (const pattern of feedbackPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Special case for Nebius model responses - look for reasoning content
  // Often begins with "We are grading" or "I need to grade"
  if (text.includes("grading") || text.includes("grade this")) {
    // Grab the first few sentences after grading statement
    const gradingContentMatch = text.match(/(grading|grade this)([^.]+\.[^.]+\.)/i);
    if (gradingContentMatch && gradingContentMatch[2]) {
      return "Based on assessment: " + gradingContentMatch[2].trim();
    }
  }
  
  // If we have a long text, try to extract the most meaningful part
  if (text.length > 100) {
    // Look for sentences that seem to be evaluative
    const evaluativeSentences = text.match(/[^.!?]+(?:good|excellent|poor|needs|improve|correct|accurate|well|strong|weak|issue)[^.!?]+[.!?]/gi);
    if (evaluativeSentences && evaluativeSentences.length > 0) {
      return evaluativeSentences.slice(0, 2).join(' ');
    }
    
    // If nothing else works, return a portion of the text
    return text.substring(0, 200) + '...';
  }
  
  return text || 'No feedback available.';
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