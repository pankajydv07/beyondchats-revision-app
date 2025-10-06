import React, { useState, useCallback, useEffect } from 'react'
import PropTypes from 'prop-types'

const QuizRenderer = ({ quiz, onComplete, onRegenerate }) => {
  const [selectedAnswers, setSelectedAnswers] = useState({})
  const [showResults, setShowResults] = useState(false)
  const [results, setResults] = useState(null)
  const [timeSpent, setTimeSpent] = useState(0)
  const [startTime] = useState(Date.now())

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(timer)
  }, [startTime])

  const handleAnswerSelect = useCallback((questionIndex, optionIndex) => {
    if (showResults) return // Prevent changes after submission

    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: optionIndex
    }))
  }, [showResults])

  const calculateResults = useCallback(() => {
    if (!quiz || !quiz.questions) return null

    let correct = 0
    const questionResults = quiz.questions.map((question, qIndex) => {
      const selectedAnswer = selectedAnswers[qIndex]
      const isCorrect = selectedAnswer === question.correct
      
      if (isCorrect) correct++

      return {
        questionIndex: qIndex,
        question: question.question,
        selectedAnswer,
        correctAnswer: question.correct,
        isCorrect,
        explanation: question.explanation || `The correct answer is: ${question.options[question.correct]}`
      }
    })

    const score = Math.round((correct / quiz.questions.length) * 100)
    
    return {
      correct,
      total: quiz.questions.length,
      score,
      timeSpent,
      questions: questionResults,
      timestamp: new Date().toISOString()
    }
  }, [quiz, selectedAnswers, timeSpent])

  const handleSubmit = useCallback(() => {
    const calculatedResults = calculateResults()
    setResults(calculatedResults)
    setShowResults(true)
  }, [calculateResults])

  const handleSaveAttempt = useCallback(() => {
    if (results && onComplete) {
      onComplete(results)
    }
  }, [results, onComplete])

  const handleRetakeQuiz = useCallback(() => {
    setSelectedAnswers({})
    setShowResults(false)
    setResults(null)
    setTimeSpent(0)
  }, [])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getScoreMessage = (score) => {
    if (score >= 90) return 'Excellent work! 🎉'
    if (score >= 80) return 'Great job! 👏'
    if (score >= 70) return 'Good effort! 👍'
    if (score >= 60) return 'Not bad, keep practicing! 📚'
    return 'Keep studying, you\'ll improve! 💪'
  }

  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No quiz questions available</p>
      </div>
    )
  }

  const allQuestionsAnswered = quiz.questions.every((_, index) => 
    selectedAnswers.hasOwnProperty(index)
  )

  return (
    <div className="space-y-6">
      {/* Quiz Header */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">PDF Quiz</h3>
            <p className="text-gray-600 mt-1">
              {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-blue-600">
              {formatTime(timeSpent)}
            </div>
            <p className="text-sm text-gray-500">Time elapsed</p>
          </div>
        </div>
        
        {!showResults && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Progress: {Object.keys(selectedAnswers).length} / {quiz.questions.length}
              </span>
              <span className={`px-2 py-1 rounded text-xs ${
                allQuestionsAnswered ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {allQuestionsAnswered ? 'Ready to submit' : 'Answer all questions'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(Object.keys(selectedAnswers).length / quiz.questions.length) * 100}%` 
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      {showResults && results && (
        <div className={`rounded-lg p-6 border-2 ${getScoreColor(results.score)}`}>
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">{results.score}%</div>
            <p className="text-lg font-medium mb-1">{getScoreMessage(results.score)}</p>
            <p className="text-sm opacity-75">
              {results.correct} out of {results.total} correct • Completed in {formatTime(results.timeSpent)}
            </p>
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-6">
        {quiz.questions.map((question, qIndex) => {
          const selectedAnswer = selectedAnswers[qIndex]
          const showQuestionResult = showResults && results
          const questionResult = showQuestionResult ? results.questions[qIndex] : null

          return (
            <div 
              key={qIndex} 
              className={`bg-white rounded-lg border-2 p-6 transition-all ${
                showQuestionResult 
                  ? questionResult.isCorrect 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-red-200 bg-red-50'
                  : selectedAnswer !== undefined 
                    ? 'border-blue-200 bg-blue-50' 
                    : 'border-gray-200'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-lg font-medium text-gray-900 flex-1">
                  <span className="inline-block w-8 h-8 bg-gray-100 text-gray-600 rounded-full text-sm font-bold flex items-center justify-center mr-3">
                    {qIndex + 1}
                  </span>
                  {question.question}
                </h4>
                
                {showQuestionResult && (
                  <div className={`flex items-center space-x-2 ${
                    questionResult.isCorrect ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {questionResult.isCorrect ? (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="space-y-3">
                {question.options.map((option, oIndex) => {
                  const isSelected = selectedAnswer === oIndex
                  const isCorrect = question.correct === oIndex
                  
                  let optionClass = 'border-2 p-4 rounded-lg cursor-pointer transition-all '
                  
                  if (showQuestionResult) {
                    if (isCorrect) {
                      optionClass += 'border-green-500 bg-green-100 text-green-800'
                    } else if (isSelected && !isCorrect) {
                      optionClass += 'border-red-500 bg-red-100 text-red-800'
                    } else {
                      optionClass += 'border-gray-200 bg-gray-50 text-gray-600'
                    }
                    optionClass += ' cursor-default'
                  } else {
                    if (isSelected) {
                      optionClass += 'border-blue-500 bg-blue-100 text-blue-800'
                    } else {
                      optionClass += 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                    }
                  }

                  return (
                    <div
                      key={oIndex}
                      className={optionClass}
                      onClick={() => handleAnswerSelect(qIndex, oIndex)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected 
                            ? showQuestionResult && !isCorrect
                              ? 'border-red-500 bg-red-500'
                              : 'border-blue-500 bg-blue-500'
                            : 'border-gray-400'
                        }`}>
                          {isSelected && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        
                        <span className="flex-1 font-medium">
                          {String.fromCharCode(65 + oIndex)}. {option}
                        </span>
                        
                        {showQuestionResult && isCorrect && (
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Explanation */}
              {showQuestionResult && questionResult.explanation && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h5 className="font-medium text-blue-900 mb-2">Explanation:</h5>
                  <p className="text-blue-800 text-sm">{questionResult.explanation}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col space-y-3 pt-6 border-t border-gray-200">
        {!showResults ? (
          <button
            onClick={handleSubmit}
            disabled={!allQuestionsAnswered}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {allQuestionsAnswered ? 'Submit Quiz' : `Answer ${quiz.questions.length - Object.keys(selectedAnswers).length} more question${quiz.questions.length - Object.keys(selectedAnswers).length !== 1 ? 's' : ''}`}
          </button>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleSaveAttempt}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Save Attempt
            </button>
            
            <div className="flex space-x-3">
              <button
                onClick={handleRetakeQuiz}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Retake Quiz
              </button>
              
              <button
                onClick={onRegenerate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                New Quiz
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

QuizRenderer.propTypes = {
  quiz: PropTypes.shape({
    questions: PropTypes.arrayOf(PropTypes.shape({
      question: PropTypes.string.isRequired,
      options: PropTypes.arrayOf(PropTypes.string).isRequired,
      correct: PropTypes.number.isRequired,
      explanation: PropTypes.string
    })).isRequired
  }).isRequired,
  onComplete: PropTypes.func,
  onRegenerate: PropTypes.func
}

export default QuizRenderer