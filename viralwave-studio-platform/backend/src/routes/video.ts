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
      .single();

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

// Validation middleware
const validateVideoGeneration = [
  body('prompt').trim().isLength({ min: 20 }).withMessage('Prompt must be at least 20 characters'),
  body('duration').optional().isInt({ min: 5, max: 60 }).withMessage('Duration must be between 5 and 60 seconds'),
  body('style').optional().isIn(['realistic', 'animated', 'cinematic', 'minimalist', 'vibrant']).withMessage('Invalid style'),
  body('aspect_ratio').optional().isIn(['16:9', '9:16', '4:3', '1:1']).withMessage('Invalid aspect ratio'),
];

// Generate video using Sora API
router.post('/generate', authenticateToken, validateVideoGeneration, async (req: any, res: any, next: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { 
      prompt, 
      duration = 10, 
      style = 'realistic', 
      aspect_ratio = '16:9',
      content_id = null 
    } = req.body;

    // Check user's subscription and usage limits
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('plan_id')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .single();

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('max_video_minutes_per_month')
      .eq('id', subscription.plan_id)
      .single();

    // Check current usage
    const { data: usageData } = await supabase
      .from('video_generation_jobs')
      .select('duration')
      .eq('user_id', req.user.id)
      .eq('status', 'completed')
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

    const currentUsage = usageData?.reduce((total, job) => total + (job.duration || 0), 0) || 0;
    const newUsage = currentUsage + duration;

    if (newUsage > plan?.max_video_minutes_per_month * 60) { // Convert minutes to seconds
      return res.status(403).json({
        success: false,
        message: 'Monthly video generation limit exceeded'
      });
    }

    // Create video generation job
    const { data: job, error: jobError } = await supabase
      .from('video_generation_jobs')
      .insert([{
        user_id: req.user.id,
        content_id: content_id,
        prompt: prompt,
        duration: duration,
        style: style,
        status: 'pending',
        cost_credits: Math.ceil(duration / 10), // 1 credit per 10 seconds
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (jobError) throw jobError;

    // Simulate Sora API call (in production, this would be a real API call)
    // For now, we'll simulate the video generation process
    setTimeout(async () => {
      try {
        // Simulate video generation completion
        const videoUrl = `https://example.com/videos/${job.id}.mp4`;
        
        await supabase
          .from('video_generation_jobs')
          .update({
            status: 'completed',
            video_url: videoUrl,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        // If this is associated with content, update the content status
        if (content_id) {
          await supabase
            .from('content')
            .update({
              metadata: {
                video_url: videoUrl,
                video_job_id: job.id
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', content_id);
        }

      } catch (error) {
        console.error('Video generation completion error:', error);
        await supabase
          .from('video_generation_jobs')
          .update({
            status: 'failed',
            error_message: 'Video generation failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);
      }
    }, 30000); // Simulate 30 second processing time

    res.json({
      success: true,
      message: 'Video generation job created successfully',
      data: {
        job_id: job.id,
        status: 'pending',
        estimated_completion_time: new Date(Date.now() + 30000).toISOString()
      }
    });

  } catch (error) {
    next(error);
  }
});

// Get video generation job status
router.get('/job/:jobId', authenticateToken, async (req: any, res: any, next: any) => {
  try {
    const { jobId } = req.params;

    const { data: job, error } = await supabase
      .from('video_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', req.user.id)
      .single();

    if (error || !job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    next(error);
  }
});

// Get user's video generation history
router.get('/history', authenticateToken, async (req: any, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('video_generation_jobs')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data: jobs, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: {
        jobs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Cancel video generation job
router.delete('/job/:jobId', authenticateToken, async (req: any, res: any, next: any) => {
  try {
    const { jobId } = req.params;

    // Only allow cancelling pending jobs
    const { data: job, error: jobError } = await supabase
      .from('video_generation_jobs')
      .select('status')
      .eq('id', jobId)
      .eq('user_id', req.user.id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (job.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Can only cancel pending jobs'
      });
    }

    const { error } = await supabase
      .from('video_generation_jobs')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Job cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
});

export { router as videoRouter };