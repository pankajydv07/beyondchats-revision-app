// Authentication Service for Supabase
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// Create Supabase client for authentication
const supabase = createClient(
  config.supabaseUrl,
  config.supabaseKey
);

// Create Supabase admin client (with service role key for admin operations)
const supabaseAdmin = config.supabaseServiceKey
  ? createClient(
      config.supabaseUrl,
      config.supabaseServiceKey
    )
  : null;

/**
 * Authentication service for handling Supabase auth operations
 */
export const authService = {
  /**
   * Get user by token
   * @param {string} token - JWT token
   * @returns {Object|null} - User object or null
   */
  async getUserByToken(token) {
    if (!token) return null;
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error) {
        console.error('Error getting user by token:', error);
        return null;
      }
      
      return user;
    } catch (error) {
      console.error('Error in getUserByToken:', error);
      return null;
    }
  },
  
  /**
   * Sign in with Google OAuth
   * @param {string} code - Authorization code from Google
   * @returns {Object} - Session info or error
   */
  async signInWithGoogle(code) {
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true, session: data.session, user: data.user };
    } catch (error) {
      console.error('Error in signInWithGoogle:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Sign out user
   * @param {string} token - JWT token
   * @returns {Object} - Success or error
   */
  async signOut(token) {
    if (!token) return { success: false, error: 'No token provided' };
    
    try {
      const { error } = await supabase.auth.admin.signOut(token);
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error in signOut:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Get user profile data
   * @param {string} userId - User ID
   * @returns {Object|null} - User profile or null
   */
  async getUserProfile(userId) {
    if (!userId) return null;
    
    try {
      // Use admin client to bypass RLS for user lookup
      const client = supabaseAdmin || supabase;
      
      const { data, error } = await client
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error getting user profile:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      return null;
    }
  },
  
  /**
   * Create or update user profile
   * @param {Object} profile - User profile data
   * @returns {Object} - Success or error
   */
  async upsertUserProfile(profile) {
    if (!profile?.id) {
      return { success: false, error: 'No user ID provided' };
    }

    try {
      // For debugging: check if we have admin client
      const hasAdminClient = !!supabaseAdmin;
      console.log('🔧 Admin client available:', hasAdminClient);
      
      // Use admin client to bypass RLS for user creation, fallback to regular client
      const client = supabaseAdmin || supabase;
      console.log('🔧 Using client type:', supabaseAdmin ? 'ADMIN' : 'REGULAR');
      
      // First try to insert with the exact Supabase Auth user ID
      const { data, error } = await client
        .from('users')
        .upsert([{
          id: profile.id, // Use the exact Supabase Auth user ID
          email: profile.email,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          updated_at: new Date().toISOString()
        }], { 
          onConflict: 'id',
          ignoreDuplicates: false // Force update if exists
        })
        .select(); // Return the created/updated record

      if (error) {
        console.error('Database error creating user profile:', error);
        
        // If RLS error and we're not using admin client, suggest the fix
        if (error.code === '42501' && !supabaseAdmin) {
          return { success: false, error: 'RLS policy blocking user creation. Need to configure SUPABASE_SERVICE_KEY or disable RLS on users table.' };
        }
        
        return { success: false, error: error.message };
      }

      console.log('✅ User profile created/updated successfully:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Error in upsertUserProfile:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Verify session
   * @param {string} token - JWT token
   * @returns {Object} - Session status
   */
  async verifySession(token) {
    if (!token) return { valid: false };
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return { valid: false };
      }
      
      return { valid: true, user };
    } catch (error) {
      console.error('Error in verifySession:', error);
      return { valid: false };
    }
  }
};

export default authService;