// Server-side Supabase client utility
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables:', {
    url: !!supabaseUrl,
    serviceKey: !!supabaseServiceKey
  });
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
}

// Create a single supabase client for server-side operations
// Using service role key for full database access
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Verify connection on startup
async function verifyConnection() {
  try {
    const { data, error } = await supabase
      .from('pdf_chunks')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.warn('⚠️  Supabase connection warning:', error.message);
    } else {
      console.log('✅ Server connected to Supabase successfully');
    }
  } catch (err) {
    console.error('❌ Failed to connect to Supabase:', err.message);
  }
}

// Initialize connection check
verifyConnection();

export default supabase;
