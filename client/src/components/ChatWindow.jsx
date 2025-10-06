import React, { useRef, useEffect } from 'react'
import PropTypes from 'prop-types'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'

const ChatWindow = ({
  messages,
  isTyping,
  onSendMessage,
  placeholder = "Ask a question about your course materials...",
  selectedPDF = null,
  disabled = false
}) => {
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const EmptyState = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-3">
          Welcome to BeyondChats
        </h3>
        <p className="text-gray-600 mb-6 leading-relaxed">
          {selectedPDF 
            ? `Start asking questions about "${selectedPDF.name}" or get help with your studies.`
            : "Upload a PDF document and start an intelligent conversation about your course materials."
          }
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
          <h4 className="font-medium text-blue-900 mb-2">💡 Try asking:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• "What are the main topics covered?"</li>
            <li>• "Explain this concept in simple terms"</li>
            <li>• "Create a quiz on chapter 3"</li>
            <li>• "Summarize the key points"</li>
          </ul>
        </div>
      </div>
    </div>
  )

  const MessagesArea = () => (
    <div 
      ref={messagesContainerRef}
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id || index}
          message={message}
          isLastMessage={index === messages.length - 1}
        />
      ))}
      
      {isTyping && (
        <MessageBubble
          message={{
            role: 'assistant',
            content: '',
            isTyping: true
          }}
          isLastMessage={true}
        />
      )}
      
      <div ref={messagesEndRef} />
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedPDF ? `Discussing: ${selectedPDF.name}` : 'Chat'}
            </h2>
            {selectedPDF && (
              <p className="text-sm text-gray-500 mt-1">
                Interactive learning assistant
              </p>
            )}
          </div>
          {selectedPDF && (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>PDF loaded</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages or Empty State */}
      {messages.length === 0 ? <EmptyState /> : <MessagesArea />}

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4">
        <ChatInput
          onSendMessage={onSendMessage}
          placeholder={placeholder}
          disabled={disabled || isTyping}
          isTyping={isTyping}
        />
        
        {/* Status indicators */}
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            {selectedPDF && (
              <span className="flex items-center space-x-1">
                <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                <span>PDF context enabled</span>
              </span>
            )}
            {isTyping && (
              <span className="flex items-center space-x-1 text-blue-600">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                <span>AI is thinking...</span>
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <span>Press Enter to send</span>
            <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs">⏎</kbd>
          </div>
        </div>
      </div>
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
  placeholder: PropTypes.string,
  selectedPDF: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired
  }),
  disabled: PropTypes.bool
}

export default ChatWindow