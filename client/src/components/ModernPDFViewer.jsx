import React, { useState, useCallback, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import PropTypes from 'prop-types'
import { useAuth } from '../context/AuthContext'
import { getApiUrl, API_ENDPOINTS } from '../utils/api'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

const PDFViewer = ({ file, onUnselect, className = "" }) => {
  const { session } = useAuth()
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [extractedText, setExtractedText] = useState('')
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false)

  // Fetch PDF with authentication and create blob URL
  const fetchPDFWithAuth = useCallback(async (fileUrl, fileId) => {
    if (!fileUrl || !session?.access_token) return null

    try {
      setLoading(true)
      const token = session.access_token
      
      const response = await fetch(fileUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/pdf'
        }
      })

      if (response.ok) {
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)
        setPdfBlobUrl(blobUrl)
        return blobUrl
      } else {
        throw new Error(`Failed to fetch PDF: ${response.status}`)
      }
    } catch (err) {
      console.error('PDF fetch error:', err)
      setError(`Failed to load PDF: ${err.message}`)
      return null
    } finally {
      setLoading(false)
    }
  }, [session])

  // Clean up blob URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl)
      }
    }
  }, [pdfBlobUrl])

  // Fetch PDF when file changes
  useEffect(() => {
    if (file && file.url && session?.access_token) {
      fetchPDFWithAuth(file.url, file.id)
    }
  }, [file, fetchPDFWithAuth, session])

  // Extract text when PDF loads
  const extractTextFromPDF = useCallback(async (fileId) => {
    if (!fileId || !session?.access_token) return

    try {
      setLoading(true)
      const response = await fetch(getApiUrl(API_ENDPOINTS.PDF_EXTRACT_TEXT), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ fileId })
      })

      if (response.ok) {
        const data = await response.json()
        setExtractedText(data.text)
      }
    } catch (err) {
      console.error('Text extraction error:', err)
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (file && file.id) {
      extractTextFromPDF(file.id)
    }
  }, [file, extractTextFromPDF])

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages)
    setError('')
    setLoading(false)
  }, [])

  const onDocumentLoadError = useCallback((error) => {
    console.error('PDF load error:', error)
    setError('Failed to load PDF. Please try again.')
    setLoading(false)
  }, [])

  const goToPrevPage = useCallback(() => {
    setPageNumber(page => Math.max(1, page - 1))
  }, [])

  const goToNextPage = useCallback(() => {
    setPageNumber(page => Math.min(numPages || 1, page + 1))
  }, [numPages])

  const goToPage = useCallback((page) => {
    const pageNum = parseInt(page, 10)
    if (pageNum >= 1 && pageNum <= (numPages || 1)) {
      setPageNumber(pageNum)
    }
  }, [numPages])

  const zoomIn = useCallback(() => {
    setScale(scale => Math.min(3.0, scale + 0.25))
  }, [])

  const zoomOut = useCallback(() => {
    setScale(scale => Math.max(0.3, scale - 0.25))
  }, [])

  const resetZoom = useCallback(() => {
    setScale(1.0)
  }, [])

  const fitToWidth = useCallback(() => {
    setScale(1.2) // Approximation - in real app, calculate based on container width
  }, [])

  if (!file) {
    return (
      <div className={`h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 ${className}`}>
        <div className="text-center p-8">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl"></div>
            <div className="absolute inset-2 bg-white rounded-xl flex items-center justify-center shadow-inner">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5l7-7 7 7M9 20h6" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No PDF Selected</h3>
          <p className="text-gray-600 mb-4">Choose a PDF from your library to start viewing</p>
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Select a PDF to get started</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-full flex flex-col bg-white shadow-lg ${className}`}>
      {/* Enhanced Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* File Info */}
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate">
                  {file.name}
                </h3>
                <p className="text-xs text-gray-500">
                  {numPages ? `${numPages} pages` : 'Loading...'} 
                  {file.size && ` • ${(file.size / 1024 / 1024).toFixed(1)} MB`}
                </p>
              </div>
            </div>

            {/* Close Button */}
            {onUnselect && (
              <button
                onClick={onUnselect}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                title="Close PDF"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Enhanced Toolbar */}
        <div className={`bg-gray-50 border-t border-gray-100 transition-all duration-300 ${isToolbarCollapsed ? 'h-0 overflow-hidden' : 'px-4 py-3'}`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Navigation Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={goToPrevPage}
                disabled={pageNumber <= 1}
                className="p-2 rounded-lg text-gray-600 hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all duration-200"
                title="Previous page"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="flex items-center space-x-2 bg-white rounded-lg px-3 py-1.5 shadow-sm border border-gray-200">
                <input
                  type="number"
                  min={1}
                  max={numPages || 1}
                  value={pageNumber}
                  onChange={(e) => goToPage(e.target.value)}
                  className="w-12 text-sm text-center border-0 focus:outline-none focus:ring-0 bg-transparent"
                />
                <span className="text-sm text-gray-500">
                  / {numPages || '--'}
                </span>
              </div>
              
              <button
                onClick={goToNextPage}
                disabled={pageNumber >= (numPages || 1)}
                className="p-2 rounded-lg text-gray-600 hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all duration-200"
                title="Next page"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={zoomOut}
                className="p-2 rounded-lg text-gray-600 hover:bg-white hover:shadow-sm transition-all duration-200"
                title="Zoom out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>
              
              <div className="flex items-center space-x-2 bg-white rounded-lg px-3 py-1.5 shadow-sm border border-gray-200">
                <span className="text-sm text-gray-700 font-medium min-w-[3rem] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <div className="h-4 w-px bg-gray-300"></div>
                <button
                  onClick={resetZoom}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  title="Reset zoom"
                >
                  Reset
                </button>
                <button
                  onClick={fitToWidth}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  title="Fit to width"
                >
                  Fit
                </button>
              </div>
              
              <button
                onClick={zoomIn}
                className="p-2 rounded-lg text-gray-600 hover:bg-white hover:shadow-sm transition-all duration-200"
                title="Zoom in"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Toolbar Toggle */}
        <button
          onClick={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
          className="w-full h-2 bg-gray-50 hover:bg-gray-100 transition-colors duration-200 group"
          title={isToolbarCollapsed ? "Show controls" : "Hide controls"}
        >
          <div className="w-8 h-1 bg-gray-300 group-hover:bg-gray-400 rounded mx-auto transition-colors duration-200"></div>
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex-shrink-0 bg-red-50 border-l-4 border-red-400 p-4 m-4 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading PDF</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && !pdfBlobUrl && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading PDF</h3>
            <p className="text-gray-600">Please wait while we prepare your document...</p>
          </div>
        </div>
      )}

      {/* PDF Display */}
      {!loading && pdfBlobUrl && (
        <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100 p-4">
          <div className="flex justify-center">
            <div className="shadow-2xl rounded-lg overflow-hidden bg-white">
              <Document
                file={pdfBlobUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="text-center py-16 px-8">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                      <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-gray-600 font-medium">Loading document...</p>
                  </div>
                }
                error={
                  <div className="text-center py-16 px-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-red-800 mb-2">Failed to load PDF</h3>
                    <p className="text-red-600">Please check the file and try again</p>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  className="transition-all duration-300"
                  loading={
                    <div className="text-center py-12">
                      <div className="animate-pulse bg-gray-200 h-96 w-64 mx-auto rounded-lg mb-4"></div>
                      <p className="text-gray-500 font-medium">Loading page {pageNumber}...</p>
                    </div>
                  }
                  error={
                    <div className="text-center py-12">
                      <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <p className="text-red-600 font-medium">Error loading page {pageNumber}</p>
                    </div>
                  }
                />
              </Document>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Status Bar */}
      <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-4 py-2">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center space-x-4 text-gray-600">
            <span className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Ready</span>
            </span>
            {extractedText && (
              <span>{extractedText.length.toLocaleString()} characters extracted</span>
            )}
          </div>
          <div className="flex items-center space-x-2 text-gray-500">
            <span>Page {pageNumber} of {numPages || 0}</span>
            <span>•</span>
            <span>{Math.round(scale * 100)}% zoom</span>
          </div>
        </div>
      </div>
    </div>
  )
}

PDFViewer.propTypes = {
  file: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    url: PropTypes.string,
    size: PropTypes.number
  }),
  onUnselect: PropTypes.func,
  className: PropTypes.string
}

export default PDFViewer