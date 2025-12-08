import express from 'express';
import { body, validationResult } from 'express-validator';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Middleware to authenticate requests
const authenticateToken = async (req: any, res: any, next: any) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    
    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, role, is_active')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .single() as any;

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Get all available platforms
router.get('/available', authenticateToken, async (req: any, res, next) => {
  try {
    const { data: platforms, error } = await supabase
      .from('platforms')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    res.json({
      success: true,
      data: platforms
    });
  } catch (error) {
    next(error);
  }
});

// Get user's connected platforms
router.get('/connected', authenticateToken, async (req: any, res, next) => {
  try {
    const { data: connections, error } = await supabase
      .from('user_platform_connections')
      .select(`
        *,
        platforms (*)
      `)
      .eq('user_id', req.user.id)
      .eq('connection_status', 'connected')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: connections
    });
  } catch (error) {
    next(error);
  }
});

// Connect to a platform
router.post('/connect', authenticateToken, [
  body('platform_id').isUUID().withMessage('Valid platform ID is required'),
  body('access_token').trim().isLength({ min: 10 }).withMessage('Access token is required'),
  body('account_id').trim().isLength({ min: 1 }).withMessage('Account ID is required'),
  body('account_name').trim().isLength({ min: 1 }).withMessage('Account name is required'),
], async (req: any, res: any, next: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { platform_id, access_token, refresh_token, account_id, account_name } = req.body;

    // Check if platform exists and is active
    const { data: platform, error: platformError } = await supabase
      .from('platforms')
      .select('*')
      .eq('id', platform_id)
      .eq('is_active', true)
      .single() as any;

    if (platformError || !platform) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive platform'
      });
    }

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('user_platform_connections')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('platform_id', platform_id)
      .eq('account_id', account_id)
      .single() as any;

    let connection;
    if (existingConnection) {
      // Update existing connection
      const { data: updatedConnection, error } = await supabase
        .from('user_platform_connections')
        .update({
          access_token,
          refresh_token: refresh_token || null,
          token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          connection_status: 'connected',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConnection.id)
        .select()
        .single() as any;

      if (error) throw error;
      connection = updatedConnection;
    } else {
      // Create new connection
      const { data: newConnection, error } = await supabase
        .from('user_platform_connections')
        .insert([{
          user_id: req.user.id,
          platform_id,
          account_name,
          account_id,
          access_token,
          refresh_token: refresh_token || null,
          token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          connection_status: 'connected',
          metadata: {
            connected_at: new Date().toISOString()
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single() as any;

      if (error) throw error;
      connection = newConnection;
    }

    res.json({
      success: true,
      message: 'Platform connected successfully',
      data: connection
    });
  } catch (error) {
    next(error);
  }
});

// Disconnect from a platform
router.delete('/disconnect/:connectionId', authenticateToken, async (req: any, res, next) => {
  try {
    const { connectionId } = req.params;

    const { error } = await supabase
      .from('user_platform_connections')
      .update({
        connection_status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Platform disconnected successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Test platform connection
router.post('/test-connection/:connectionId', authenticateToken, async (req: any, res: any, next: any) => {
  try {
    const { connectionId } = req.params;

    const { data: connection, error } = await supabase
      .from('user_platform_connections')
      .select(`
        *,
        platforms (*)
      `)
      .eq('id', connectionId)
      .eq('user_id', req.user.id)
      .single() as any;

    if (error || !connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }

    // Test the connection based on platform type
    let testResult = { success: false, message: 'Not implemented' };

    switch (connection.platforms.name.toLowerCase()) {
      case 'facebook':
      case 'instagram':
        // Test Facebook Graph API connection
        try {
          const response = await axios.get(`https://graph.facebook.com/v18.0/me`, {
            headers: {
              'Authorization': `Bearer ${connection.access_token}`
            }
          });
          testResult = { success: true, message: 'Facebook connection successful' };
        } catch (error) {
          testResult = { success: false, message: 'Facebook connection failed' };
        }
        break;

      case 'linkedin':
        // Test LinkedIn API connection
        try {
          const response = await axios.get('https://api.linkedin.com/v2/me', {
            headers: {
              'Authorization': `Bearer ${connection.access_token}`
            }
          });
          testResult = { success: true, message: 'LinkedIn connection successful' };
        } catch (error) {
          testResult = { success: false, message: 'LinkedIn connection failed' };
        }
        break;

      default:
        testResult = { success: false, message: 'Platform test not implemented' };
    }

    res.json({
      success: testResult.success,
      message: testResult.message
    });
  } catch (error) {
    next(error);
  }
});

export { router as platformRouter };