import React, { useRef, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'
import EnhancedQuizRenderer from './EnhancedQuizRenderer'
import { getApiUrl, API_ENDPOINTS } from '../utils/api'

const ChatWindow = ({
  messages,
  isTyping,
  onSendMessage,
  onQuizSubmit,
  placeholder = "Ask a question about your course materials...",
  selectedPDF = null,
  disabled = false,
  isSidebarOpen = false,
  onToggleSidebar = null
}) => {
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const [mode, setMode] = useState('chat') // 'chat' or 'quiz'
  const [quiz, setQuiz] = useState(null)
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])
  
  const generateQuiz = async () => {
    if (!selectedPDF) {
      return
    }
    
    setIsGeneratingQuiz(true)
    
    try {
      const response = await fetch(getApiUrl(API_ENDPOINTS.GENERATE_QUIZ), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: selectedPDF.id,
          textId: selectedPDF.id,
          types: {
            mcq: 3, // 3 multiple choice questions
            shortAnswer: 2, // 2 short answer questions
            longAnswer: 1  // 1 long answer question
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate quiz')
      }

      const data = await response.json()
      setQuiz(data.quiz)
    } catch (error) {
      console.error('Error generating quiz:', error)
      // Handle error state if needed
    } finally {
      setIsGeneratingQuiz(false)
    }
  }
  
  const handleQuizSubmit = async (results) => {
    console.log('Quiz results submitted:', results)
    if (onQuizSubmit) {
      await onQuizSubmit(results)
    }
  }

  const handleGenerateNewQuiz = async () => {
    // Reset quiz state and generate a new quiz
    setQuiz(null)
    await generateQuiz()
  }

  const EmptyState = () => (
    <div className="welcome-container" style={{ paddingBottom: '160px' }}>
      <div className="text-center max-w-3xl">
        {/* Animated Welcome Icon */}
        <div className="relative mx-auto w-20 h-20 mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full"></div>
          <div className="absolute inset-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>

        <h1 className="welcome-title">
          Welcome to BeyondChats
        </h1>
        
        <p className="welcome-subtitle">
          {selectedPDF 
            ? `Ready to explore "${selectedPDF.name}"? Ask questions, request summaries, or generate quizzes to enhance your learning.`
            : "Upload a PDF document to start an intelligent conversation about your course materials. I'm here to help you learn!"
          }
        </p>

        {/* Feature Cards Grid */}
        <div className="feature-grid">
          <div className="feature-card feature-card-blue">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-blue-500 bg-opacity-20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg">Ask Questions</h3>
            </div>
            <p className="text-sm opacity-90">"What are the main topics covered in chapter 3?"</p>
          </div>

          <div className="feature-card feature-card-green">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-green-500 bg-opacity-20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg">Get Summaries</h3>
            </div>
            <p className="text-sm opacity-90">"Summarize the key concepts in simple terms"</p>
          </div>

          <div className="feature-card feature-card-purple">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-purple-500 bg-opacity-20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg">Take Quizzes</h3>
            </div>
            <p className="text-sm opacity-90">"Create a quiz to test my understanding"</p>
          </div>

          <div className="feature-card feature-card-pink">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-pink-500 bg-opacity-20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-pink-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg">Explain Concepts</h3>
            </div>
            <p className="text-sm opacity-90">"Explain this concept in simple terms"</p>
          </div>
        </div>

        {selectedPDF && (
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full text-sm font-medium text-green-800">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>PDF loaded and ready</span>
          </div>
        )}
      </div>
    </div>
  )

  const MessagesArea = () => (
    <div 
      ref={messagesContainerRef}
      className="flex-1 overflow-y-auto px-6 py-6 pb-6 space-y-6 scroll-smooth custom-scrollbar"
      style={{ scrollBehavior: 'smooth', paddingBottom: '140px' }}
    >
      {messages.map((message, index) => (
        <div
          key={message.id || index}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
        >
          <div className={`max-w-[85%] ${message.role === 'user' ? 'order-1' : 'order-2'}`}>
            <MessageBubble
              message={message}
              isLastMessage={index === messages.length - 1}
            />
          </div>
        </div>
      ))}
      
      {isTyping && (
        <div className="flex justify-start animate-fade-in">
          <div className="max-w-[85%]">
            <MessageBubble
              message={{
                role: 'assistant',
                content: '',
                isTyping: true
              }}
              isLastMessage={true}
            />
          </div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-white relative">
      {/* Enhanced Header */}
      <div className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-b border-gray-200 shadow-sm z-10">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Sidebar Toggle Button - Desktop only */}
              {onToggleSidebar && (
                <button
                  onClick={onToggleSidebar}
                  className="hidden lg:flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors group"
                  title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                >
                  {isSidebarOpen ? (
                    <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              )}

              <div className="flex items-center space-x-3">
                {selectedPDF ? (
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-4.126-.98L3 20l1.98-5.874A8.955 8.955 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                    </svg>
                  </div>
                )}
                
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {selectedPDF ? selectedPDF.name : 'BeyondChats Assistant'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {selectedPDF 
                      ? `${messages.length} messages • Interactive learning mode`
                      : 'Ready to help with your studies'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Mode Toggle - Only show when PDF is selected */}
            {selectedPDF && (
              <div className="flex items-center space-x-4">
                <div className="flex bg-gray-100 rounded-xl p-1 shadow-sm">
                  <button
                    onClick={() => setMode('chat')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      mode === 'chat'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-4.126-.98L3 20l1.98-5.874A8.955 8.955 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                      </svg>
                      <span>Chat</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setMode('quiz')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      mode === 'quiz'
                        ? 'bg-white text-purple-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span>Quiz</span>
                    </div>
                  </button>
                </div>
                
                {/* PDF Status Indicator */}
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-sm font-medium text-green-700">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>PDF Active</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Area - Show Chat or Quiz based on mode */}
      {mode === 'chat' ? (
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Messages or Empty State */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? <EmptyState /> : <MessagesArea />}
          </div>

          {/* Fixed footer input at bottom */}
          <div className="chat-footer-fixed">
            <div className="chat-footer-inner">
              <ChatInput
                onSendMessage={onSendMessage}
                placeholder="Ask a question about your course materials..."
                disabled={disabled || isTyping}
                isTyping={isTyping}
              />
            </div>
            
            {/* Status indicators integrated with input */}
            {(selectedPDF || isTyping) && (
              <div className="flex items-center justify-center space-x-4 text-xs text-gray-500 mt-2">
                {selectedPDF && (
                  <div className="flex items-center space-x-2 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-200">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">PDF Active</span>
                  </div>
                )}
                {isTyping && (
                  <div className="flex items-center space-x-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce"></div>
                      <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="font-medium">AI is thinking...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Enhanced Quiz Mode Content */
        <div className="flex-1 overflow-y-auto">
          {!quiz ? (
            /* Enhanced Generate Quiz UI */
            <div className="h-full flex flex-col items-center justify-center p-8">
              <div className="text-center max-w-md space-y-8">
                <div className="relative">
                  <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-12 h-12 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  {/* Animated ring */}
                  <div className="absolute inset-0 rounded-full border-2 border-purple-200 animate-ping"></div>
                </div>
                
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Test Your Knowledge</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Generate an intelligent quiz based on your PDF content. I'll create questions that test your understanding and help reinforce key concepts.
                  </p>
                </div>
                
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-left">
                  <h4 className="font-semibold text-purple-900 mb-2">📝 What you'll get:</h4>
                  <ul className="text-sm text-purple-800 space-y-1">
                    <li>• 3 Multiple choice questions</li>
                    <li>• 2 Short answer questions</li>
                    <li>• 1 Long answer question</li>
                    <li>• Detailed explanations</li>
                  </ul>
                </div>
                
                <button
                  onClick={generateQuiz}
                  disabled={isGeneratingQuiz}
                  className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {isGeneratingQuiz ? (
                    <div className="flex items-center justify-center space-x-3">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Generating Quiz...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Generate Quiz</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <EnhancedQuizRenderer 
                quiz={quiz} 
                onComplete={handleQuizSubmit}
                onGenerateNewQuiz={handleGenerateNewQuiz}
              />
            </div>
          )}
        </div>
      )}
      
    </div>
  )
}

ChatWindow.propTypes = {
  messages: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    role: PropTypes.oneOf(['user', 'assistant']).isRequired,
    content: PropTypes.string.isRequired,
    timestamp: PropTypes.string,
    isTyping: PropTypes.bool
  })).isRequired,
  isTyping: PropTypes.bool.isRequired,
  onSendMessage: PropTypes.func.isRequired,
  onQuizSubmit: PropTypes.func,
  placeholder: PropTypes.string,
  selectedPDF: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired
  }),
  disabled: PropTypes.bool,
  isSidebarOpen: PropTypes.bool,
  onToggleSidebar: PropTypes.func
}

export default ChatWindow