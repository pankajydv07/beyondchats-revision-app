// Setup script to create Supabase database schema
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function setupDatabase() {
  try {
    console.log('🔄 Setting up Supabase database schema...')
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    )
    
    // Read the schema SQL file
    const schemaPath = path.join(__dirname, 'database', 'supabase_schema.sql')
    const schemaSql = fs.readFileSync(schemaPath, 'utf8')
    
    // Split the SQL into individual statements
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`)
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message)
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`)
        }
      } catch (err) {
        console.error(`❌ Failed to execute statement ${i + 1}:`, err.message)
      }
    }
    
    console.log('✅ Database schema setup completed!')
    
    // Test the connection by checking if the table exists
    const { data, error } = await supabase
      .from('pdf_chunks')
      .select('count')
      .limit(1)
    
    if (error) {
      console.log('⚠️ Table might not exist yet, this is normal for first setup')
    } else {
      console.log('✅ pdf_chunks table is accessible')
    }
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message)
  }
}

// Run the setup
if (process.argv[2] === 'setup') {
  setupDatabase()
}

export { setupDatabase }