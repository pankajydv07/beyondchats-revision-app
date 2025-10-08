// Users routes
import { Router } from 'express';
import { supabase } from '../supabaseClient.js';

const router = Router();

/**
 * Create or update user (upsert)
 * @route POST /api/users
 * @body { email, full_name, avatar_url? }
 */
router.post('/users', async (req, res) => {
  try {
    const { email, full_name, avatar_url } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    // Prepare user data
    const userData = {
      email: email.trim().toLowerCase(),
      full_name: full_name?.trim() || null,
      avatar_url: avatar_url?.trim() || null,
      updated_at: new Date().toISOString()
    };

    console.log('Creating/updating user:', { email: userData.email, full_name: userData.full_name });

    // Upsert user (insert or update if exists)
    const { data, error } = await supabase
      .from('users')
      .upsert(userData, { 
        onConflict: 'email',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating/updating user:', error);
      return res.status(500).json({ 
        error: 'Failed to create/update user',
        details: error.message 
      });
    }

    console.log('User created/updated successfully:', data.id);

    res.status(201).json({
      success: true,
      user: data
    });

  } catch (error) {
    console.error('Error in POST /api/users:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * Get user by ID
 * @route GET /api/users/:id
 */
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ 
        error: 'Invalid user ID format' 
      });
    }

    console.log('Fetching user:', id);

    // Get user from database
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, avatar_url, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase error fetching user:', error);
      
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          error: 'User not found' 
        });
      }

      return res.status(500).json({ 
        error: 'Failed to fetch user',
        details: error.message 
      });
    }

    console.log('User fetched successfully:', data.id);

    res.json({
      success: true,
      user: data
    });

  } catch (error) {
    console.error('Error in GET /api/users/:id:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * Update user by ID
 * @route PUT /api/users/:id
 * @body { full_name?, avatar_url? }
 */
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, avatar_url } = req.body;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ 
        error: 'Invalid user ID format' 
      });
    }

    // Validate that at least one field is provided
    if (full_name === undefined && avatar_url === undefined) {
      return res.status(400).json({ 
        error: 'At least one field (full_name or avatar_url) must be provided' 
      });
    }

    // Prepare update data (only include provided fields)
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (full_name !== undefined) {
      updateData.full_name = full_name?.trim() || null;
    }

    if (avatar_url !== undefined) {
      updateData.avatar_url = avatar_url?.trim() || null;
    }

    console.log('Updating user:', id, updateData);

    // Update user in database
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error updating user:', error);
      
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          error: 'User not found' 
        });
      }

      return res.status(500).json({ 
        error: 'Failed to update user',
        details: error.message 
      });
    }

    console.log('User updated successfully:', data.id);

    res.json({
      success: true,
      user: data
    });

  } catch (error) {
    console.error('Error in PUT /api/users/:id:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

export default router;