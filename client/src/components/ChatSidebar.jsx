import React, { useState, useCallback, useRef, useEffect } from 'react'
import PropTypes from 'prop-types'
import QuizRenderer from './QuizRenderer'
import { getApiUrl, API_ENDPOINTS } from '../utils/api'

const ChatSidebar = ({ selectedFile }) => {
  const [activeTab, setActiveTab] = useState('chat')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [quiz, setQuiz] = useState(null)
  const [progress, setProgress] = useState({ completed: 0, total: 0, attempts: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load progress data
  const loadProgress = useCallback(async () => {
    if (!selectedFile?.id) return

    try {
      const response = await fetch(getApiUrl(API_ENDPOINTS.PROGRESS, { fileId: selectedFile.id }))
      if (response.ok) {
        const data = await response.json()
        setProgress(data.progress || { completed: 0, total: 0, attempts: [] })
      }
    } catch (err) {
      console.error('Error loading progress:', err)
      // Mock progress data
      setProgress({
        completed: 2,
        total: 5,
        attempts: [
          { id: '1', date: '2024-01-01', score: 85, totalQuestions: 5 },
          { id: '2', date: '2024-01-02', score: 92, totalQuestions: 5 }
        ]
      })
    }
  }, [selectedFile])

  useEffect(() => {
    loadProgress()
  }, [loadProgress])

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || loading) return

    const userMessage = { 
      id: Date.now(), 
      role: 'user', 
      content: input, 
      timestamp: new Date() 
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setError('')

    try {
      const response = await fetch(getApiUrl(API_ENDPOINTS.RAG_QUERY), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: input,
          fileId: selectedFile?.id,
          textId: selectedFile?.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()
      
      const aiMessage = { 
        id: Date.now() + 1,
        role: 'ai', 
        content: data.answer || 'I apologize, but I couldn\'t process your question. Please try again.',
        timestamp: new Date(),
        sources: data.sources || []
      }
      
      setMessages(prev => [...prev, aiMessage])
    } catch (err) {
      console.error('Error sending message:', err)
      setError('Failed to send message. Please try again.')
      
      const errorMessage = { 
        id: Date.now() + 1,
        role: 'ai', 
        content: 'Sorry, I encountered an error while processing your question. Please try again later.',
        timestamp: new Date(),
        isError: true
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }, [input, loading, selectedFile])

  const generateQuiz = useCallback(async () => {
    if (!selectedFile?.id) {
      setError('No PDF selected')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(getApiUrl(API_ENDPOINTS.GENERATE_QUIZ), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: selectedFile.id,
          textId: selectedFile.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate quiz')
      }

      const data = await response.json()
      setQuiz(data.quiz)
    } catch (err) {
      console.error('Error generating quiz:', err)
      setError('Failed to generate quiz. Please try again.')
      setQuiz({ error: 'Failed to generate quiz. Please try again.' })
    } finally {
      setLoading(false)
    }
  }, [selectedFile])

  const handleQuizComplete = useCallback(async (results) => {
    try {
      // Save quiz attempt
      const response = await fetch(getApiUrl(API_ENDPOINTS.SAVE_ATTEMPT), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: selectedFile?.id,
          quiz: quiz,
          results: results,
          timestamp: new Date().toISOString()
        })
      })

      if (response.ok) {
        // Reload progress
        await loadProgress()
        
        // Show success message
        const successMessage = {
          id: Date.now(),
          role: 'ai',
          content: `Quiz completed! You scored ${results.score}% (${results.correct}/${results.total} correct). Keep up the great work!`,
          timestamp: new Date(),
          isSuccess: true
        }
        setMessages(prev => [...prev, successMessage])
        setActiveTab('chat') // Switch to chat to show the message
      }
    } catch (err) {
      console.error('Error saving quiz attempt:', err)
    }
  }, [selectedFile, quiz, loadProgress])

  const clearChat = useCallback(() => {
    setMessages([])
    setError('')
  }, [])

  if (!selectedFile) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-6">
          <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 16c0 2.5 2 4.5 4.5 4.5S30 18.5 30 16s-2-4.5-4.5-4.5S21 13.5 21 16zM13 20.5c2.5 0 4.5-2 4.5-4.5S15.5 11.5 13 11.5 8.5 13.5 8.5 16s2 4.5 4.5 4.5zM34 20.5c2.5 0 4.5-2 4.5-4.5S36.5 11.5 34 11.5s-4.5 2-4.5 4.5 2 4.5 4.5 4.5z" />
          </svg>
          <p className="text-gray-500 text-lg">No PDF Selected</p>
          <p className="text-gray-400 text-sm">Select a PDF to start chatting and taking quizzes</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Tab Navigation */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="flex space-x-1">
          {[
            { id: 'chat', label: 'Chat', icon: '💬' },
            { id: 'quiz', label: 'Quiz', icon: '📝' },
            { id: 'progress', label: 'Progress', icon: '📊' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-4 mt-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError('')}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="h-full flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 mt-8">
                  <div className="mb-4">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 16c0 2.5 2 4.5 4.5 4.5S30 18.5 30 16s-2-4.5-4.5-4.5S21 13.5 21 16z" />
                    </svg>
                  </div>
                  <p className="text-lg font-medium">Start a conversation!</p>
                  <p className="text-sm mt-2 text-gray-400">
                    Ask questions about your PDF, request summaries, or seek clarification on any topic.
                  </p>
                  <div className="mt-4 space-y-2 text-sm">
                    <p className="text-gray-600">Try asking:</p>
                    <div className="space-y-1 text-gray-500">
                      <p>• "What is the main topic of this document?"</p>
                      <p>• "Can you summarize the key points?"</p>
                      <p>• "What are the important takeaways?"</p>
                    </div>
                  </div>
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : message.isError
                        ? 'bg-red-50 text-red-800 border border-red-200'
                        : message.isSuccess
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-300">
                        <p className="text-xs text-gray-600">Sources: {message.sources.join(', ')}</p>
                      </div>
                    )}
                    <p className="text-xs mt-1 opacity-75">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-800 p-3 rounded-lg max-w-[85%]">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full"></div>
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 p-4">
              <div className="flex items-end space-x-2">
                <div className="flex-1">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    placeholder="Ask a question about the PDF..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={2}
                    disabled={loading}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={loading || !input.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              
              {messages.length > 0 && (
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={clearChat}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear chat
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quiz Tab */}
        {activeTab === 'quiz' && (
          <div className="h-full overflow-y-auto p-4">
            {!quiz ? (
              <div className="text-center space-y-6 mt-8">
                <div>
                  <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5l7-7 7 7M9 20h6" />
                  </svg>
                  <p className="text-lg font-medium text-gray-900">Generate a Quiz</p>
                  <p className="text-gray-600 mt-2">
                    Create questions based on your PDF content to test your understanding
                  </p>
                </div>
                
                <button
                  onClick={generateQuiz}
                  disabled={loading}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Generating Quiz...</span>
                    </div>
                  ) : (
                    'Generate Quiz'
                  )}
                </button>
              </div>
            ) : quiz.error ? (
              <div className="text-center space-y-4 mt-8">
                <div className="text-red-600">
                  <svg className="mx-auto h-16 w-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-lg font-medium">Quiz Generation Failed</p>
                  <p className="text-sm mt-2">{quiz.error}</p>
                </div>
                <button
                  onClick={generateQuiz}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <QuizRenderer
                quiz={quiz}
                onComplete={handleQuizComplete}
                onRegenerate={generateQuiz}
              />
            )}
          </div>
        )}

        {/* Progress Tab */}
        {activeTab === 'progress' && (
          <div className="h-full overflow-y-auto p-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning Progress</h3>
                
                {/* Progress Overview */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-medium text-gray-900">Overall Progress</h4>
                    <span className="text-2xl font-bold text-blue-600">
                      {progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                    <div 
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {progress.completed} of {progress.total} topics completed
                  </p>
                </div>

                {/* Quiz Attempts */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Quiz Attempts</h4>
                  {progress.attempts.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5l7-7 7 7M9 20h6" />
                      </svg>
                      <p className="text-gray-500">No quiz attempts yet</p>
                      <p className="text-sm text-gray-400 mt-1">Take your first quiz to see your progress</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {progress.attempts.map((attempt, index) => (
                        <div key={attempt.id} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">
                                Quiz Attempt #{progress.attempts.length - index}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(attempt.date).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-lg font-bold ${
                                attempt.score >= 80 ? 'text-green-600' : 
                                attempt.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {attempt.score}%
                              </p>
                              <p className="text-sm text-gray-500">
                                {Math.round(attempt.score * attempt.totalQuestions / 100)}/{attempt.totalQuestions} correct
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

ChatSidebar.propTypes = {
  selectedFile: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    url: PropTypes.string
  })
}

export default ChatSidebar