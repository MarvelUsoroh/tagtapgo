import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Use @supabase/ssr for proper cookie handling
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Database types
export type Student = {
  id: string;
  university_id: string;
  external_id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  status?: string;
  grade_level?: string;
  student_number?: string;
  avatar_url?: string;
  year?: number;
  major?: string;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Attendance = {
  id: string;
  student_id: string;
  course_id: string;
  date: string;
  time?: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  source: 'manual' | 'sis' | 'nfc' | 'qr' | 'other';
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Points = {
  id: string;
  student_id: string;
  points: number;
  transaction_type: string;
  reference_id?: string;
  description?: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Streak = {
  id: string;
  student_id: string;
  current_streak: number;
  longest_streak: number;
  last_attendance_date?: string;
  freeze_count: number;
  freeze_reset_date: string;
  updated_at: string;
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  badge_image_url?: string;
  category: 'attendance' | 'streak' | 'time' | 'social' | 'reward';
  criteria: Record<string, unknown>;
  points_reward: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  created_at: string;
};

export type StudentAchievement = {
  id: string;
  student_id: string;
  achievement_id: string;
  unlocked_at: string;
  progress: Record<string, unknown>;
  achievement?: Achievement;
};

export type Leaderboard = {
  id: string;
  student_id: string;
  leaderboard_type: 'class' | 'year' | 'school' | 'friend';
  period: 'weekly' | 'monthly' | 'all_time';
  course_id?: string | null;
  primary_course_id?: string | null; // New field for class leaderboard grouping
  rank: number;
  points: number;
  current_streak?: number;
  longest_streak?: number;
  score?: number;
  period_start: string;
  period_end?: string;
  updated_at: string;
  student?: Student;
};

export type Reward = {
  id: string;
  brand: string;
  name: string;
  description?: string;
  image_url?: string;
  points_cost: number;
  category?: string;
  commission_rate: number;
  stock: number;
  expiry_days: number;
  terms?: string;
  active: boolean;
  created_at: string;
};

export type Redemption = {
  id: string;
  student_id: string;
  reward_id: string;
  points_spent: number;
  redemption_code: string;
  status: 'pending' | 'issued' | 'used' | 'expired' | 'cancelled';
  issued_at?: string;
  used_at?: string;
  expires_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  reward?: Reward;
};

export type Challenge = {
  id: string;
  challenge_type: 'peer' | 'class' | 'school';
  name: string;
  description?: string;
  creator_id?: string;
  course_id?: string;
  goal: Record<string, unknown>;
  start_date: string;
  end_date: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  reward_points: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Notification = {
  id: string;
  student_id: string;
  notification_type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
};
