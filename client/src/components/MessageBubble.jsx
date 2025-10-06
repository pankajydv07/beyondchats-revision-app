import React, { useState } from 'react'
import PropTypes from 'prop-types'

const MessageBubble = ({ message, isLastMessage = false }) => {
  const [showFullTimestamp, setShowFullTimestamp] = useState(false)
  const isUser = message.role === 'user'
  const isTyping = message.isTyping

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (showFullTimestamp) {
      return date.toLocaleString()
    }
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return date.toLocaleDateString()
  }

  const TypingIndicator = () => (
    <div className="flex items-center space-x-1">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span className="text-sm text-gray-500 ml-2">AI is typing...</span>
    </div>
  )

  const MessageContent = ({ content }) => {
    // Simple markdown-like formatting
    const formatContent = (text) => {
      if (!text) return ''
      
      // Convert **bold** to <strong>
      text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      
      // Convert *italic* to <em>
      text = text.replace(/\*(.*?)\*/g, '<em>$1</em>')
      
      // Convert `code` to <code>
      text = text.replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>')
      
      // Convert line breaks to <br>
      text = text.replace(/\n/g, '<br>')
      
      return text
    }

    return (
      <div 
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: formatContent(content) }}
      />
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
      <div className={`flex items-start space-x-3 max-w-[80%] ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-100 text-gray-600'
        }`}>
          {isUser ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
          )}
        </div>

        {/* Message bubble */}
        <div className={`relative px-4 py-3 rounded-2xl ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
        } ${isTyping ? 'min-h-[60px] flex items-center' : ''}`}>
          {isTyping ? (
            <TypingIndicator />
          ) : (
            <>
              <MessageContent content={message.content} />
              
              {/* Message actions (show on hover) */}
              <div className={`absolute top-1 ${isUser ? 'left-1' : 'right-1'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                <div className="flex space-x-1">
                  <button
                    onClick={() => navigator.clipboard.writeText(message.content)}
                    className={`p-1 rounded hover:bg-opacity-20 ${
                      isUser ? 'hover:bg-white text-blue-100' : 'hover:bg-gray-300 text-gray-500'
                    }`}
                    title="Copy message"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Timestamp */}
      {!isTyping && message.timestamp && (
        <div className={`flex items-end ${isUser ? 'mr-12' : 'ml-12'} opacity-0 group-hover:opacity-100 transition-opacity`}>
          <button
            onClick={() => setShowFullTimestamp(!showFullTimestamp)}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            {formatTimestamp(message.timestamp)}
          </button>
        </div>
      )}
    </div>
  )
}

MessageBubble.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string,
    role: PropTypes.oneOf(['user', 'assistant']).isRequired,
    content: PropTypes.string.isRequired,
    timestamp: PropTypes.string,
    isTyping: PropTypes.bool
  }).isRequired,
  isLastMessage: PropTypes.bool
}

export default MessageBubble