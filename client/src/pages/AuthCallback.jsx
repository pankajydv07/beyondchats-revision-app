import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState(null);
  
  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Auth callback initiated - processing login');
        
        // Debug info
        const hashExists = !!window.location.hash;
        const hashLength = window.location.hash.length;
        const queryParamsExist = window.location.search.length > 1;
        
        console.log('Auth callback debug info:', {
          hashExists,
          hashLength,
          hash: hashExists ? window.location.hash.substring(0, 15) + '...' : '...',
          queryParamsExist,
          url: window.location.href
        });
        
        if (hashExists) {
          console.log('Found access_token in URL fragment, processing directly');
          // For Supabase v2.x+, we use setSession instead of getSessionFromUrl
          try {
            // Extract the access token from the URL fragment
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            
            if (accessToken) {
              // Use the newer API method for setting the session
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || ''
              });
              
              if (error) {
                throw error;
              }
              
              console.log('Session set successfully, redirecting to dashboard');
              navigate('/dashboard', { replace: true });
              return;
            }
          } catch (error) {
            console.log('Error processing hash:', error);
            // Continue to the next approach if this fails
          }
        }
        
        // If we reach here, try to get the existing session as a fallback
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (data?.session) {
          console.log('Using existing session, redirecting to dashboard');
          navigate('/dashboard', { replace: true });
        } else {
          console.log('No session found, redirecting to login');
          navigate('/login', { replace: true });
        }
      } catch (error) {
        console.error('Error in auth callback:', error);
        setErrorMessage('Authentication failed. Please try again.');
        setTimeout(() => {
          navigate('/login', { 
            replace: true, 
            state: { error: 'Something went wrong during authentication.' } 
          });
        }, 1500);
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
        {errorMessage && (
          <p className="text-red-600 mt-4">{errorMessage}</p>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;