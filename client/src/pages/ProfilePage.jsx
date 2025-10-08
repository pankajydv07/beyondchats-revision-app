import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

function ProfilePage() {
  const { user, session, signOut } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    avatar_url: ''
  })
  const [originalData, setOriginalData] = useState({})

  // Fetch user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) return

      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/users/${user.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          const userData = data.user
          
          const userFormData = {
            full_name: userData.full_name || '',
            email: userData.email || user.email || '',
            avatar_url: userData.avatar_url || ''
          }
          
          setFormData(userFormData)
          setOriginalData(userFormData)
        } else if (response.status === 404) {
          // User doesn't exist in our database, create with default data
          const defaultData = {
            full_name: user.user_metadata?.full_name || '',
            email: user.email || '',
            avatar_url: user.user_metadata?.avatar_url || ''
          }
          setFormData(defaultData)
          setOriginalData(defaultData)
        } else {
          throw new Error('Failed to fetch user data')
        }
      } catch (err) {
        console.error('Error fetching user data:', err)
        setError('Failed to load profile data. Please try again.')
        
        // Fallback to auth data
        const fallbackData = {
          full_name: user.user_metadata?.full_name || '',
          email: user.email || '',
          avatar_url: user.user_metadata?.avatar_url || ''
        }
        setFormData(fallbackData)
        setOriginalData(fallbackData)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [user, session])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear any existing messages when user starts editing
    if (error) setError(null)
    if (successMessage) setSuccessMessage('')
  }

  const handleSave = async () => {
    if (!user?.id) {
      setError('User ID not found')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccessMessage('')

      // Prepare data for API (only send changed fields, exclude email)
      const updateData = {}
      if (formData.full_name !== originalData.full_name) {
        updateData.full_name = formData.full_name
      }
      if (formData.avatar_url !== originalData.avatar_url) {
        updateData.avatar_url = formData.avatar_url
      }

      // If no changes, just exit edit mode
      if (Object.keys(updateData).length === 0) {
        setIsEditing(false)
        setSuccessMessage('No changes to save')
        return
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        const data = await response.json()
        const updatedUser = data.user
        
        const newFormData = {
          full_name: updatedUser.full_name || '',
          email: updatedUser.email || formData.email,
          avatar_url: updatedUser.avatar_url || ''
        }
        
        setFormData(newFormData)
        setOriginalData(newFormData)
        setIsEditing(false)
        setSuccessMessage('Profile updated successfully!')
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000)
      } else if (response.status === 404) {
        // User doesn't exist, create new user
        const createResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/users`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: formData.email,
            full_name: formData.full_name,
            avatar_url: formData.avatar_url
          })
        })

        if (createResponse.ok) {
          const createData = await createResponse.json()
          const newUser = createData.user
          
          const newFormData = {
            full_name: newUser.full_name || '',
            email: newUser.email || '',
            avatar_url: newUser.avatar_url || ''
          }
          
          setFormData(newFormData)
          setOriginalData(newFormData)
          setIsEditing(false)
          setSuccessMessage('Profile created successfully!')
          
          setTimeout(() => setSuccessMessage(''), 3000)
        } else {
          throw new Error('Failed to create user profile')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update profile')
      }
    } catch (err) {
      console.error('Error saving profile:', err)
      setError(err.message || 'Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({ ...originalData })
    setIsEditing(false)
    setError(null)
    setSuccessMessage('')
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading profile...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Edit Profile
                </button>
              ) : null}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="mb-6 rounded-md bg-green-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-800">{successMessage}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Profile Picture */}
              <div className="flex items-center space-x-6">
                <div className="flex-shrink-0">
                  <img
                    className="h-16 w-16 rounded-full object-cover"
                    src={formData.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.full_name || formData.email)}&size=64&background=3B82F6&color=fff`}
                    alt="Profile"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Profile Picture</h3>
                  <p className="text-sm text-gray-500">
                    {isEditing ? 'Update your avatar URL below' : 'Your current profile picture'}
                  </p>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <div className="mt-1">
                  {isEditing ? (
                    <input
                      type="text"
                      name="full_name"
                      id="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="Enter your full name"
                    />
                  ) : (
                    <p className="text-sm text-gray-900">{formData.full_name || 'Not provided'}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <div className="mt-1">
                  <p className="text-sm text-gray-900">{formData.email}</p>
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>
              </div>

              {/* Avatar URL */}
              {isEditing && (
                <div>
                  <label htmlFor="avatar_url" className="block text-sm font-medium text-gray-700">
                    Avatar URL
                  </label>
                  <div className="mt-1">
                    <input
                      type="url"
                      name="avatar_url"
                      id="avatar_url"
                      value={formData.avatar_url}
                      onChange={handleInputChange}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </div>
                </div>
              )}

              {/* Account Information */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Account Created</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Last Sign In</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Unknown'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">User ID</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-mono text-xs">{user?.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email Verified</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {user?.email_confirmed_at ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Unverified
                        </span>
                      )}
                    </dd>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {isEditing && (
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Account Actions</h3>
            <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
              <button
                onClick={handleSignOut}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Additional Features Notice */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-blue-900">More Features Coming Soon!</h3>
              <p className="mt-2 text-blue-700">
                We're working on adding preference settings, notification options, learning goals, and more personalization features.
                Your profile data is now fully integrated with our backend API.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage