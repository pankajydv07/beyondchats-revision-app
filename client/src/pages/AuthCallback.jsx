import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  
  useEffect(() => {
    // Extract hash and query parameters for debugging
    const hash = window.location.hash;
    const queryParams = new URLSearchParams(window.location.search);
    
    const debugData = {
      hashExists: !!hash,
      hashLength: hash.length,
      hash: hash.substring(0, 20) + '...', // Only show beginning for security
      queryParamsExist: queryParams.toString().length > 0,
      url: window.location.href.replace(/access_token=([^&]+)/, 'access_token=REDACTED'),
      currentPath: location.pathname,
    };
    
    setDebugInfo(debugData);
    console.log('Auth callback debug info:', debugData);
    
    // Handle the OAuth callback
    const handleAuthCallback = async () => {
      try {
        console.log('Auth callback initiated - processing login');
        
        // First, directly process the fragment if it exists
        if (hash && hash.includes('access_token')) {
          console.log('Found access_token in URL fragment, processing directly');
          
          try {
            // Use Supabase's getSessionFromUrl to handle the URL fragment
            const { data, error } = await supabase.auth.getSessionFromUrl({
              storeSession: true // Store in localStorage
            });
            
            if (error) {
              console.error('Error getting session from URL:', error);
              throw error;
            }
            
            if (data?.session) {
              console.log('Authentication successful via hash, redirecting to dashboard');
              navigate('/dashboard', { replace: true });
              return;
            }
          } catch (hashError) {
            console.error('Error processing hash:', hashError);
            // Continue to fallback methods
          }
        }
        
        // If hash processing failed or no hash, try exchange code if present
        const code = queryParams.get('code');
        if (code) {
          console.log('Found code parameter, exchanging for session');
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
              console.error('Error exchanging code for session:', error);
            } else if (data?.session) {
              console.log('Authentication successful via code exchange, redirecting to dashboard');
              navigate('/dashboard', { replace: true });
              return;
            }
          } catch (codeError) {
            console.error('Error in code exchange:', codeError);
            // Continue to fallback methods
          }
        }
        
        // If no hash or code processing worked, check for existing session
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          console.log('Using existing session, redirecting to dashboard');
          navigate('/dashboard', { replace: true });
        } else {
          // No session found at all, redirect to login
          console.warn('No session found, redirecting to login');
          setError('Authentication failed. Please try again.');
          setTimeout(() => {
            navigate('/login', { 
              replace: true, 
              state: { error: 'Authentication failed. Please try again.' } 
            });
          }, 3000);
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
        }, 3000);
      }
    };
    
    handleAuthCallback();
  }, [navigate, location]);
  
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
        {process.env.NODE_ENV !== 'production' && debugInfo && (
          <div className="mt-4 text-left text-xs text-gray-500 bg-gray-100 p-2 rounded">
            <p>Debug Info:</p>
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;