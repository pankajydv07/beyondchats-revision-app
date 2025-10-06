import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SourceSelector from '../components/SourceSelector'

const Home = () => {
  const [selectedFile, setSelectedFile] = useState(null)
  const navigate = useNavigate()

  const handleFileUpload = (file) => {
    setSelectedFile(file)
    // Store file in localStorage for viewer page
    const fileURL = URL.createObjectURL(file)
    localStorage.setItem('uploadedPDF', fileURL)
    localStorage.setItem('uploadedPDFName', file.name)
    navigate('/viewer')
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-800">
          BeyondChats Revision App
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Upload your PDF and start learning with AI-powered chat and quizzes
        </p>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <SourceSelector onFileUpload={handleFileUpload} />
        </div>
      </div>
    </div>
  )
}

export default Home