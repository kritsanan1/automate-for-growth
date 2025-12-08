import express from 'express';
import { query, validationResult } from 'express-validator';
import { createClient } from '@supabase/supabase-js';

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

// Get analytics dashboard data
router.get('/dashboard', authenticateToken, [
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
], async (req: any, res: any, next: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate) : new Date();

    // Get content statistics
    const { data: contentStats, error: contentError } = await supabase
      .from('content')
      .select('status, platform_type, content_type, created_at')
      .eq('user_id', req.user.id)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (contentError) throw contentError;

    // Get platform connections
    const { data: connections, error: connectionsError } = await supabase
      .from('user_platform_connections')
      .select('platform_id, connection_status, platforms(name)')
      .eq('user_id', req.user.id);

    if (connectionsError) throw connectionsError;

    // Get video generation stats
    const { data: videoStats, error: videoError } = await supabase
      .from('video_generation_jobs')
      .select('status, duration, cost_credits, created_at')
      .eq('user_id', req.user.id)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (videoError) throw videoError;

    // Get analytics data
    const { data: analyticsData, error: analyticsError } = await supabase
      .from('analytics')
      .select('metric_type, metric_value, metric_date')
      .eq('user_id', req.user.id)
      .gte('metric_date', start.toISOString().split('T')[0])
      .lte('metric_date', end.toISOString().split('T')[0]);

    if (analyticsError) throw analyticsError;

    // Process and aggregate data
    const dashboardData = {
      content: {
        total: contentStats?.length || 0,
        byStatus: processContentByStatus(contentStats),
        byPlatform: processContentByPlatform(contentStats),
        byType: processContentByType(contentStats),
        recent: contentStats?.slice(-5) || []
      },
      platforms: {
        total: connections?.length || 0,
        connected: connections?.filter(c => c.connection_status === 'connected').length || 0,
        byPlatform: processConnectionsByPlatform(connections)
      },
      videos: {
        total: videoStats?.length || 0,
        completed: videoStats?.filter(v => v.status === 'completed').length || 0,
        totalDuration: videoStats?.reduce((sum, v) => sum + (v.duration || 0), 0) || 0,
        totalCost: videoStats?.reduce((sum, v) => sum + (v.cost_credits || 0), 0) || 0
      },
      analytics: processAnalyticsData(analyticsData),
      engagement: calculateEngagementMetrics(analyticsData),
      viralityScore: calculateViralityScore(contentStats, analyticsData)
    };

    res.json({
      success: true,
      data: dashboardData,
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get performance metrics
router.get('/performance', authenticateToken, [
  query('metric').optional().isIn(['engagement', 'reach', 'clicks', 'conversions', 'all']).withMessage('Invalid metric'),
  query('platform').optional().isString().withMessage('Invalid platform'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
], async (req: any, res: any, next: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { metric = 'all', platform, startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let query = supabase
      .from('analytics')
      .select('*')
      .eq('user_id', req.user.id)
      .gte('metric_date', start.toISOString().split('T')[0])
      .lte('metric_date', end.toISOString().split('T')[0]);

    if (platform) query = query.eq('platform_connection_id', platform);

    const { data: analytics, error } = await query;

    if (error) throw error;

    // Process metrics
    const performanceData = {
      overview: calculatePerformanceOverview(analytics),
      trends: calculateTrends(analytics),
      topPerforming: findTopPerformingContent(analytics),
      platformComparison: comparePlatforms(analytics),
      recommendations: generateRecommendations(analytics)
    };

    res.json({
      success: true,
      data: performanceData
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
function processContentByStatus(content: any[]) {
  const statusCount: Record<string, number> = {};
  content?.forEach(item => {
    statusCount[item.status] = (statusCount[item.status] || 0) + 1;
  });
  return statusCount;
}

function processContentByPlatform(content: any[]) {
  const platformCount: Record<string, number> = {};
  content?.forEach(item => {
    platformCount[item.platform_type] = (platformCount[item.platform_type] || 0) + 1;
  });
  return platformCount;
}

function processContentByType(content: any[]) {
  const typeCount: Record<string, number> = {};
  content?.forEach(item => {
    typeCount[item.content_type] = (typeCount[item.content_type] || 0) + 1;
  });
  return typeCount;
}

function processConnectionsByPlatform(connections: any[]) {
  const connectionCount: Record<string, number> = {};
  connections?.forEach(conn => {
    const platformName = conn.platforms?.name || 'Unknown';
    connectionCount[platformName] = (connectionCount[platformName] || 0) + 1;
  });
  return connectionCount;
}

function processAnalyticsData(analytics: any[]) {
  const metrics: Record<string, number> = {};
  analytics?.forEach(item => {
    metrics[item.metric_type] = (metrics[item.metric_type] || 0) + parseFloat(item.metric_value);
  });
  return metrics;
}

function calculateEngagementMetrics(analytics: any[]) {
  const engagement = analytics?.filter(a => a.metric_type === 'engagement') || [];
  const reach = analytics?.filter(a => a.metric_type === 'reach') || [];
  
  const totalEngagement = engagement.reduce((sum, item) => sum + parseFloat(item.metric_value), 0);
  const totalReach = reach.reduce((sum, item) => sum + parseFloat(item.metric_value), 0);
  
  return {
    total_engagement: totalEngagement,
    total_reach: totalReach,
    engagement_rate: totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0
  };
}

function calculateViralityScore(content: any[], analytics: any[]) {
  // Simple virality score calculation
  const totalContent = content?.length || 0;
  const totalEngagement = analytics?.filter(a => a.metric_type === 'engagement').length || 0;
  const totalShares = analytics?.filter(a => a.metric_type === 'shares').length || 0;
  
  if (totalContent === 0) return 0;
  
  const engagementRate = (totalEngagement / totalContent) * 100;
  const shareRate = (totalShares / totalContent) * 100;
  
  // Score out of 100
  return Math.min(100, Math.round((engagementRate + shareRate) / 2));
}

function calculatePerformanceOverview(analytics: any[]) {
  const overview = {
    total_content: 0,
    total_engagement: 0,
    total_reach: 0,
    total_clicks: 0,
    total_conversions: 0,
    average_engagement_rate: 0
  };

  analytics?.forEach(item => {
    const value = parseFloat(item.metric_value);
    switch (item.metric_type) {
      case 'engagement':
        overview.total_engagement += value;
        break;
      case 'reach':
        overview.total_reach += value;
        break;
      case 'clicks':
        overview.total_clicks += value;
        break;
      case 'conversions':
        overview.total_conversions += value;
        break;
    }
  });

  overview.average_engagement_rate = overview.total_reach > 0 ? 
    (overview.total_engagement / overview.total_reach) * 100 : 0;

  return overview;
}

function calculateTrends(analytics: any[]) {
  // Group by date and calculate daily metrics
  const dailyMetrics: Record<string, any> = {};
  
  analytics?.forEach(item => {
    const date = item.metric_date;
    if (!dailyMetrics[date]) {
      dailyMetrics[date] = {
        date,
        engagement: 0,
        reach: 0,
        clicks: 0,
        conversions: 0
      };
    }
    
    const value = parseFloat(item.metric_value);
    switch (item.metric_type) {
      case 'engagement':
        dailyMetrics[date].engagement += value;
        break;
      case 'reach':
        dailyMetrics[date].reach += value;
        break;
      case 'clicks':
        dailyMetrics[date].clicks += value;
        break;
      case 'conversions':
        dailyMetrics[date].conversions += value;
        break;
    }
  });

  return Object.values(dailyMetrics).sort((a: any, b: any) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

function findTopPerformingContent(analytics: any[]) {
  // Group by content and find top performers
  const contentPerformance: Record<string, any> = {};
  
  analytics?.forEach(item => {
    const contentId = item.content_id;
    if (!contentPerformance[contentId]) {
      contentPerformance[contentId] = {
        content_id: contentId,
        total_engagement: 0,
        total_reach: 0,
        performance_score: 0
      };
    }
    
    const value = parseFloat(item.metric_value);
    if (item.metric_type === 'engagement') {
      contentPerformance[contentId].total_engagement += value;
    } else if (item.metric_type === 'reach') {
      contentPerformance[contentId].total_reach += value;
    }
  });

  // Calculate performance score and sort
  Object.values(contentPerformance).forEach((content: any) => {
    content.performance_score = content.total_reach > 0 ? 
      (content.total_engagement / content.total_reach) * 100 : 0;
  });

  return Object.values(contentPerformance)
    .sort((a: any, b: any) => b.performance_score - a.performance_score)
    .slice(0, 10); // Top 10
}

function comparePlatforms(analytics: any[]) {
  // Group by platform and compare performance
  const platformMetrics: Record<string, any> = {};
  
  analytics?.forEach(item => {
    const platformId = item.platform_connection_id;
    if (!platformMetrics[platformId]) {
      platformMetrics[platformId] = {
        platform_id: platformId,
        total_engagement: 0,
        total_reach: 0,
        total_clicks: 0,
        total_conversions: 0
      };
    }
    
    const value = parseFloat(item.metric_value);
    switch (item.metric_type) {
      case 'engagement':
        platformMetrics[platformId].total_engagement += value;
        break;
      case 'reach':
        platformMetrics[platformId].total_reach += value;
        break;
      case 'clicks':
        platformMetrics[platformId].total_clicks += value;
        break;
      case 'conversions':
        platformMetrics[platformId].total_conversions += value;
        break;
    }
  });

  return Object.values(platformMetrics);
}

function generateRecommendations(analytics: any[]) {
  const recommendations = [];
  
  const overview = calculatePerformanceOverview(analytics);
  const trends = calculateTrends(analytics);
  
  // Basic recommendations based on data
  if (overview.total_engagement < 100) {
    recommendations.push({
      type: 'engagement',
      priority: 'high',
      message: 'Your content engagement is low. Try creating more interactive content or adjusting your posting times.'
    });
  }
  
  if (overview.average_engagement_rate < 2) {
    recommendations.push({
      type: 'content',
      priority: 'medium',
      message: 'Consider improving your content quality or relevance to increase engagement rates.'
    });
  }
  
  if (trends.length > 0) {
    const recentTrend = trends[trends.length - 1];
    if (recentTrend.engagement < recentTrend.reach * 0.02) {
      recommendations.push({
        type: 'trend',
        priority: 'medium',
        message: 'Recent posts are showing low engagement. Consider adjusting your content strategy.'
      });
    }
  }
  
  return recommendations;
}

export { router as analyticsRouter };