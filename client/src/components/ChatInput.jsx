import React, { useState, useRef, useEffect } from 'react'
import PropTypes from 'prop-types'

const ChatInput = ({ onSendMessage, onUploadFile, placeholder = 'Type your question here…', disabled = false, isTyping = false }) => {
  const [message, setMessage] = useState('')
  const [isShiftPressed, setIsShiftPressed] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const max = 140
    ta.style.height = Math.min(ta.scrollHeight, max) + 'px'
  }, [message])

  const handleSubmit = () => {
    if (!message.trim() || disabled || isTyping) return
    onSendMessage(message.trim())
    setMessage('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Shift') setIsShiftPressed(true)
    if (e.key === 'Enter' && !isShiftPressed) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleKeyUp = (e) => {
    if (e.key === 'Shift') setIsShiftPressed(false)
  }

  const canSend = message.trim().length > 0 && !disabled && !isTyping

  return (
    <div className="w-full">
      <div className="flex items-center space-x-3">
        <label className="upload-icon" title="Upload PDF">
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files && e.target.files[0]
              if (f && onUploadFile) onUploadFile(f)
            }}
          />
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v8M8 8l4-4 4 4M12 4v8" />
          </svg>
        </label>

        <div className="chat-input-container">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            placeholder={disabled ? 'Please wait...' : placeholder}
            disabled={disabled}
            className="chat-input-enhanced"
            rows={1}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className={`send-button ${!canSend ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Send message"
        >
          {isTyping ? (
            <div className="w-5 h-5 flex items-center justify-center">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <svg className="w-5 h-5 transform rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10l9-7 9 7-9 7-9-7z" />
            </svg>
          )}
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <div>
          <span>
            <kbd className="px-1 py-0.5 bg-gray-200 border border-gray-300 rounded text-xs">Enter</kbd> to send,
            <kbd className="px-1 py-0.5 bg-gray-200 border border-gray-300 rounded text-xs ml-1">Shift+Enter</kbd> for newline
          </span>
        </div>
        <div>
          {message.length > 0 && <span className={`${message.length > 2000 ? 'text-red-500' : 'text-gray-400'}`}>{message.length}/2000</span>}
        </div>
      </div>
    </div>
  )
}

ChatInput.propTypes = {
  onSendMessage: PropTypes.func.isRequired,
  onUploadFile: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  isTyping: PropTypes.bool
}

export default ChatInput
