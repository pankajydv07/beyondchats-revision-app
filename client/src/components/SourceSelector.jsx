import React, { useState, useCallback, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useAuth } from '../context/AuthContext'
import PDFProcessingProgress from './PDFProcessingProgress'

const SourceSelector = ({ onFileSelect }) => {
  const { user, session } = useAuth()
  const [uploadedPDFs, setUploadedPDFs] = useState([])
  const [selectedSource, setSelectedSource] = useState('upload') // 'upload' | 'existing'
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState('')
  const [error, setError] = useState('')
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [currentUpload, setCurrentUpload] = useState(null)
  const [processingInProgress, setProcessingInProgress] = useState(false)

  // Load uploaded PDFs from server
  const loadUploadedPDFs = useCallback(async () => {
    if (!user?.id || !session?.access_token) return

    try {
      setLoading(true)
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/pdfs?userId=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setUploadedPDFs(data.pdfs || [])
      } else {
        // Fallback for development
        setUploadedPDFs([])
      }
    } catch (err) {
      console.error('Error loading PDFs:', err)
      setUploadedPDFs([])
    } finally {
      setLoading(false)
    }
  }, [user?.id, session?.access_token])

  useEffect(() => {
    loadUploadedPDFs()
  }, [loadUploadedPDFs])

  const handleFileUpload = useCallback(async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setError('Please select a PDF file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    if (!user?.id || !session?.access_token) {
      setError('Please log in to upload files')
      return
    }

    setLoading(true)
    setError('')
    setUploadProgress(0)
    setProcessingStatus('Uploading...')

    try {
      const formData = new FormData()
      formData.append('pdf', file)
      formData.append('userId', user.id)

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/upload-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result = await response.json()
      setUploadProgress(100)
      setProcessingStatus('Processing PDF...')
      
      // Create file object with URL for PDF viewer
      const fileWithUrl = {
        ...file,
        id: result.fileId,
        url: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString(),
        status: result.status
      }

      // Set current upload info for progress modal
      setCurrentUpload({
        fileId: result.fileId,
        fileName: file.name,
        fileObject: fileWithUrl
      })

      // Show progress modal
      setShowProgressModal(true)
      setProcessingInProgress(true)
      
      // Don't select the file immediately - wait for processing to complete
      // onFileSelect(fileWithUrl) - moved to handleProcessingComplete

    } catch (err) {
      console.error('Upload error:', err)
      setError(err.message || 'Failed to upload PDF. Please try again.')
      setUploadProgress(0)
      setProcessingStatus('')
    } finally {
      setLoading(false)
    }
  }, [onFileSelect, user?.id, session?.access_token])

  const handleProcessingComplete = useCallback((statusInfo) => {
    console.log('PDF processing completed:', statusInfo)
    
    // Now select the file since processing is complete
    if (currentUpload?.fileObject) {
      const updatedFileObject = {
        ...currentUpload.fileObject,
        status: 'completed',
        isReady: true,
        chunkCount: statusInfo.chunkCount
      }
      onFileSelect(updatedFileObject)
    }
    
    // Mark processing as complete
    setProcessingInProgress(false)
    
    // Refresh the PDFs list
    loadUploadedPDFs()
    // Keep the modal open until user closes it
  }, [loadUploadedPDFs, currentUpload, onFileSelect])

  const handleProgressModalClose = useCallback(() => {
    // Only allow closing if processing is complete
    if (!processingInProgress) {
      setShowProgressModal(false)
      setCurrentUpload(null)
      setProcessingStatus('')
      setUploadProgress(0)
    }
  }, [processingInProgress])

  const handleFileChange = useCallback((event) => {
    const file = event.target.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  const handleDrop = useCallback((event) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  const handleDragOver = useCallback((event) => {
    event.preventDefault()
  }, [])

  const handleExistingPDFSelect = useCallback((pdf) => {
    // Create a mock file object for existing PDFs with proper URL
    const fileObject = {
      id: pdf.id,
      name: pdf.original_name || pdf.file_name,
      url: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/pdf/${pdf.id}`,
      uploadedAt: pdf.created_at,
      size: pdf.file_size,
      totalPages: pdf.total_pages,
      status: pdf.processing_status
    }
    onFileSelect(fileObject)
  }, [onFileSelect])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Select PDF Source
        </h2>
        
        {/* Source Selection Dropdown */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Choose source:
          </label>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="upload">Upload New PDF</option>
            <option value="existing">Select from Uploaded PDFs</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {selectedSource === 'upload' ? (
        /* Upload Section */
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            loading 
              ? 'border-gray-200 bg-gray-50' 
              : 'border-gray-300 hover:border-blue-400 bg-white'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              {loading ? (
                <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              ) : (
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
            </div>
            
            <div>
              <p className="text-lg text-gray-600 mb-2">
                {loading ? 'Uploading...' : 'Drag and drop your PDF here, or click to browse'}
              </p>
              <p className="text-sm text-gray-500">
                Supports PDF files up to 10MB
              </p>
            </div>
            
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              id="pdf-upload"
              disabled={loading}
            />
            <label
              htmlFor="pdf-upload"
              className={`inline-block px-6 py-3 rounded-lg cursor-pointer transition-colors ${
                loading
                  ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? 'Uploading...' : 'Select PDF File'}
            </label>

            {/* Progress indicators */}
            {loading && uploadProgress > 0 && (
              <div className="mt-4 w-full max-w-md mx-auto">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Upload Progress</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {processingStatus && (
              <div className="mt-3 text-center">
                <p className="text-sm text-blue-600 font-medium">{processingStatus}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Existing PDFs Section */
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Previously Uploaded PDFs
            </h3>
          </div>
          
          <div className="p-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-500">Loading PDFs...</p>
              </div>
            ) : uploadedPDFs.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M34 40h10v-4a6 6 0 00-10.712-3.714M34 40H14m20 0v-4a9.971 9.971 0 00-.712-3.714M14 40H4v-4a6 6 0 0110.712-3.714M14 40v-4a9.971 9.971 0 01.712-3.714m0 0A9.971 9.971 0 0118 32a9.971 9.971 0 013.288.712M30 20a6 6 0 11-12 0 6 6 0 0112 0zm6 16a6 6 0 11-12 0 6 6 0 0112 0z" />
                </svg>
                <p className="text-gray-500">No PDFs uploaded yet</p>
                <button
                  onClick={() => setSelectedSource('upload')}
                  className="mt-2 text-blue-600 hover:text-blue-700"
                >
                  Upload your first PDF
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {uploadedPDFs.map((pdf) => (
                  <div
                    key={pdf.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleExistingPDFSelect(pdf)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="h-8 w-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {pdf.original_name || pdf.file_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Uploaded: {new Date(pdf.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PDF Processing Progress Modal */}
      {showProgressModal && currentUpload && (
        <PDFProcessingProgress
          fileId={currentUpload.fileId}
          fileName={currentUpload.fileName}
          onComplete={handleProcessingComplete}
          onClose={handleProgressModalClose}
        />
      )}
    </div>
  )
}

SourceSelector.propTypes = {
  onFileSelect: PropTypes.func.isRequired
}

export default SourceSelector