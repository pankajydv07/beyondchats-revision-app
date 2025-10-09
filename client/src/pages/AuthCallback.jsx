import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // Handle the OAuth callback
    const handleAuthCallback = async () => {
      try {
        console.log('Auth callback initiated - processing login');
        
        // Use Supabase's getSessionFromUrl to handle the URL fragment
        // This is the recommended approach for Supabase OAuth redirects
        const { data, error } = await supabase.auth.getSessionFromUrl({
          storeSession: true // Store in localStorage
        });
        
        if (error) {
          console.error('Error getting session from URL:', error);
          throw error;
        }
        
        // If we have a session, authentication was successful
        if (data?.session) {
          console.log('Authentication successful, redirecting to dashboard');
          // Redirect to dashboard after successful authentication
          navigate('/dashboard', { replace: true });
          return;
        }
        
        // If no session from URL, check if we have one stored already
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          console.log('Using existing session, redirecting to dashboard');
          navigate('/dashboard', { replace: true });
        } else {
          // No session found at all, redirect to login
          console.warn('No session found, redirecting to login');
          navigate('/login', { replace: true });
        }
      } catch (error) {
        console.error('Error in auth callback:', error);
        setError('Authentication failed. Please try again.');
        
        // Redirect to login page after a short delay
        setTimeout(() => {
          navigate('/login', { 
            replace: true, 
            state: { error: 'Something went wrong during authentication.' } 
          });
        }, 2000);
      }
    };
    
    handleAuthCallback();
  }, [navigate]);
  
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-medium text-gray-900">Completing sign in...</h2>
        {error ? (
          <p className="text-red-600 mt-2">{error}</p>
        ) : (
          <p className="text-gray-600 mt-2">Please wait while we log you in</p>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;