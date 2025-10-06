import React, { useState, useRef, useEffect } from 'react'
import PropTypes from 'prop-types'

const ChatInput = ({ 
  onSendMessage, 
  placeholder = "Type your message...", 
  disabled = false,
  isTyping = false 
}) => {
  const [message, setMessage] = useState('')
  const [isShiftPressed, setIsShiftPressed] = useState(false)
  const textareaRef = useRef(null)

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const maxHeight = 120 // Max height in pixels (about 5 lines)
      textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px'
    }
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [message])

  const handleSubmit = () => {
    if (message.trim() && !disabled && !isTyping) {
      onSendMessage(message.trim())
      setMessage('')
      // Reset textarea height
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
        }
      }, 0)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Shift') {
      setIsShiftPressed(true)
    }
    
    if (e.key === 'Enter') {
      if (!isShiftPressed) {
        e.preventDefault()
        handleSubmit()
      }
    }
  }

  const handleKeyUp = (e) => {
    if (e.key === 'Shift') {
      setIsShiftPressed(false)
    }
  }

  const handleInputChange = (e) => {
    setMessage(e.target.value)
  }

  const canSend = message.trim() && !disabled && !isTyping

  return (
    <div className="relative">
      <div className={`flex items-end space-x-3 p-3 bg-gray-50 rounded-xl border transition-colors ${
        disabled ? 'border-gray-200 bg-gray-100' : 'border-gray-300 focus-within:border-blue-500 focus-within:bg-white'
      }`}>
        {/* Textarea */}
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            placeholder={disabled ? 'Please wait...' : placeholder}
            disabled={disabled}
            className={`w-full resize-none border-none outline-none bg-transparent placeholder-gray-500 text-gray-900 ${
              disabled ? 'cursor-not-allowed' : ''
            }`}
            style={{
              minHeight: '20px',
              maxHeight: '120px',
              lineHeight: '20px'
            }}
            rows={1}
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className={`flex-shrink-0 p-2 rounded-lg transition-all ${
            canSend
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title={canSend ? 'Send message' : 'Type a message to send'}
        >
          {isTyping ? (
            <div className="w-5 h-5 flex items-center justify-center">
              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>

      {/* Helper text */}
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="text-xs text-gray-500">
          {isTyping ? (
            <span className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>AI is responding...</span>
            </span>
          ) : (
            <span>
              <kbd className="px-1 py-0.5 bg-gray-200 border border-gray-300 rounded text-xs">Enter</kbd> to send, 
              <kbd className="px-1 py-0.5 bg-gray-200 border border-gray-300 rounded text-xs ml-1">Shift+Enter</kbd> for new line
            </span>
          )}
        </div>
        
        {message.length > 0 && (
          <div className={`text-xs ${message.length > 2000 ? 'text-red-500' : 'text-gray-400'}`}>
            {message.length}/2000
          </div>
        )}
      </div>
    </div>
  )
}

ChatInput.propTypes = {
  onSendMessage: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  isTyping: PropTypes.bool
}

export default ChatInput