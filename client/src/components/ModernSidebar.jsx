import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import UserProfileSection from './UserProfileSection'

const Sidebar = ({
  chats,
  pdfs,
  quizzes,
  activeTab,
  currentChatId,
  selectedPDF,
  onTabChange,
  onChatSelect,
  onNewChat,
  onDeleteChat,
  onPDFSelect,
  onUploadPDF,
  onPDFDelete,
  isOpen = true,
  onClose
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [showPDFDeleteConfirm, setShowPDFDeleteConfirm] = useState(null)

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const handleDeleteClick = (e, chatId) => {
    e.stopPropagation()
    setShowDeleteConfirm(chatId)
  }

  const handlePDFDeleteClick = (e, pdfId) => {
    e.stopPropagation()
    setShowPDFDeleteConfirm(pdfId)
  }

  const confirmDelete = (chatId) => {
    onDeleteChat(chatId)
    setShowDeleteConfirm(null)
  }

  const confirmPDFDelete = async (pdfId) => {
    try {
      const success = await onPDFDelete(pdfId)
      if (success) {
        setShowPDFDeleteConfirm(null)
      } else {
        // Could add error notification here
        console.error('Failed to delete PDF')
      }
    } catch (error) {
      console.error('Error deleting PDF:', error)
    }
  }

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!event.target.closest('.sidebar-container') && onClose) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen, onClose])

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden bg-black/50 backdrop-blur-sm" onClick={onClose} />
      )}

      {/* Sidebar Container */}
      <div 
        className={`sidebar-container fixed lg:relative inset-y-0 left-0 z-50 w-80 bg-white border-r border-gray-200 shadow-xl lg:shadow-none transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col h-full overflow-hidden`}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-sm">BC</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Workspace</h2>
                <p className="text-xs text-gray-600">Your learning space</p>
              </div>
            </div>
            
            {/* Close button for mobile */}
            {onClose && (
              <button
                onClick={onClose}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
            {[
              { id: 'chats', label: 'Chats', icon: '💬', count: chats.length },
              { id: 'files', label: 'Files', icon: '📄', count: pdfs.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex-1 ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chats' && (
            <div className="h-full flex flex-col">
              {/* New Chat Button */}
              <div className="flex-shrink-0 p-4">
                <button
                  onClick={onNewChat}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm hover:shadow-md group"
                >
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="font-medium">New Chat</span>
                </button>
              </div>

              {/* Chat List */}
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {chats.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-4.126-.98L3 20l1.98-5.874A8.955 8.955 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">No chats yet</h3>
                    <p className="text-xs text-gray-500">Start a new conversation to begin learning</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {chats.map((chat) => (
                      <div
                        key={chat.id}
                        onClick={() => onChatSelect(chat.id)}
                        className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                          currentChatId === chat.id
                            ? 'bg-blue-50 border-blue-200 shadow-sm'
                            : 'hover:bg-gray-50 border-transparent hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {chat.title || 'New Chat'}
                            </h4>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(chat.lastUpdated || chat.createdAt)}
                            </p>
                            {chat.messages && chat.messages.length > 0 && (
                              <p className="text-xs text-gray-400 mt-1 truncate">
                                {chat.messages[chat.messages.length - 1]?.content?.substring(0, 50)}...
                              </p>
                            )}
                          </div>
                          
                          <button
                            onClick={(e) => handleDeleteClick(e, chat.id)}
                            className="opacity-0 group-hover:opacity-100 ml-2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete chat"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>

                        {chat.pdfId && (
                          <div className="mt-2 flex items-center space-x-1">
                            <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs text-gray-500">With PDF context</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="h-full flex flex-col">
              {/* Upload Button */}
              <div className="flex-shrink-0 p-4">
                <button
                  onClick={onUploadPDF}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-sm hover:shadow-md group"
                >
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="font-medium">Upload PDF</span>
                </button>
              </div>

              {/* PDF List */}
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {pdfs.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5l7-7 7 7M9 20h6" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">No files uploaded</h3>
                    <p className="text-xs text-gray-500">Upload your first PDF to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pdfs.map((pdf) => (
                      <div
                        key={pdf.id}
                        onClick={() => onPDFSelect(pdf)}
                        className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                          selectedPDF?.id === pdf.id
                            ? 'bg-green-50 border-green-200 shadow-sm'
                            : 'hover:bg-gray-50 border-transparent hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                              <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {pdf.original_name || pdf.file_name || pdf.name}
                            </h4>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(pdf.created_at || pdf.uploadedAt)}
                            </p>
                            {pdf.file_size && (
                              <p className="text-xs text-gray-400 mt-1">
                                {(pdf.file_size / 1024 / 1024).toFixed(1)} MB
                              </p>
                            )}
                          </div>
                          
                          <button
                            onClick={(e) => handlePDFDeleteClick(e, pdf.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete PDF"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Section */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50">
          <UserProfileSection className="p-4" />
        </div>
      </div>

      {/* Delete Chat Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Delete Chat</h3>
              <p className="text-gray-600 text-center mb-6">
                Are you sure you want to delete this chat? This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmDelete(showDeleteConfirm)}
                  className="flex-1 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete PDF Confirmation Modal */}
      {showPDFDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Delete PDF</h3>
              <p className="text-gray-600 text-center mb-6">
                Are you sure you want to delete this PDF? This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPDFDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmPDFDelete(showPDFDeleteConfirm)}
                  className="flex-1 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

Sidebar.propTypes = {
  chats: PropTypes.array.isRequired,
  pdfs: PropTypes.array.isRequired,
  quizzes: PropTypes.array.isRequired,
  activeTab: PropTypes.string.isRequired,
  currentChatId: PropTypes.string,
  selectedPDF: PropTypes.object,
  onTabChange: PropTypes.func.isRequired,
  onChatSelect: PropTypes.func.isRequired,
  onNewChat: PropTypes.func.isRequired,
  onDeleteChat: PropTypes.func.isRequired,
  onPDFSelect: PropTypes.func.isRequired,
  onUploadPDF: PropTypes.func.isRequired,
  onPDFDelete: PropTypes.func.isRequired,
  isOpen: PropTypes.bool,
  onClose: PropTypes.func
}

export default Sidebar