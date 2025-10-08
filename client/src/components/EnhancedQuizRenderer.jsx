import React, { useState, useCallback, useEffect } from 'react'
import PropTypes from 'prop-types'

const QuizRenderer = ({ quiz, onComplete }) => {
  const [mcqAnswers, setMcqAnswers] = useState({})
  const [shortAnswers, setShortAnswers] = useState({})
  const [longAnswers, setLongAnswers] = useState({})
  const [showResults, setShowResults] = useState(false)
  const [results, setResults] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [timeSpent, setTimeSpent] = useState(0)
  const [startTime] = useState(Date.now())

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(timer)
  }, [startTime])

  const handleMcqSelect = useCallback((questionIndex, optionIndex) => {
    if (showResults) return // Prevent changes after submission

    setMcqAnswers(prev => ({
      ...prev,
      [questionIndex]: optionIndex
    }))
  }, [showResults])

  const handleShortAnswerChange = useCallback((questionIndex, value) => {
    if (showResults) return // Prevent changes after submission

    setShortAnswers(prev => ({
      ...prev,
      [questionIndex]: value
    }))
  }, [showResults])

  const handleLongAnswerChange = useCallback((questionIndex, value) => {
    if (showResults) return // Prevent changes after submission

    setLongAnswers(prev => ({
      ...prev,
      [questionIndex]: value
    }))
  }, [showResults])

  const handleSubmit = useCallback(async () => {
    setIsAnalyzing(true)

    try {
      // Prepare data for analysis
      const allAnswers = {
        mcq: Object.entries(mcqAnswers).map(([index, answer]) => ({
          questionIndex: parseInt(index),
          question: quiz.mcq[parseInt(index)].question,
          selectedAnswer: answer,
          options: quiz.mcq[parseInt(index)].options
        })),
        shortAnswer: Object.entries(shortAnswers).map(([index, answer]) => ({
          questionIndex: parseInt(index),
          question: quiz.shortAnswer[parseInt(index)].question,
          answer
        })),
        longAnswer: Object.entries(longAnswers).map(([index, answer]) => ({
          questionIndex: parseInt(index),
          question: quiz.longAnswer[parseInt(index)].question,
          answer
        }))
      }

      // Send to API for analysis
      const response = await fetch('http://localhost:5000/api/analyze-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answers: allAnswers,
          quiz
        })
      })

      if (!response.ok) {
        throw new Error('Failed to analyze quiz')
      }

      const data = await response.json()
      
      setResults(data.results)
      setShowResults(true)
      
      if (onComplete) {
        onComplete(data.results)
      }
    } catch (error) {
      console.error('Error analyzing quiz:', error)
      // Handle error
    } finally {
      setIsAnalyzing(false)
    }
  }, [quiz, mcqAnswers, shortAnswers, longAnswers, onComplete])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!quiz) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No quiz available</p>
      </div>
    )
  }

  const isMcqComplete = quiz.mcq.length === Object.keys(mcqAnswers).length
  const isShortComplete = quiz.shortAnswer.length === Object.keys(shortAnswers).length
  const isLongComplete = quiz.longAnswer.length === Object.keys(longAnswers).length
  const isQuizComplete = isMcqComplete && isShortComplete && isLongComplete

  return (
    <div className="space-y-6">
      {/* Quiz Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Knowledge Check</h3>
            <p className="text-gray-600 mt-1">
              Test your understanding of the material
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
                Progress: {Object.keys(mcqAnswers).length + Object.keys(shortAnswers).length + Object.keys(longAnswers).length} / {quiz.mcq.length + quiz.shortAnswer.length + quiz.longAnswer.length}
              </span>
              <span className={`px-2 py-1 rounded text-xs ${
                isQuizComplete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {isQuizComplete ? 'Ready to submit' : 'Answer all questions'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${((Object.keys(mcqAnswers).length + Object.keys(shortAnswers).length + Object.keys(longAnswers).length) / (quiz.mcq.length + quiz.shortAnswer.length + quiz.longAnswer.length)) * 100}%` 
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      {showResults && results && (
        <div className="rounded-lg p-6 border-2 bg-blue-50 border-blue-200">
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">{results.overallScore}%</div>
            <p className="text-lg font-medium mb-1">{results.feedback}</p>
            <p className="text-sm opacity-75">
              Completed in {formatTime(timeSpent)}
            </p>
          </div>
        </div>
      )}

      {/* MCQ Questions */}
      <div className="space-y-6">
        <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Multiple Choice Questions</h4>
        {quiz.mcq.map((question, qIndex) => {
          const selectedAnswer = mcqAnswers[qIndex]
          const showQuestionResult = showResults && results && results.mcq && results.mcq[qIndex]
          const questionResult = showQuestionResult ? results.mcq[qIndex] : null

          return (
            <div 
              key={`mcq-${qIndex}`} 
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
                <h5 className="text-lg font-medium text-gray-900 flex-1">
                  <span className="inline-block w-8 h-8 bg-gray-100 text-gray-600 rounded-full text-sm font-bold flex items-center justify-center mr-3">
                    {qIndex + 1}
                  </span>
                  {question.question}
                </h5>
                
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
                  const isCorrect = showQuestionResult && questionResult.correctAnswerIndex === oIndex
                  
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
                      onClick={() => handleMcqSelect(qIndex, oIndex)}
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

      {/* Short Answer Questions */}
      <div className="space-y-6">
        <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Short Answer Questions</h4>
        {quiz.shortAnswer.map((question, qIndex) => {
          const answer = shortAnswers[qIndex] || ''
          const showQuestionResult = showResults && results && results.shortAnswer && results.shortAnswer[qIndex]
          const questionResult = showQuestionResult ? results.shortAnswer[qIndex] : null

          return (
            <div 
              key={`short-${qIndex}`} 
              className={`bg-white rounded-lg border-2 p-6 transition-all ${
                showQuestionResult 
                  ? 'border-blue-200 bg-blue-50' 
                  : answer.trim() !== ''
                    ? 'border-blue-200' 
                    : 'border-gray-200'
              }`}
            >
              <h5 className="text-lg font-medium text-gray-900 mb-4">
                <span className="inline-block w-8 h-8 bg-gray-100 text-gray-600 rounded-full text-sm font-bold flex items-center justify-center mr-3">
                  {quiz.mcq.length + qIndex + 1}
                </span>
                {question.question}
              </h5>
              
              <textarea
                value={answer}
                onChange={(e) => handleShortAnswerChange(qIndex, e.target.value)}
                disabled={showResults}
                placeholder="Type your answer here..."
                className={`w-full p-4 border rounded-lg ${showResults ? 'bg-gray-50' : 'bg-white'}`}
                rows={3}
              />

              {showQuestionResult && questionResult.feedback && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h5 className="font-medium text-blue-900 mb-2">Feedback:</h5>
                  <p className="text-blue-800 text-sm">{questionResult.feedback}</p>
                  <div className="mt-2 pt-2 border-t border-blue-100">
                    <p className="text-sm text-blue-900">
                      <span className="font-medium">Score:</span> {questionResult.score}/10
                    </p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Long Answer Question */}
      <div className="space-y-6">
        <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Long Answer Question</h4>
        {quiz.longAnswer.map((question, qIndex) => {
          const answer = longAnswers[qIndex] || ''
          const showQuestionResult = showResults && results && results.longAnswer && results.longAnswer[qIndex]
          const questionResult = showQuestionResult ? results.longAnswer[qIndex] : null

          return (
            <div 
              key={`long-${qIndex}`} 
              className={`bg-white rounded-lg border-2 p-6 transition-all ${
                showQuestionResult 
                  ? 'border-blue-200 bg-blue-50' 
                  : answer.trim() !== ''
                    ? 'border-blue-200' 
                    : 'border-gray-200'
              }`}
            >
              <h5 className="text-lg font-medium text-gray-900 mb-4">
                <span className="inline-block w-8 h-8 bg-gray-100 text-gray-600 rounded-full text-sm font-bold flex items-center justify-center mr-3">
                  {quiz.mcq.length + quiz.shortAnswer.length + qIndex + 1}
                </span>
                {question.question}
              </h5>
              
              <textarea
                value={answer}
                onChange={(e) => handleLongAnswerChange(qIndex, e.target.value)}
                disabled={showResults}
                placeholder="Type your answer here..."
                className={`w-full p-4 border rounded-lg ${showResults ? 'bg-gray-50' : 'bg-white'}`}
                rows={6}
              />

              {showQuestionResult && questionResult.feedback && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h5 className="font-medium text-blue-900 mb-2">Feedback:</h5>
                  <p className="text-blue-800 text-sm">{questionResult.feedback}</p>
                  <div className="mt-2 pt-2 border-t border-blue-100">
                    <p className="text-sm text-blue-900">
                      <span className="font-medium">Score:</span> {questionResult.score}/10
                    </p>
                  </div>
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
            disabled={!isQuizComplete || isAnalyzing}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isAnalyzing ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Analyzing Answers...</span>
              </div>
            ) : isQuizComplete ? (
              'Submit Quiz'
            ) : (
              `Complete All Questions (${(quiz.mcq.length + quiz.shortAnswer.length + quiz.longAnswer.length) - (Object.keys(mcqAnswers).length + Object.keys(shortAnswers).length + Object.keys(longAnswers).length)} remaining)`
            )}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-gray-700">
              Your quiz results have been saved to track your progress.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Continue Learning
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

QuizRenderer.propTypes = {
  quiz: PropTypes.shape({
    mcq: PropTypes.arrayOf(PropTypes.shape({
      question: PropTypes.string.isRequired,
      options: PropTypes.arrayOf(PropTypes.string).isRequired
    })).isRequired,
    shortAnswer: PropTypes.arrayOf(PropTypes.shape({
      question: PropTypes.string.isRequired
    })).isRequired,
    longAnswer: PropTypes.arrayOf(PropTypes.shape({
      question: PropTypes.string.isRequired
    })).isRequired
  }),
  onComplete: PropTypes.func
}

export default QuizRenderer