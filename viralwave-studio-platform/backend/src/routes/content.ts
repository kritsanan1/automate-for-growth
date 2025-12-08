import express from 'express';
import { body, validationResult } from 'express-validator';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const router = express.Router();

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Validation middleware
const validateContentGeneration = [
  body('prompt').trim().isLength({ min: 10 }).withMessage('Prompt must be at least 10 characters'),
  body('platform').isIn(['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads', 'wordpress']).withMessage('Invalid platform'),
  body('contentType').isIn(['post', 'video', 'blog', 'story', 'reel']).withMessage('Invalid content type'),
  body('tone').optional().isIn(['professional', 'casual', 'humorous', 'inspirational', 'informative']).withMessage('Invalid tone'),
  body('count').optional().isInt({ min: 1, max: 50 }).withMessage('Count must be between 1 and 50'),
];

const validateContentUpdate = [
  body('content').optional().trim().isLength({ min: 1 }).withMessage('Content cannot be empty'),
  body('status').optional().isIn(['draft', 'scheduled', 'published', 'failed']).withMessage('Invalid status'),
  body('scheduledFor').optional().isISO8601().withMessage('Invalid date format'),
];

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

// Get all content for authenticated user
router.get('/', authenticateToken, async (req: any, res, next) => {
  try {
    const { page = 1, limit = 20, status, platform, contentType } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('content')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (platform) query = query.eq('platform_type', platform);
    if (contentType) query = query.eq('content_type', contentType);

    const { data: content, error, count } = await query as any;

    if (error) throw error;

    res.json({
      success: true,
      data: {
        content,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get single content by ID
router.get('/:id', authenticateToken, async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;

    const { data: content, error } = await supabase
      .from('content')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.json({
      success: true,
      data: content
    });
  } catch (error) {
    next(error);
  }
});

// Generate content with AI
router.post('/generate', authenticateToken, validateContentGeneration, async (req: any, res: any, next: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { prompt, platform, contentType, tone = 'professional', count = 1 } = req.body;

    // Check user's token usage
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('plan_id')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .single() as any;

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('max_tokens_per_month, max_content_per_month')
      .eq('id', subscription.plan_id)
      .single() as any;

    // Calculate token usage for this request
    const estimatedTokens = count * 500; // Rough estimate

    // Generate content using OpenAI
    const systemPrompt = `You are a professional content creator for ${platform}. Create ${contentType} content that is ${tone} in tone. Make it engaging, authentic, and optimized for the platform. Limit the response to appropriate length for the platform.`;

    const userPrompt = `Create ${count} ${contentType} content piece(s) about: ${prompt}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const generatedContent = completion.choices[0]?.message?.content;

    // Save to database
    const { data: content, error } = await supabase
      .from('content')
      .insert([{
        user_id: req.user.id,
        content_text: generatedContent,
        platform_type: platform,
        content_type: contentType,
        status: 'draft',
        metadata: {
          prompt,
          tone,
          generated_at: new Date().toISOString(),
          tokens_used: estimatedTokens
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single() as any;

    if (error) throw error;

    // Update token usage
    await supabase.from('token_usage').insert([{
      user_id: req.user.id,
      tokens_used: estimatedTokens,
      tokens_remaining: plan?.max_tokens_per_month - estimatedTokens,
      usage_type: 'content_generation',
      reference_id: content?.id
    }]);

    res.json({
      success: true,
      message: 'Content generated successfully',
      data: content
    });
  } catch (error) {
    next(error);
  }
});

// Update content
router.put('/:id', authenticateToken, validateContentUpdate, async (req: any, res: any, next: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { content, status, scheduledFor } = req.body;

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (content !== undefined) updateData.content_text = content;
    if (status !== undefined) updateData.status = status;
    if (scheduledFor !== undefined) updateData.scheduled_for = scheduledFor;

    const { data: updatedContent, error } = await supabase
      .from('content')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single() as any;

    if (error) throw error;
    if (!updatedContent) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.json({
      success: true,
      message: 'Content updated successfully',
      data: updatedContent
    });
  } catch (error) {
    next(error);
  }
});

// Delete content
router.delete('/:id', authenticateToken, async (req: any, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('content')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Content deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export { router as contentRouter };