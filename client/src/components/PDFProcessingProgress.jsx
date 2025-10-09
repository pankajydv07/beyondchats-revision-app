import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useAuth } from '../context/AuthContext'

const PDFProcessingProgress = ({ fileId, fileName, onComplete, onClose }) => {
  const { session } = useAuth()
  const [status, setStatus] = useState({
    processingStatus: 'processing',
    totalPages: 0,
    chunkCount: 0,
    isReady: false
  })
  const [error, setError] = useState('')
  const [elapsedTime, setElapsedTime] = useState(0)

  // Poll for status updates
  const checkStatus = useCallback(async () => {
    if (!fileId || !session?.access_token) return

    try {
      console.log('🔍 Checking PDF processing status for:', fileId)
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/pdf/${fileId}/status`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        console.log('📊 Processing status update:', data.status)
        setStatus(data.status)
        
        if (data.status.isReady) {
          console.log('✅ PDF processing completed!')
          onComplete?.(data.status)
        } else if (data.status.processingStatus === 'failed') {
          setError('PDF processing failed. Please try uploading again.')
        }
      } else {
        const errorData = await response.json()
        console.error('❌ Status check failed:', errorData)
        setError(errorData.error || 'Failed to check processing status')
      }
    } catch (err) {
      console.error('❌ Status check error:', err)
      setError('Unable to check processing status')
    }
  }, [fileId, session?.access_token, onComplete])

  // Start status polling
  useEffect(() => {
    if (!fileId) return

    // Check immediately
    checkStatus()

    // Set up polling interval
    const interval = setInterval(checkStatus, 2000) // Check every 2 seconds

    return () => clearInterval(interval)
  }, [fileId, checkStatus])

  // Track elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getProgressSteps = () => {
    const steps = [
      { 
        name: 'Upload', 
        status: 'completed',
        description: 'File uploaded successfully' 
      },
      { 
        name: 'Text Extraction', 
        status: status.processingStatus === 'processing' ? 'active' : 
                status.processingStatus === 'completed' ? 'completed' : 'pending',
        description: status.totalPages > 0 ? `Extracted text from ${status.totalPages} pages` : 'Extracting text from PDF...' 
      },
      { 
        name: 'Chunking & Embeddings', 
        status: status.chunkCount > 0 ? 'completed' : 
                status.processingStatus === 'processing' ? 'active' : 'pending',
        description: status.chunkCount > 0 ? `Created ${status.chunkCount} text chunks` : 'Creating searchable chunks...' 
      },
      { 
        name: 'Ready for Use', 
        status: status.isReady ? 'completed' : 'pending',
        description: status.isReady ? 'PDF ready for chat and quiz generation!' : 'Preparing for AI interactions...' 
      }
    ]
    return steps
  }

  const steps = getProgressSteps()
  const currentStep = steps.findIndex(step => step.status === 'active')
  const progressPercentage = status.isReady ? 100 : Math.max(25, (currentStep + 1) * 25)

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Processing Failed</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status.isReady) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Processing Complete!</h3>
            <p className="text-gray-600 mb-4">
              <strong>{fileName}</strong> is ready for chat and quiz generation.
            </p>
            <div className="text-sm text-gray-500 mb-6">
              Processed in {formatTime(elapsedTime)} • {status.chunkCount} chunks created
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Start Using PDF
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Processing PDF</h3>
          <p className="text-gray-600">
            <strong>{fileName}</strong>
          </p>
          <div className="text-sm text-gray-500 mt-2">
            Processing time: {formatTime(elapsedTime)}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
            <span>Progress</span>
            <span>{progressPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-in-out"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.name} className="flex items-start">
              <div className="flex-shrink-0 mr-3">
                {step.status === 'completed' && (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {step.status === 'active' && (
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  </div>
                )}
                {step.status === 'pending' && (
                  <div className="w-6 h-6 bg-gray-300 rounded-full"></div>
                )}
              </div>
              <div className="flex-1">
                <h4 className={`text-sm font-medium ${
                  step.status === 'completed' ? 'text-green-700' :
                  step.status === 'active' ? 'text-blue-700' : 'text-gray-500'
                }`}>
                  {step.name}
                </h4>
                <p className="text-xs text-gray-600 mt-1">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Cancel button */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors text-sm"
          >
            Continue in Background
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            ⚠️ PDF won't be available for chat/quiz until processing completes
          </p>
        </div>
      </div>
    </div>
  )
}

PDFProcessingProgress.propTypes = {
  fileId: PropTypes.string.isRequired,
  fileName: PropTypes.string.isRequired,
  onComplete: PropTypes.func,
  onClose: PropTypes.func.isRequired
}

export default PDFProcessingProgress