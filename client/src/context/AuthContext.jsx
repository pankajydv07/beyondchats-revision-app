// Authentication context for managing user state across the application
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

// Create context
const AuthContext = createContext(null);

// Auth provider component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Initialize auth state on component mount
  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);
      
      try {
        // Check if we have a session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (session) {
          setSession(session);
          setUser(session.user);
          console.log('✅ Session found, user:', session.user.email);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    initializeAuth();
  }, []);
  
  // Function to register user with our backend
  const registerUserWithBackend = async (user, accessToken) => {
    try {
      console.log('🔄 Registering user with backend:', user.email);
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/auth/register-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ user })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to register user with backend');
      }
      
      const result = await response.json();
      console.log('✅ User registered with backend:', result);
      return result;
    } catch (error) {
      console.error('❌ Error registering user with backend:', error);
      setError('Failed to register user. Please try refreshing the page.');
      return null;
    }
  };
  
  // Subscribe to auth changes
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔔 Auth state change:', event, session?.user?.email);
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // If user just signed in, register them with our backend
        if (event === 'SIGNED_IN' && session?.user && session?.access_token) {
          console.log('👤 User signed in, registering with backend...');
          await registerUserWithBackend(session.user, session.access_token);
        }
        
        // Clear error when user signs out
        if (event === 'SIGNED_OUT') {
          setError(null);
        }
      }
    );
    
    // Cleanup subscription
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);
  
  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      console.log('Initiating Google sign in');
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log('Using redirect URL:', redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        },
      });
      
      if (error) {
        console.error('Error during OAuth initiation:', error);
        throw error;
      }
      
      console.log('OAuth flow initiated successfully', data);
    } catch (error) {
      console.error('Google sign in error:', error);
      setError(error.message);
      return { error };
    }
  };
  
  // Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Sign out error:', error);
      setError(error.message);
      return { error };
    }
  };
  
  // Get user profile
  const getUserProfile = async () => {
    if (!user) return null;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }
      
      const data = await response.json();
      return data.profile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setError(error.message);
      return null;
    }
  };
  
  // Update user profile
  const updateUserProfile = async (profile) => {
    if (!user) return { error: 'Not authenticated' };
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(profile)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(error.message);
      return { error: error.message };
    }
  };
  
  // Context value
  const value = {
    user,
    session,
    loading,
    error,
    signInWithGoogle,
    signOut,
    getUserProfile,
    updateUserProfile,
    isAuthenticated: !!user,
  };
  
  // Provide the auth context to children components
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook for using auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;