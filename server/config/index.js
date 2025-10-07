// Configuration module for server setup
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const serverRoot = join(__dirname, '..')

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  uploadsDir: join(serverRoot, 'uploads'),
  
  // Nebius AI Configuration
  nebiusApiKey: process.env.NEBIUS_API_KEY,
  chatModel: process.env.CHAT_MODEL || "Qwen/Qwen3-235B-A22B-Thinking-2507",
  
  // Supabase Configuration
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET,
  
  // OAuth Configuration
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  siteUrl: process.env.SITE_URL || 'http://localhost:5173',
  
  // Vector Search Configuration
  topKChunks: parseInt(process.env.TOP_K_CHUNKS) || 5,
  maxContextLength: parseInt(process.env.MAX_CONTEXT_LENGTH) || 4000,
  
  // Embedding Configuration
  embedModel: process.env.EMBED_MODEL || 'Qwen/Qwen3-Embedding-8B',
  embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS) || 4096
}

export const paths = {
  __filename,
  __dirname,
  serverRoot,
  uploadsDir: config.uploadsDir
}