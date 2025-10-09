// Authentication middleware to protect routes
import authService from '../services/authService.js';

/**
 * Middleware to verify user authentication through Supabase JWT
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireAuth = async (req, res, next) => {
  try {
    console.log('🔐 Auth middleware called for:', req.method, req.path)
    
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    console.log('🔐 Auth header present:', !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No valid auth header found')
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('❌ No token in auth header')
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    console.log('🔐 Token found, verifying...')
    
    // Verify token and get user
    const { valid, user } = await authService.verifySession(token);
    if (!valid || !user) {
      console.log('❌ Token verification failed')
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    console.log('✅ Auth successful for user:', user.id)
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Optional auth middleware - proceeds even if not authenticated
 * but attaches user to request if available
 */
export const optionalAuth = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      req.user = null;
      return next();
    }
    
    // Verify token and get user
    const { valid, user } = await authService.verifySession(token);
    if (!valid || !user) {
      req.user = null;
      return next();
    }
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    req.user = null;
    next();
  }
};