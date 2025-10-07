import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';

const AuthCallback = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Handle the OAuth callback
    const handleAuthCallback = async () => {
      try {
        // Get the URL hash and convert it to URLSearchParams
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        // If we have an access token, the sign in was successful
        // This will update the auth state through the onAuthStateChange listener in AuthContext
        if (hashParams.get('access_token')) {
          // Redirect to home page after a short delay
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 1000);
        } else {
          // Check for errors
          const errorDescription = hashParams.get('error_description');
          if (errorDescription) {
            console.error('Authentication error:', errorDescription);
            navigate('/login', { 
              replace: true, 
              state: { error: 'Authentication failed. Please try again.' } 
            });
          } else {
            // Fall back to using Supabase's getSession API if we don't have hash params
            const { data, error } = await supabase.auth.getSession();
            
            if (error) {
              throw error;
            }
            
            if (data?.session) {
              navigate('/', { replace: true });
            } else {
              navigate('/login', { replace: true });
            }
          }
        }
      } catch (error) {
        console.error('Error in auth callback:', error);
        navigate('/login', { 
          replace: true, 
          state: { error: 'Something went wrong during authentication.' } 
        });
      }
    };
    
    handleAuthCallback();
  }, [navigate]);
  
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-medium text-gray-900">Completing sign in...</h2>
        <p className="text-gray-600 mt-2">Please wait while we log you in</p>
      </div>
    </div>
  );
};

export default AuthCallback;