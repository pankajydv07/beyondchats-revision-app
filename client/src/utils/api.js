// API utility for centralized URL management
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

/**
 * Get the full API URL for a given endpoint
 * @param {string} endpoint - The API endpoint (should start with /)
 * @returns {string} The full API URL
 */
export const getApiUrl = (endpoint) => {
  // Ensure endpoint starts with /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${API_BASE_URL}${cleanEndpoint}`
}

/**
 * Common API endpoints
 */
export const API_ENDPOINTS = {
  // Authentication
  AUTH_PROFILE: '/api/auth/profile',
  AUTH_REGISTER_USER: '/api/auth/register-user',
  
  // Chat
  CHAT: '/api/chat',
  SAVE_CHAT: '/api/save-chat',
  CHATS: '/api/chats',
  CHAT_MESSAGES: '/api/chat/:chatId/messages',
  
  // PDFs
  PDFS: '/api/pdfs',
  PDF_UPLOAD: '/api/upload-pdf',
  PDF_FILE: '/api/pdf/:id',
  PDF_STATUS: '/api/pdf/:id/status',
  PDF_EXTRACT_TEXT: '/api/extract-text',
  
  // Quiz
  GENERATE_QUIZ: '/api/generate-quiz',
  ANALYZE_QUIZ: '/api/analyze-quiz',
  SAVE_ATTEMPT: '/api/save-attempt',
  ATTEMPTS: '/api/attempts',
  ATTEMPTS_SAVE: '/api/attempts/save-attempt',
  
  // RAG
  RAG_QUERY: '/api/rag-query',
  
  // Health
  HEALTH: '/api/health'
}

/**
 * Helper function to replace URL parameters
 * @param {string} endpoint - Endpoint with parameters like :id
 * @param {object} params - Object with parameter values
 * @returns {string} Endpoint with parameters replaced
 */
export const replaceUrlParams = (endpoint, params = {}) => {
  let result = endpoint
  Object.entries(params).forEach(([key, value]) => {
    result = result.replace(`:${key}`, value)
  })
  return result
}

/**
 * Get API URL with parameter replacement
 * @param {string} endpoint - The API endpoint
 * @param {object} params - Parameters to replace in the URL
 * @returns {string} The full API URL with parameters
 */
export const getApiUrlWithParams = (endpoint, params = {}) => {
  const endpointWithParams = replaceUrlParams(endpoint, params)
  return getApiUrl(endpointWithParams)
}

export default {
  getApiUrl,
  getApiUrlWithParams,
  API_ENDPOINTS,
  replaceUrlParams
}