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

// Log configuration for debugging (without exposing sensitive keys)
console.log(`Supabase client configured with URL: ${supabaseUrl ? 'FOUND' : 'MISSING'}`);
console.log(`Environment: ${import.meta.env.MODE}`);
console.log(`Base URL: ${window.location.origin}`);

// Create Supabase client with specific configuration for better auth handling
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit' // Handle token in URL fragment
  }
});

// Verify connection on startup
async function verifyConnection() {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.warn('⚠️  Supabase client connection warning:', error.message);
    } else {
      console.log('✅ Client connected to Supabase successfully', data?.session ? 'with session' : 'without session');
    }
  } catch (err) {
    console.error('❌ Failed to connect to Supabase from client:', err.message);
  }
}

// Initialize connection check
verifyConnection();

export default supabase;