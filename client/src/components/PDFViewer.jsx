import React, { useState, useCallback, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import PropTypes from 'prop-types'
import { useAuth } from '../context/AuthContext'
import { getApiUrl, API_ENDPOINTS } from '../utils/api'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

const PDFViewer = ({ file }) => {
  const { session } = useAuth()
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [extractedText, setExtractedText] = useState('')
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)

  // Fetch PDF with authentication and create blob URL
  const fetchPDFWithAuth = useCallback(async (fileUrl, fileId) => {
    if (!fileUrl || !session?.access_token) return null

    try {
      // Use Supabase session access token
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
  }, [])

  const onDocumentLoadError = useCallback((error) => {
    console.error('PDF load error:', error)
    setError('Failed to load PDF. Please try again.')
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
    setScale(scale => Math.min(3.0, scale + 0.2))
  }, [])

  const zoomOut = useCallback(() => {
    setScale(scale => Math.max(0.3, scale - 0.2))
  }, [])

  const resetZoom = useCallback(() => {
    setScale(1.0)
  }, [])

  const fitToWidth = useCallback(() => {
    setScale(1.2) // Approximation - in real app, calculate based on container width
  }, [])

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5l7-7 7 7M9 20h6" />
          </svg>
          <p className="text-gray-500 text-lg">No PDF selected</p>
          <p className="text-gray-400 text-sm">Select a PDF to start viewing</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Navigation Controls */}
          <div className="flex items-center space-x-3">
            <button
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title="Previous page"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min={1}
                max={numPages || 1}
                value={pageNumber}
                onChange={(e) => goToPage(e.target.value)}
                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">
                of {numPages || '--'}
              </span>
            </div>
            
            <button
              onClick={goToNextPage}
              disabled={pageNumber >= (numPages || 1)}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title="Next page"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={zoomOut}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-200"
              title="Zoom out"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 min-w-[3rem]">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={resetZoom}
                className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded text-gray-700"
                title="Reset zoom"
              >
                Reset
              </button>
              <button
                onClick={fitToWidth}
                className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded text-gray-700"
                title="Fit to width"
              >
                Fit
              </button>
            </div>
            
            <button
              onClick={zoomIn}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-200"
              title="Zoom in"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
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

      {/* PDF Display */}
      <div className="flex-1 overflow-auto bg-gray-100">
        <div className="flex justify-center p-4">
          <Document
            file={pdfBlobUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="text-center py-12">
                <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Loading PDF...</p>
              </div>
            }
            error={
              <div className="text-center py-12">
                <svg className="mx-auto h-16 w-16 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-600 text-lg font-medium">Failed to load PDF</p>
                <p className="text-gray-500 text-sm mt-2">Please check the file and try again</p>
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              className="shadow-lg border border-gray-200"
              loading={
                <div className="text-center py-8">
                  <div className="animate-pulse bg-gray-200 h-96 w-64 mx-auto rounded"></div>
                  <p className="text-gray-500 mt-4">Loading page...</p>
                </div>
              }
              error={
                <div className="text-center py-8">
                  <p className="text-red-600">Error loading page</p>
                </div>
              }
            />
          </Document>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 text-xs text-gray-500">
        <div className="flex justify-between items-center">
          <span>
            {file.name} 
            {file.size && ` • ${Math.round(file.size / 1024)} KB`}
          </span>
          <span>
            {loading && 'Extracting text...'}
            {extractedText && `${extractedText.length} characters extracted`}
          </span>
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
  })
}

export default PDFViewer