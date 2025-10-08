import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import ChatWindow from '../components/ChatWindow'
import PDFViewer from '../components/PDFViewer'
import SourceSelector from '../components/SourceSelector'
import { useAuth } from '../context/AuthContext'
import { generateSecureUUID } from '../utils/uuid'

// Chat storage utility functions
const STORAGE_KEY = 'beyondchats_data'

const getStoredData = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : { chats: [], pdfs: [], quizzes: [], progress: {} }
  } catch (error) {
    console.error('Error loading stored data:', error)
    return { chats: [], pdfs: [], quizzes: [], progress: {} }
  }
}

const saveStoredData = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Error saving data:', error)
  }
}

const generateChatTitle = (firstMessage) => {
  if (!firstMessage) return 'New Chat'
  const words = firstMessage.split(' ').slice(0, 6).join(' ')
  return words.length > 50 ? words.substring(0, 47) + '...' : words
}

function ChatPage() {
  const { user, session } = useAuth()
  const [storedData, setStoredData] = useState(getStoredData())
  const [currentChatId, setCurrentChatId] = useState(null)
  const [selectedPDF, setSelectedPDF] = useState(null)
  const [activeTab, setActiveTab] = useState('chats') // 'chats' | 'quizzes' | 'progress'
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [loadingChats, setLoadingChats] = useState(false)

  // Load chat history from database
  const loadChatHistory = useCallback(async () => {
    if (!user?.id || !session?.access_token) return

    setLoadingChats(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/chats?userId=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const chatsFromDB = data.chats || []
        
        // Convert database format to local format
        const formattedChats = chatsFromDB.map(chat => ({
          id: chat.id,
          title: chat.title || 'New Chat',
          messages: [], // Will be loaded when chat is selected
          createdAt: chat.created_at,
          updatedAt: chat.updated_at,
          pdfId: chat.pdf_id || null,
          lastMessage: chat.lastMessage
        }))

        // Merge with local chats (prioritizing database chats)
        setStoredData(prev => ({
          ...prev,
          chats: formattedChats
        }))
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
    } finally {
      setLoadingChats(false)
    }
  }, [user?.id, session?.access_token])

  // Load chat messages for a specific chat
  const loadChatMessages = useCallback(async (chatId) => {
    if (!user?.id || !session?.access_token) return []

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/chat/${chatId}/messages?userId=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const messagesFromDB = data.messages || []
        
        // Convert database format to local format
        return messagesFromDB.map(msg => ({
          id: msg.id,
          role: msg.is_user ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.timestamp
        }))
      }
    } catch (error) {
      console.error('Error loading chat messages:', error)
    }
    return []
  }, [user?.id, session?.access_token])

  // Load chat history on component mount and when user changes
  useEffect(() => {
    loadChatHistory()
  }, [loadChatHistory])

  // Update localStorage whenever storedData changes
  useEffect(() => {
    saveStoredData(storedData)
  }, [storedData])

  // Load initial PDF if available
  useEffect(() => {
    if (storedData.pdfs.length > 0 && !selectedPDF) {
      setSelectedPDF(storedData.pdfs[0])
    }
  }, [storedData.pdfs, selectedPDF])

  const createNewChat = useCallback(() => {
    const newChatId = generateSecureUUID()
    const newChat = {
      id: newChatId,
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pdfId: selectedPDF?.id || null
    }

    setStoredData(prev => ({
      ...prev,
      chats: [newChat, ...prev.chats]
    }))

    setCurrentChatId(newChatId)
    setActiveTab('chats')
  }, [selectedPDF])

  const updateChat = useCallback((chatId, updates) => {
    setStoredData(prev => ({
      ...prev,
      chats: prev.chats.map(chat =>
        chat.id === chatId
          ? {
              ...chat,
              ...updates,
              updatedAt: new Date().toISOString()
            }
          : chat
      )
    }))
  }, [])

  const sendMessage = useCallback(async (message) => {
    if (!currentChatId || !message.trim()) return

    const currentChat = storedData.chats.find(chat => chat.id === currentChatId)
    if (!currentChat) return

    // Add user message
    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    }

    const updatedMessages = [...currentChat.messages, userMessage]
    
    // Update chat title if this is the first message
    const chatTitle = currentChat.messages.length === 0 
      ? generateChatTitle(message)
      : currentChat.title

    updateChat(currentChatId, {
      messages: updatedMessages,
      title: chatTitle
    })

    // Save user message to database
    try {
      const saveResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/save-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          userId: user?.id,
          chatId: currentChatId,
          message: message,
          isUser: true
        })
      })

      if (!saveResponse.ok) {
        console.warn('Failed to save user message to database')
      }
    } catch (error) {
      console.error('Error saving user message:', error)
    }

    // Set typing indicator
    setIsTyping(true)

    try {
      // Call backend API
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          chatId: currentChatId,
          message: message,
          pdfId: selectedPDF?.id || null,
          userId: user?.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      // Add AI response
      const aiMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: data.answer || 'I apologize, but I couldn\'t process your message.',
        timestamp: new Date().toISOString(),
        citations: data.citations || []
      }

      const finalMessages = [...updatedMessages, aiMessage]
      updateChat(currentChatId, { messages: finalMessages })

      // Save AI response to database
      try {
        const saveAiResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/save-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            userId: user?.id,
            chatId: currentChatId,
            message: aiMessage.content,
            isUser: false
          })
        })

        if (!saveAiResponse.ok) {
          console.warn('Failed to save AI response to database')
        }
      } catch (error) {
        console.error('Error saving AI response:', error)
      }

    } catch (error) {
      console.error('Error sending message:', error)
      
      // Add error message
      const errorMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true
      }

      const finalMessages = [...updatedMessages, errorMessage]
      updateChat(currentChatId, { messages: finalMessages })
    } finally {
      // Clear typing indicator
      setIsTyping(false)
    }
  }, [currentChatId, storedData.chats, selectedPDF, updateChat, session, user])

  const selectChat = useCallback(async (chatId) => {
    setCurrentChatId(chatId)
    setActiveTab('chats')
    
    // Load messages for this chat if they're not already loaded
    const chat = storedData.chats.find(c => c.id === chatId)
    if (chat && (!chat.messages || chat.messages.length === 0)) {
      const messages = await loadChatMessages(chatId)
      updateChat(chatId, { messages })
    }
  }, [storedData.chats, loadChatMessages, updateChat])

  const handleQuizSubmit = useCallback(async (results) => {
    console.log('Quiz results submitted:', results)
    
    if (!user?.id || !session?.access_token) {
      console.error('User not authenticated')
      return
    }

    try {
      // Prepare quiz attempt data
      const attemptData = {
        user_id: user.id,
        pdf_id: selectedPDF?.id || null,
        topic: results.topic || 'Generated Quiz',
        questions: results.questions || [],
        answers: results.selectedAnswers || [],
        score: results.score / 100, // Convert percentage to decimal
        total_questions: results.total || 0,
        correct_answers: results.correct || 0,
        time_taken: results.timeSpent || 0,
        feedback: results.feedback || null
      }

      // Save quiz attempt to database
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/attempts/save-attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(attemptData)
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Quiz attempt saved successfully:', data)
        
        // Store quiz result in progress for local tracking
        setStoredData(prev => ({
          ...prev,
          progress: {
            ...prev.progress,
            quizzes: [...(prev.progress.quizzes || []), {
              id: data.attempt.id,
              date: new Date().toISOString(),
              score: results.score,
              totalQuestions: results.total,
              topic: results.topic,
              timeSpent: results.timeSpent
            }]
          }
        }))
        
        // Trigger a refresh of dashboard data if user is on dashboard
        // This could be done through a context or event system
        console.log('Quiz attempt saved, dashboard should refresh')
      } else {
        console.error('Failed to save quiz attempt:', response.statusText)
      }
    } catch (error) {
      console.error('Error saving quiz attempt:', error)
    }
  }, [user?.id, session?.access_token, selectedPDF?.id])

  const deleteChat = useCallback((chatId) => {
    setStoredData(prev => ({
      ...prev,
      chats: prev.chats.filter(chat => chat.id !== chatId)
    }))

    if (currentChatId === chatId) {
      setCurrentChatId(null)
    }
  }, [currentChatId])

  const handleFileSelect = useCallback((file) => {
    // Add to PDFs list
    const pdfData = {
      id: file.id || `pdf_${Date.now()}`,
      name: file.name,
      url: file.url,
      size: file.size,
      uploadedAt: new Date().toISOString()
    }

    setStoredData(prev => ({
      ...prev,
      pdfs: [pdfData, ...prev.pdfs.filter(pdf => pdf.id !== pdfData.id)]
    }))

    setSelectedPDF(pdfData)
    setShowUploadModal(false)
  }, [])

  const selectPDF = useCallback((pdf) => {
    setSelectedPDF(pdf)
  }, [])

  const currentChat = currentChatId 
    ? storedData.chats.find(chat => chat.id === currentChatId)
    : null

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <Sidebar
          chats={storedData.chats}
          pdfs={storedData.pdfs}
          quizzes={storedData.quizzes}
          progress={storedData.progress}
          activeTab={activeTab}
          currentChatId={currentChatId}
          selectedPDF={selectedPDF}
          onTabChange={setActiveTab}
          onChatSelect={selectChat}
          onNewChat={createNewChat}
          onDeleteChat={deleteChat}
          onPDFSelect={selectPDF}
          onUploadPDF={() => setShowUploadModal(true)}
        />
      </div>

      {/* Center Chat Window */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatWindow
          messages={currentChat ? currentChat.messages : []}
          isTyping={isTyping}
          selectedPDF={selectedPDF}
          onSendMessage={sendMessage}
          onQuizSubmit={handleQuizSubmit}
        />
      </div>

      {/* Right PDF Viewer */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-sm">
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedPDF ? 'Course Material' : 'No PDF Selected'}
            </h3>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Upload PDF
            </button>
          </div>
          {selectedPDF && (
            <p className="text-sm text-gray-600 mt-1 truncate">
              {selectedPDF.name}
            </p>
          )}
        </div>
        
        <div className="flex-1">
          {selectedPDF ? (
            <PDFViewer file={selectedPDF} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5l7-7 7 7M9 20h6" />
                </svg>
                <p className="text-lg font-medium">No PDF loaded</p>
                <p className="text-sm text-gray-400 mt-1">Upload a PDF to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Upload PDF</h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <SourceSelector onFileSelect={handleFileSelect} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatPage