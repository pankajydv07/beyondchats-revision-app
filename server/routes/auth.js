// Authentication routes
import express from 'express';
import authService from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Exchange authorization code for session (Google OAuth)
 * @route POST /api/auth/google
 */
router.post('/google', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }
    
    const result = await authService.signInWithGoogle(code);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    // Get user profile or create one if it doesn't exist
    let userProfile = await authService.getUserProfile(result.user.id);
    
    if (!userProfile) {
      // Create basic profile for new users
      const newProfile = {
        user_id: result.user.id,
        email: result.user.email,
        display_name: result.user.user_metadata?.full_name || result.user.email.split('@')[0],
        avatar_url: result.user.user_metadata?.avatar_url || null,
        created_at: new Date().toISOString()
      };
      
      await authService.upsertUserProfile(newProfile);
    }
    
    res.json({
      user: result.user,
      session: result.session
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * Sign out current user
 * @route POST /api/auth/signout
 */
router.post('/signout', requireAuth, async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const result = await authService.signOut(token);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ message: 'Successfully signed out' });
  } catch (error) {
    console.error('Sign out error:', error);
    res.status(500).json({ error: 'Sign out failed' });
  }
});

/**
 * Get current user
 * @route GET /api/auth/user
 */
router.get('/user', requireAuth, async (req, res) => {
  try {
    // User is already attached to req by the requireAuth middleware
    res.json({ user: req.user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

/**
 * Get user profile
 * @route GET /api/auth/profile
 */
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const profile = await authService.getUserProfile(req.user.id);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    res.json({ profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

/**
 * Update user profile
 * @route PUT /api/auth/profile
 */
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { display_name, avatar_url, preferences } = req.body;
    
    const profile = {
      user_id: req.user.id,
      display_name,
      avatar_url,
      preferences,
      updated_at: new Date().toISOString()
    };
    
    const result = await authService.upsertUserProfile(profile);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

/**
 * Verify session is valid
 * @route POST /api/auth/verify
 */
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ valid: false });
    }
    
    const result = await authService.verifySession(token);
    res.json(result);
  } catch (error) {
    console.error('Verify session error:', error);
    res.status(500).json({ valid: false, error: 'Verification failed' });
  }
});

export default router;