// Client-side Supabase client utility
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    url: !!supabaseUrl,
    anonKey: !!supabaseAnonKey
  });
}

// Create a single supabase client for the entire app
// Using anon key for client-side operations with RLS
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Verify connection on startup
async function verifyConnection() {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.warn('⚠️  Supabase client connection warning:', error.message);
    } else {
      console.log('✅ Client connected to Supabase successfully');
    }
  } catch (err) {
    console.error('❌ Failed to connect to Supabase from client:', err.message);
  }
}

// Initialize connection check
verifyConnection();

export default supabase;