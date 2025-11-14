-- Reward Analytics Infrastructure
-- Tracks conversion funnel and brand partnership ROI

-- Track when students view rewards (for conversion rate calculation)
CREATE TABLE IF NOT EXISTS reward_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  
  -- Context
  referral_source TEXT, -- 'browse', 'notification', 'leaderboard', 'achievement'
  session_id UUID, -- Track user session for behavior analysis
  
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_reward_views_student_id ON reward_views(student_id);
CREATE INDEX idx_reward_views_reward_id ON reward_views(reward_id);
CREATE INDEX idx_reward_views_viewed_at ON reward_views(viewed_at DESC);
CREATE INDEX idx_reward_views_referral_source ON reward_views(referral_source);

-- Enhanced redemption analytics (extends existing redemptions table)
CREATE TABLE IF NOT EXISTS redemption_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  redemption_id UUID NOT NULL REFERENCES redemptions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  
  -- Student engagement metrics (at time of redemption)
  attendance_rate DECIMAL(5,2), -- e.g., 85.50
  current_streak INTEGER,
  total_points_earned INTEGER,
  days_since_signup INTEGER,
  
  -- Conversion metrics
  redemption_value DECIMAL(10,2), -- Actual value of reward (for ROI calculation)
  time_to_redeem INTERVAL, -- Time from earning enough points to redemption
  view_to_redemption_time INTERVAL, -- Time from first view to redemption
  views_before_redemption INTEGER, -- How many times viewed before redeeming
  
  -- Brand metrics
  brand_id UUID, -- For brand partner tracking
  brand_name TEXT,
  category TEXT,
  
  -- Behavioral metrics
  repeat_redemption_count INTEGER DEFAULT 0, -- How many times redeemed from this brand
  referral_source TEXT, -- How they found this reward
  session_duration INTERVAL, -- Time spent in app before redeeming
  
  -- Device/platform
  platform TEXT, -- 'web', 'ios', 'android'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_redemption_analytics_student_id ON redemption_analytics(student_id);
CREATE INDEX idx_redemption_analytics_reward_id ON redemption_analytics(reward_id);
CREATE INDEX idx_redemption_analytics_brand_id ON redemption_analytics(brand_id);
CREATE INDEX idx_redemption_analytics_attendance_rate ON redemption_analytics(attendance_rate DESC);
CREATE INDEX idx_redemption_analytics_created_at ON redemption_analytics(created_at DESC);

-- Brand partner performance view
CREATE OR REPLACE VIEW brand_performance AS
SELECT 
  ra.brand_id,
  ra.brand_name,
  ra.category,
  
  -- Volume metrics
  COUNT(DISTINCT ra.student_id) as unique_redeemers,
  COUNT(*) as total_redemptions,
  SUM(ra.redemption_value) as total_value,
  
  -- Engagement metrics
  AVG(ra.attendance_rate) as avg_student_attendance,
  AVG(ra.current_streak) as avg_student_streak,
  AVG(ra.repeat_redemption_count) as avg_repeat_rate,
  
  -- Conversion metrics
  AVG(ra.views_before_redemption) as avg_views_to_convert,
  AVG(EXTRACT(EPOCH FROM ra.view_to_redemption_time) / 3600) as avg_hours_to_convert,
  
  -- Time period
  MIN(ra.created_at) as first_redemption,
  MAX(ra.created_at) as last_redemption
FROM redemption_analytics ra
GROUP BY ra.brand_id, ra.brand_name, ra.category;

-- Conversion funnel by engagement tier
CREATE OR REPLACE VIEW conversion_by_engagement AS
SELECT 
  CASE 
    WHEN s.attendance_rate >= 90 THEN 'High (90%+)'
    WHEN s.attendance_rate >= 70 THEN 'Medium (70-89%)'
    ELSE 'Low (<70%)'
  END as engagement_tier,
  
  -- Funnel metrics
  COUNT(DISTINCT rv.student_id) as students_who_viewed,
  COUNT(DISTINCT ra.student_id) as students_who_redeemed,
  ROUND(
    COUNT(DISTINCT ra.student_id)::DECIMAL / 
    NULLIF(COUNT(DISTINCT rv.student_id), 0) * 100, 
    2
  ) as conversion_rate,
  
  -- Value metrics
  AVG(ra.redemption_value) as avg_transaction_value,
  SUM(ra.redemption_value) as total_value,
  
  -- Behavioral metrics
  AVG(ra.repeat_redemption_count) as avg_repeat_rate
FROM (
  SELECT 
    s.id as student_id,
    ROUND(
      (SELECT COUNT(*) FROM attendance WHERE student_id = s.id AND status = 'present')::DECIMAL /
      NULLIF((SELECT COUNT(*) FROM attendance WHERE student_id = s.id), 0) * 100,
      2
    ) as attendance_rate
  FROM students s
) s
LEFT JOIN reward_views rv ON s.student_id = rv.student_id
LEFT JOIN redemption_analytics ra ON s.student_id = ra.student_id
GROUP BY engagement_tier
ORDER BY engagement_tier DESC;

-- RLS Policies
ALTER TABLE reward_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemption_analytics ENABLE ROW LEVEL SECURITY;

-- Students can insert their own views
CREATE POLICY "Students can track their own reward views"
  ON reward_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- Students can read their own analytics
CREATE POLICY "Students can read their own analytics"
  ON redemption_analytics FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

-- Service role can do everything (for analytics)
CREATE POLICY "Service role full access to reward_views"
  ON reward_views FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to redemption_analytics"
  ON redemption_analytics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE reward_views IS 'Tracks when students view rewards for conversion rate analysis';
COMMENT ON TABLE redemption_analytics IS 'Enhanced analytics for brand partnership ROI and student behavior';
COMMENT ON VIEW brand_performance IS 'Brand partner performance dashboard metrics';
COMMENT ON VIEW conversion_by_engagement IS 'Conversion funnel analysis by student engagement tier';
