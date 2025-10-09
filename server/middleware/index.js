// Middleware configuration
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { config, paths } from '../config/index.js'
import fs from 'fs'
import { requireAuth, optionalAuth } from './auth.js'

// Ensure uploads directory exists
if (!fs.existsSync(config.uploadsDir)) {
  fs.mkdirSync(config.uploadsDir, { recursive: true })
}

// CORS configuration
const corsOptions = {
  origin: config.nodeEnv === 'production' 
    ? ['https://beyondchats-revision-app.vercel.app'] // Remove trailing slash
    : ['http://localhost:3000', 'http://localhost:5173'], // Common dev ports
  credentials: true
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + file.originalname
    cb(null, uniqueSuffix)
  }
})

export const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Only PDF files are allowed'), false)
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
})

// Export auth middleware
export { requireAuth, optionalAuth }

/**
 * Configure Express middlewares
 */
export function configureMiddleware(app) {
  // Basic middleware
  app.use(cors(corsOptions))
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))
  
  // Export authentication middleware
  app.set('requireAuth', requireAuth)
  app.set('optionalAuth', optionalAuth)
  
  // Static file serving for uploads
  app.use('/uploads', express.static(config.uploadsDir))
  
  // Request logging in development
  if (config.nodeEnv === 'development') {
    app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
      next()
    })
  }
  
  // Error handling for multer
  app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' })
      }
    }
    next(error)
  })
}