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
  
  // Sidebar toggle state with localStorage persistence
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    // Force reset to false for now
    localStorage.removeItem('sidebarOpen')
    return false
  })

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarOpen', JSON.stringify(isSidebarOpen))
    console.log('Sidebar state:', isSidebarOpen)
  }, [isSidebarOpen])

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

  // Load PDFs from database
  const loadPDFs = useCallback(async () => {
    if (!user?.id || !session?.access_token) return

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/pdfs?userId=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const pdfsFromDB = data.pdfs || []
        
        // Convert database format to local format
        const formattedPDFs = pdfsFromDB.map(pdf => ({
          id: pdf.id,
          name: pdf.original_name || pdf.file_name,
          url: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/pdf/${pdf.id}`,
          size: pdf.file_size,
          uploadedAt: pdf.created_at,
          totalPages: pdf.total_pages,
          status: pdf.processing_status
        }))

        // Merge with local PDFs (prioritizing database PDFs)
        setStoredData(prev => ({
          ...prev,
          pdfs: formattedPDFs
        }))
      }
    } catch (error) {
      console.error('Error loading PDFs:', error)
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

  // Load chat history and PDFs on component mount and when user changes
  useEffect(() => {
    loadChatHistory()
    loadPDFs()
  }, [loadChatHistory, loadPDFs])

  // Update localStorage whenever storedData changes
  useEffect(() => {
    saveStoredData(storedData)
  }, [storedData])

  // Note: Removed automatic PDF selection - users must explicitly select PDFs

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
    if (!message.trim()) return

    // Check authentication before sending message
    if (!user?.id || !session?.access_token) {
      console.error('Authentication required to send message')
      return
    }

    // If no chat is selected, automatically create a new one
    let chatId = currentChatId
    let currentChat = null
    
    if (!chatId) {
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
      chatId = newChatId
      currentChat = newChat
    } else {
      currentChat = storedData.chats.find(chat => chat.id === chatId)
    }
    
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

    updateChat(chatId, {
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
          chatId: chatId,
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
      console.log('Sending message to chat API:', {
        chatId: chatId,
        message: message,
        pdfId: selectedPDF?.id || null,
        userId: user?.id
      })

      // Call backend API
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          chatId: chatId,
          message: message,
          pdfId: selectedPDF?.id || null,
          userId: user?.id
        })
      })

      console.log('Chat API response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Chat API error response:', errorText)
        throw new Error(`Failed to get response: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('Chat API response data:', data)

      // Add AI response
      const aiMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: data.answer || 'I apologize, but I couldn\'t process your message.',
        timestamp: new Date().toISOString(),
        citations: data.citations || []
      }

      const finalMessages = [...updatedMessages, aiMessage]
      updateChat(chatId, { messages: finalMessages })

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
            chatId: chatId,
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
      updateChat(chatId, { messages: finalMessages })
    } finally {
      // Clear typing indicator
      setIsTyping(false)
    }
  }, [currentChatId, storedData.chats, selectedPDF, updateChat, session, user, setStoredData, setCurrentChatId, setActiveTab])

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
      // Calculate totals from the quiz results structure FIRST
      const totalMcq = results.mcq ? results.mcq.length : 0
      const totalShortAnswer = results.shortAnswer ? results.shortAnswer.length : 0
      const totalLongAnswer = results.longAnswer ? results.longAnswer.length : 0
      const totalQuestions = totalMcq + totalShortAnswer + totalLongAnswer
      
      // Calculate correct answers
      const correctMcq = results.mcq ? results.mcq.filter(q => q.isCorrect).length : 0
      const correctAnswers = correctMcq // For now, only count MCQ as definitive correct/incorrect
      
      console.log('Quiz results structure:', {
        topic: results.topic,
        questions: results.questions,
        selectedAnswers: results.selectedAnswers,
        score: results.score,
        total: results.total,
        correct: results.correct,
        timeSpent: results.timeSpent,
        feedback: results.feedback,
        overallScore: results.overallScore,
        totalQuestions: totalQuestions,
        allKeys: Object.keys(results)
      })
      
      console.log('Sending attempt data:', {
        topic: results.topic || 'Generated Quiz',
        score: (results.overallScore || 0) / 100,
        total_questions: totalQuestions,
        overallScore: results.overallScore
      })
      
      // Prepare quiz attempt data with correct field mapping
      const attemptData = {
        user_id: user.id,
        pdf_id: selectedPDF?.id || null,
        topic: results.topic || 'Generated Quiz',
        questions: JSON.stringify(results), // Store the full quiz results
        answers: JSON.stringify({
          mcq: results.mcq || [],
          shortAnswer: results.shortAnswer || [],
          longAnswer: results.longAnswer || []
        }),
        score: (results.overallScore || 0) / 100, // Convert percentage to 0-1 decimal for server
        total_questions: totalQuestions || 1, // Use total_questions as expected by server
        correct_answers: correctAnswers || 0,
        time_taken: results.timeSpent || 0,
        feedback: results.feedback || null
      }

      console.log('Full attempt data being sent:', attemptData)

      // Save quiz attempt to database
      console.log('About to save quiz attempt with data:', attemptData)
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/save-attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(attemptData)
      })

      console.log('Response status:', response.status, response.statusText)
      
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
              score: results.overallScore || 0,
              totalQuestions: totalQuestions,
              topic: results.topic || 'Generated Quiz',
              timeSpent: results.timeSpent || 0
            }]
          }
        }))
        
        // Trigger a refresh of dashboard data if user is on dashboard
        // This could be done through a context or event system
        console.log('Quiz attempt saved, dashboard should refresh')
      } else {
        const errorText = await response.text()
        console.error('Failed to save quiz attempt:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })
      }
    } catch (error) {
      console.error('Error saving quiz attempt:', error)
    }
  }, [user?.id, session?.access_token, selectedPDF?.id])

  const deleteChat = useCallback(async (chatId) => {
    try {
      // Delete from database first
      if (user?.id && session?.access_token) {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/chat/${chatId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          console.warn('Failed to delete chat from database')
        }
      }
    } catch (error) {
      console.error('Error deleting chat from database:', error)
    }

    // Remove from local state
    setStoredData(prev => ({
      ...prev,
      chats: prev.chats.filter(chat => chat.id !== chatId)
    }))

    if (currentChatId === chatId) {
      setCurrentChatId(null)
    }
  }, [currentChatId, user?.id, session?.access_token])

  const deletePDF = useCallback(async (pdfId) => {
    try {
      // Delete from database first
      if (user?.id && session?.access_token) {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/pdf/${pdfId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          console.warn('Failed to delete PDF from database')
          return false
        }
      }
    } catch (error) {
      console.error('Error deleting PDF from database:', error)
      return false
    }

    // Remove from local state
    setStoredData(prev => ({
      ...prev,
      pdfs: prev.pdfs.filter(pdf => pdf.id !== pdfId)
    }))

    // If this PDF was selected, unselect it
    if (selectedPDF?.id === pdfId) {
      setSelectedPDF(null)
    }

    return true
  }, [user?.id, session?.access_token, selectedPDF?.id])

  const handleFileSelect = useCallback((file) => {
    // Add to PDFs list
    const pdfData = {
      id: file.id || `pdf_${Date.now()}`,
      name: file.name,
      url: file.url,
      size: file.size,
      uploadedAt: file.uploadedAt || new Date().toISOString(), // Preserve original upload time
      // Keep additional metadata if available
      totalPages: file.totalPages,
      status: file.status
    }

    setStoredData(prev => ({
      ...prev,
      pdfs: [pdfData, ...prev.pdfs.filter(pdf => pdf.id !== pdfData.id)]
    }))

    // Automatically select the newly uploaded/selected PDF
    setSelectedPDF(pdfData)
    setShowUploadModal(false)
    
    // Refresh the PDFs list from the database after a short delay
    // to ensure the latest data is displayed
    setTimeout(() => {
      loadPDFs()
    }, 1000)
  }, [loadPDFs])

  const selectPDF = useCallback((pdf) => {
    setSelectedPDF(pdf)
  }, [])

  const unselectPDF = useCallback(() => {
    setSelectedPDF(null)
  }, [])

  const currentChat = currentChatId 
    ? storedData.chats.find(chat => chat.id === currentChatId)
    : null

  return (
    <div className="flex h-full bg-gray-50 relative">
      {/* Toggle Button - Always Visible - FORCED */}
      <button
        onClick={() => {
          console.log('Button clicked! Current state:', isSidebarOpen)
          setIsSidebarOpen(!isSidebarOpen)
        }}
        className={`fixed z-[100] bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-xl hover:shadow-2xl transition-all duration-300 group`}
        style={{
          top: '80px',
          left: isSidebarOpen ? '304px' : '16px',
          display: 'block',
          position: 'fixed'
        }}
        title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
      >
        {isSidebarOpen ? (
          <svg className="w-6 h-6 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        ) : (
          <svg className="w-6 h-6 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Left Sidebar - Collapsible */}
      <div 
        className={`bg-white border-r border-gray-200 flex-shrink-0 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'w-80 opacity-100' : 'w-0 opacity-0'
        } overflow-hidden`}
        style={{ minWidth: isSidebarOpen ? '320px' : '0' }}
      >
        {isSidebarOpen && (
          <Sidebar
            chats={storedData.chats}
            pdfs={storedData.pdfs}
            quizzes={storedData.quizzes}
            activeTab={activeTab}
            currentChatId={currentChatId}
            selectedPDF={selectedPDF}
            onTabChange={setActiveTab}
            onChatSelect={selectChat}
            onNewChat={createNewChat}
            onDeleteChat={deleteChat}
            onPDFSelect={selectPDF}
            onUploadPDF={() => setShowUploadModal(true)}
            onPDFDelete={deletePDF}
          />
        )}
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
            <PDFViewer file={selectedPDF} onUnselect={unselectPDF} />
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