import React from 'react';
import { useAuth } from '../context/AuthContext';
import PropTypes from 'prop-types';

const UserProfileSection = ({ className = '' }) => {
  const { user, signOut, isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className={`flex items-center p-4 border-t border-gray-200 ${className}`}>
        <div className="animate-pulse flex items-center space-x-3 w-full">
          <div className="rounded-full bg-gray-300 h-10 w-10"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-3 bg-gray-300 rounded w-1/2 mt-2"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className={`p-4 border-t border-gray-200 ${className}`}>
        <div className="flex flex-col">
          <span className="text-sm text-gray-500">Not logged in</span>
          <a 
            href="/login"
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            Sign in with Google
          </a>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`flex items-center justify-between p-4 border-t border-gray-200 ${className}`}>
      <div className="flex items-center space-x-3">
        {user.user_metadata?.avatar_url ? (
          <img 
            src={user.user_metadata.avatar_url} 
            alt="Avatar" 
            className="h-10 w-10 rounded-full"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
            {user.email?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
        
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">
            {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
          </span>
          {user.email && (
            <span className="text-xs text-gray-500 truncate max-w-[140px]">
              {user.email}
            </span>
          )}
        </div>
      </div>
      
      <button
        onClick={signOut}
        className="text-sm text-gray-500 hover:text-red-600"
        title="Sign out"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  );
};

UserProfileSection.propTypes = {
  className: PropTypes.string
};

export default UserProfileSection;