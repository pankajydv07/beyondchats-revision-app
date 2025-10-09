import React, { useState } from 'react'
import PropTypes from 'prop-types'
import UserProfileSection from './UserProfileSection'

const Sidebar = ({
  chats,
  pdfs,
  quizzes,
  progress,
  activeTab,
  currentChatId,
  selectedPDF,
  onTabChange,
  onChatSelect,
  onNewChat,
  onDeleteChat,
  onPDFSelect,
  onUploadPDF
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

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

  const confirmDelete = (chatId) => {
    onDeleteChat(chatId)
    setShowDeleteConfirm(null)
  }

  const tabs = [
    { id: 'chats', label: 'Chats', icon: '💬', count: chats.length },
    { id: 'progress', label: 'Progress', icon: '📊', count: null }
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">BeyondChats</h1>
          {activeTab === 'chats' && (
            <button
              onClick={onNewChat}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="New Chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count !== null && (
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === tab.id ? 'bg-gray-200' : 'bg-gray-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Chats Tab */}
        {activeTab === 'chats' && (
          <div className="h-full flex flex-col">
            {chats.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 16c0 2.5 2 4.5 4.5 4.5S30 18.5 30 16s-2-4.5-4.5-4.5S21 13.5 21 16z" />
                  </svg>
                  <p className="text-gray-500 font-medium">No chats yet</p>
                  <p className="text-sm text-gray-400 mt-1">Start a new conversation</p>
                  <button
                    onClick={onNewChat}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    New Chat
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="p-2 space-y-1">
                  {chats.map((chat) => (
                    <div
                      key={chat.id}
                      className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                        currentChatId === chat.id
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => onChatSelect(chat.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            currentChatId === chat.id ? 'text-blue-900' : 'text-gray-900'
                          }`}>
                            {chat.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(chat.updatedAt)}
                          </p>
                          {chat.messages.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1 truncate">
                              {chat.messages[chat.messages.length - 1].content}
                            </p>
                          )}
                        </div>
                        
                        <button
                          onClick={(e) => handleDeleteClick(e, chat.id)}
                          className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-gray-400 hover:text-red-600 transition-all"
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
                          <span className="text-xs text-gray-500">With PDF</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quiz tab removed */}

        {/* Progress Tab */}
        {activeTab === 'progress' && (
          <div className="p-4 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning Progress</h3>
              
              {/* Overall Progress */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Overall</h4>
                  <span className="text-lg font-bold text-blue-600">
                    {progress.overall || 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress.overall || 0}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-2xl font-bold text-gray-900">{chats.length}</p>
                  <p className="text-sm text-gray-600">Chats</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-2xl font-bold text-gray-900">{quizzes.length}</p>
                  <p className="text-sm text-gray-600">Quizzes</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-2xl font-bold text-gray-900">{pdfs.length}</p>
                  <p className="text-sm text-gray-600">PDFs</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-2xl font-bold text-gray-900">
                    {quizzes.length > 0 ? Math.round(quizzes.reduce((acc, q) => acc + q.score, 0) / quizzes.length) : 0}%
                  </p>
                  <p className="text-sm text-gray-600">Avg Score</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Profile Section */}
      <UserProfileSection className="mt-auto" />
      
      {/* PDF Section */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Course Materials</h3>
          <button
            onClick={onUploadPDF}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            + Upload
          </button>
        </div>
        
        {pdfs.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">No PDFs uploaded</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {pdfs.slice(0, 3).map((pdf) => (
              <div
                key={pdf.id}
                className={`flex items-center space-x-3 p-2 rounded-md cursor-pointer transition-colors ${
                  selectedPDF?.id === pdf.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => onPDFSelect(pdf)}
              >
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {pdf.original_name || pdf.file_name || pdf.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(pdf.created_at || pdf.uploadedAt)}
                  </p>
                </div>
              </div>
            ))}
            {pdfs.length > 3 && (
              <button
                onClick={onUploadPDF}
                className="w-full text-center py-2 text-sm text-blue-600 hover:text-blue-700"
              >
                View all {pdfs.length} PDFs
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Chat</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this chat? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

Sidebar.propTypes = {
  chats: PropTypes.array.isRequired,
  pdfs: PropTypes.array.isRequired,
  quizzes: PropTypes.array.isRequired,
  progress: PropTypes.object.isRequired,
  activeTab: PropTypes.string.isRequired,
  currentChatId: PropTypes.string,
  selectedPDF: PropTypes.object,
  onTabChange: PropTypes.func.isRequired,
  onChatSelect: PropTypes.func.isRequired,
  onNewChat: PropTypes.func.isRequired,
  onDeleteChat: PropTypes.func.isRequired,
  onPDFSelect: PropTypes.func.isRequired,
  onUploadPDF: PropTypes.func.isRequired
}

export default Sidebar