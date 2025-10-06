import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PDFViewer from '../components/PDFViewer'
import ChatSidebar from '../components/ChatSidebar'

const Viewer = () => {
  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfName, setPdfName] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const url = localStorage.getItem('uploadedPDF')
    const name = localStorage.getItem('uploadedPDFName')
    
    if (!url) {
      navigate('/')
      return
    }
    
    setPdfUrl(url)
    setPdfName(name || 'document.pdf')
  }, [navigate])

  if (!pdfUrl) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="h-screen flex">
      {/* PDF Viewer */}
      <div className="flex-1 bg-gray-100">
        <div className="bg-white shadow-sm p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">{pdfName}</h2>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Upload New PDF
            </button>
          </div>
        </div>
        <PDFViewer pdfUrl={pdfUrl} />
      </div>

      {/* Chat/Quiz Sidebar */}
      <div className="w-96 bg-white border-l">
        <ChatSidebar pdfUrl={pdfUrl} />
      </div>
    </div>
  )
}

export default Viewer