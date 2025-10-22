import React, { useState, useEffect, useCallback, useRef } from 'react'
import ModernSidebar from '../components/ModernSidebar'
import ModernChatWindow from '../components/ModernChatWindow'
import ModernPDFViewer from '../components/ModernPDFViewer'
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
  return words.length > 30 ? words.substring(0, 30) + '...' : words
}

function ModernChatPage() {
  // State management
  const { user, session } = useAuth()
  const [storedData, setStoredData] = useState(getStoredData())
  const [currentChatId, setCurrentChatId] = useState(null)
  const [selectedPDF, setSelectedPDF] = useState(null)
  const [activeTab, setActiveTab] = useState('chats')
  const [isTyping, setIsTyping] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  
  // Loading states to prevent infinite loops
  const [loadingChats, setLoadingChats] = useState(false)
  const [loadingPDFs, setLoadingPDFs] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState({})
  
  // Mobile responsive states
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState(false)
  const [viewMode, setViewMode] = useState('chat') // 'chat', 'pdf', 'both'
  
  // Desktop sidebar toggle state - hidden by default
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(() => {
    // Clear old value and start fresh
    localStorage.removeItem('desktopSidebarOpen')
    return false
  })
  
  // Save desktop sidebar state
  useEffect(() => {
    localStorage.setItem('desktopSidebarOpen', JSON.stringify(isDesktopSidebarOpen))
    console.log('Desktop sidebar state:', isDesktopSidebarOpen)
  }, [isDesktopSidebarOpen])
  
  // Track if initial data has been loaded to prevent localStorage overwrites
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false)
  
  // Ref to access current storedData without triggering dependency loops
  const storedDataRef = useRef(storedData)
  
  // Update ref when storedData changes
  useEffect(() => {
    storedDataRef.current = storedData
  }, [storedData])

  // Auto-save stored data when it changes (but only after initial load)
  useEffect(() => {
    if (isInitialDataLoaded) {
      saveStoredData(storedData)
    }
  }, [storedData, isInitialDataLoaded])

  // Load chats from database
  const loadChats = useCallback(async () => {
    if (!user?.id || !session?.access_token || loadingChats) return

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
        
        setStoredData(prev => ({
          ...prev,
          chats: chatsFromDB.map(chat => ({
            id: chat.id,
            title: chat.title || 'New Chat',
            messages: [], // Messages will be loaded separately when chat is selected
            pdfId: chat.pdf_id,
            createdAt: chat.created_at,
            lastUpdated: chat.updated_at
          }))
        }))
      }
    } catch (error) {
      console.error('Error loading chats:', error)
    } finally {
      setLoadingChats(false)
    }
  }, [user?.id, session?.access_token, loadingChats])

  // Load PDFs from database
  const loadPDFs = useCallback(async () => {
    if (!user?.id || !session?.access_token || loadingPDFs) return

    setLoadingPDFs(true)
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
        
        const formattedPDFs = pdfsFromDB.map(pdf => ({
          id: pdf.id,
          name: pdf.original_name || pdf.file_name,
          url: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/pdf/${pdf.id}`,
          size: pdf.file_size,
          uploadedAt: pdf.created_at,
          original_name: pdf.original_name,
          file_name: pdf.file_name,
          created_at: pdf.created_at
        }))
        
        setStoredData(prev => ({
          ...prev,
          pdfs: formattedPDFs
        }))
      }
    } catch (error) {
      console.error('Error loading PDFs:', error)
    } finally {
      setLoadingPDFs(false)
    }
  }, [user?.id, session?.access_token, loadingPDFs])

  // Load chat messages for a specific chat
  const loadChatMessages = useCallback(async (chatId) => {
    if (!user?.id || !session?.access_token || loadingMessages[chatId]) return []

    setLoadingMessages(prev => ({ ...prev, [chatId]: true }))
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/chat/${chatId}/messages?userId=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const messages = data.messages || []
        
        // Normalize message format to ensure consistency
        return messages.map(msg => ({
          id: msg.id || `msg_${Date.now()}_${Math.random()}`,
          role: msg.role || (msg.is_user ? 'user' : 'assistant'),
          content: msg.content || msg.message || '',
          timestamp: msg.timestamp || msg.created_at || new Date().toISOString(),
          citations: msg.citations || []
        }))
      }
    } catch (error) {
      console.error('Error loading chat messages:', error)
    } finally {
      setLoadingMessages(prev => ({ ...prev, [chatId]: false }))
    }
    return []
  }, [user?.id, session?.access_token, loadingMessages])

  // Load data on component mount
  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([loadChats(), loadPDFs()])
      setIsInitialDataLoaded(true)
    }
    
    if (user?.id && session?.access_token) {
      loadInitialData()
    }
  }, [user?.id, session?.access_token])

  // Chat management functions
  const createNewChat = useCallback(() => {
    const newChatId = generateSecureUUID()
    const newChat = {
      id: newChatId,
      title: 'New Chat',
      messages: [],
      pdfId: selectedPDF?.id || null,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    }

    setStoredData(prev => ({
      ...prev,
      chats: [newChat, ...prev.chats]
    }))

    setCurrentChatId(newChatId)
    setActiveTab('chats')
    setIsSidebarOpen(false) // Close sidebar on mobile after creating chat
  }, [selectedPDF])

  const selectChat = useCallback(async (chatId) => {
    setCurrentChatId(chatId)
    setActiveTab('chats')
    setIsSidebarOpen(false) // Close sidebar on mobile after selecting chat
    
    // Load messages for this chat if not already loading and not loaded
    if (!loadingMessages[chatId]) {
      const currentChat = storedDataRef.current.chats.find(c => c.id === chatId)
      if (currentChat && (!currentChat.messages || currentChat.messages.length === 0)) {
        const messages = await loadChatMessages(chatId)
        if (messages.length > 0) {
          setStoredData(prev => ({
            ...prev,
            chats: prev.chats.map(c => 
              c.id === chatId ? { ...c, messages } : c
            )
          }))
        }
      }
    }
  }, [loadChatMessages, loadingMessages])

  const deleteChat = useCallback(async (chatId) => {
    try {
      // Delete from database
      if (user?.id && session?.access_token) {
        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/chat/${chatId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        })
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

  // PDF management functions
  const selectPDF = useCallback((pdf) => {
    setSelectedPDF(pdf)
    setActiveTab('files')
    setIsPDFViewerOpen(true)
    setViewMode('both')
  }, [])

  const unselectPDF = useCallback(() => {
    setSelectedPDF(null)
    setIsPDFViewerOpen(false)
    setViewMode('chat')
  }, [])

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
      setIsPDFViewerOpen(false)
      setViewMode('chat')
    }

    return true
  }, [user?.id, session?.access_token, selectedPDF])

  // Message handling
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
        lastUpdated: new Date().toISOString(),
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
      // Use ref to get current data to avoid stale closure
      currentChat = storedDataRef.current.chats.find(chat => chat.id === chatId)
    }
    
    if (!currentChat) return

    // Add user message with unique ID to prevent duplicates
    const userMessage = {
      id: `msg_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    }

    const updatedMessages = [...(currentChat.messages || []), userMessage]
    
    // Update chat title if this is the first message
    const chatTitle = (currentChat.messages || []).length === 0 
      ? generateChatTitle(message)
      : currentChat.title

    const updatedChat = {
      ...currentChat,
      messages: updatedMessages,
      title: chatTitle,
      lastUpdated: new Date().toISOString()
    }

    setStoredData(prev => ({
      ...prev,
      chats: prev.chats.map(chat => chat.id === chatId ? updatedChat : chat)
    }))

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
        console.error('Failed to save user message to database')
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
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Chat API response data:', data)

      // Add AI response with unique ID
      const aiMessage = {
        id: `msg_ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: data.answer || 'I apologize, but I couldn\'t process your message.',
        timestamp: new Date().toISOString(),
        citations: data.citations || []
      }

      const finalMessages = [...updatedMessages, aiMessage]
      const finalChat = {
        ...updatedChat,
        messages: finalMessages,
        lastUpdated: new Date().toISOString()
      }

      setStoredData(prev => ({
        ...prev,
        chats: prev.chats.map(chat => chat.id === chatId ? finalChat : chat)
      }))

      // Save AI response to database
      try {
        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/save-chat`, {
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
      } catch (error) {
        console.error('Error saving AI message:', error)
      }

    } catch (error) {
      console.error('Error sending message:', error)
      
      // Add error message with unique ID
      const errorMessage = {
        id: `msg_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true
      }

      const finalMessages = [...updatedMessages, errorMessage]
      const finalChat = {
        ...updatedChat,
        messages: finalMessages,
        lastUpdated: new Date().toISOString()
      }

      setStoredData(prev => ({
        ...prev,
        chats: prev.chats.map(chat => chat.id === chatId ? finalChat : chat)
      }))
    } finally {
      // Clear typing indicator
      setIsTyping(false)
    }
  }, [currentChatId, storedData.chats, selectedPDF, session, user])

  // Quiz handling
  const handleQuizSubmit = useCallback(async (results) => {
    console.log('🎯 handleQuizSubmit called with results:', results)
    console.log('🎯 User:', user)
    console.log('🎯 Selected PDF:', selectedPDF)
    console.log('🎯 Session:', session)
    
    try {
      // Extract the quiz data from the most recent message
      const lastMessage = storedData.chats.find(chat => chat.id === currentChatId)?.messages?.slice(-1)[0]
      const quizData = lastMessage?.quiz || {}
      
      console.log('🎯 Quiz data from last message:', quizData)
      
      // Calculate totals
      const totalQuestions = (quizData.mcq?.length || 0) + (quizData.shortAnswer?.length || 0) + (quizData.longAnswer?.length || 0)
      const totalCorrect = (results.mcq?.filter(r => r.isCorrect).length || 0) + 
                           (results.shortAnswer?.filter(r => (r.score || 0) >= 7).length || 0) + 
                           (results.longAnswer?.filter(r => (r.score || 0) >= 7).length || 0)
      
      // Prepare the data in the format expected by the backend
      const attemptData = {
        user_id: user?.id,
        pdf_id: selectedPDF?.id,
        topic: `Quiz on ${selectedPDF?.file_name || 'PDF'}`,
        questions: quizData,
        answers: {
          mcq: results.mcq || [],
          shortAnswer: results.shortAnswer || [],
          longAnswer: results.longAnswer || []
        },
        score: (results.overallScore || 0) / 100, // Convert percentage to decimal
        total_questions: totalQuestions,
        correct_answers: totalCorrect,
        time_taken: null,
        feedback: results.feedback
      }
      
      console.log('🎯 Prepared attempt data:', attemptData)

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/save-attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify(attemptData)
      })

      console.log('🎯 Response status:', response.status)
      console.log('🎯 Response headers:', response.headers)

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Quiz attempt saved successfully:', data)
        // You could show a success message here
      } else {
        const errorData = await response.json()
        console.error('❌ Failed to save quiz attempt:', errorData)
        console.error('❌ Response status:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('💥 Error saving quiz attempt:', error)
    }
  }, [selectedPDF, user, session, storedData.chats, currentChatId])

  // File upload handling
  const handleFileSelect = useCallback(async (pdfData) => {
    setStoredData(prev => ({
      ...prev,
      pdfs: [pdfData, ...prev.pdfs.filter(pdf => pdf.id !== pdfData.id)]
    }))

    setSelectedPDF(pdfData)
    setShowUploadModal(false)
    setActiveTab('files')
    
    setTimeout(() => {
      loadPDFs()
    }, 1000)
  }, [loadPDFs])

  // Get current chat with safe message handling
  const currentChat = currentChatId 
    ? storedData.chats.find(chat => chat.id === currentChatId)
    : null

  // Ensure messages always have the required structure and are deduplicated
  const currentMessages = currentChat ? (currentChat.messages || [])
    .map(msg => ({
      id: msg.id || `msg_${Date.now()}_${Math.random()}`,
      role: msg.role || (msg.is_user ? 'user' : 'assistant'),
      content: msg.content || msg.message || '',
      timestamp: msg.timestamp || msg.created_at || new Date().toISOString(),
      citations: msg.citations || []
    }))
    .filter((msg, index, array) => {
      // Remove duplicate messages based on content and timestamp
      return array.findIndex(m => 
        m.content === msg.content && 
        m.role === msg.role && 
        Math.abs(new Date(m.timestamp) - new Date(msg.timestamp)) < 1000
      ) === index
    }) : []

  // Mobile layout handlers
  const handleMobileSidebarClose = () => {
    setIsSidebarOpen(false)
  }

  const handleMobilePDFClose = () => {
    setIsPDFViewerOpen(false)
    setViewMode('chat')
  }

  const toggleMobileView = (mode) => {
    setViewMode(mode)
    if (mode === 'pdf') {
      setIsPDFViewerOpen(true)
    }
  }

  return (
    <div className="flex h-full w-full bg-gray-50 overflow-hidden">
      {/* Mobile Header with Controls */}
      <div className="lg:hidden fixed top-16 left-0 right-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Sidebar Toggle */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            <span className="text-sm font-medium">Menu</span>
          </button>

          {/* View Toggle */}
          {selectedPDF && (
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => toggleMobileView('chat')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'chat' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => toggleMobileView('pdf')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'pdf' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                PDF
              </button>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm font-medium">Upload</span>
          </button>
        </div>
      </div>

      {/* Sidebar - Desktop: Collapsible, Mobile: Overlay */}
      <div className={`hidden lg:block lg:flex-shrink-0 transition-all duration-300 ${
        isDesktopSidebarOpen ? 'lg:w-80' : 'lg:w-0'
      } overflow-hidden`}>
        {isDesktopSidebarOpen && (
          <ModernSidebar
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
            isOpen={true}
            onClose={() => {}}
          />
        )}
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="lg:hidden">
          <ModernSidebar
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
            isOpen={isSidebarOpen}
            onClose={handleMobileSidebarClose}
          />
        </div>
      )}

      {/* Main Content Area - Responsive flex layout */}
      <div className="flex-1 flex min-w-0 overflow-hidden">
        {/* Chat Window - Always takes remaining space */}
        <div className={`flex-1 min-w-0 ${
          selectedPDF ? 'lg:flex' : 'flex'
        } ${
          viewMode === 'chat' || !selectedPDF ? 'flex' : 'hidden lg:flex'
        } flex-col`}>
          {/* Mobile top padding to account for mobile header */}
          <div className="pt-16 lg:pt-0 h-full flex flex-col">
            <ModernChatWindow
              messages={currentMessages}
              isTyping={isTyping}
              selectedPDF={selectedPDF}
              onSendMessage={sendMessage}
              onQuizSubmit={handleQuizSubmit}
              isSidebarOpen={isDesktopSidebarOpen}
              onToggleSidebar={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
            />
          </div>
        </div>

        {/* PDF Viewer - Desktop: Side panel (1/3 width), Mobile: Full screen overlay */}
        {selectedPDF && (
          <div className={`
            ${viewMode === 'pdf' ? 'flex' : 'hidden lg:flex'}
            ${viewMode === 'pdf' 
              ? 'fixed inset-0 z-40 bg-white' 
              : 'lg:w-96 lg:flex-shrink-0 lg:border-l lg:border-gray-200'
            }
          `}>
            {/* Mobile top padding for PDF viewer */}
            <div className={`${viewMode === 'pdf' ? 'pt-16' : ''} h-full w-full flex flex-col`}>
              <ModernPDFViewer 
                file={selectedPDF} 
                onUnselect={viewMode === 'pdf' ? handleMobilePDFClose : unselectPDF}
                className="h-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Upload PDF</h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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

export default ModernChatPage