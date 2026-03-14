export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          badge_image_url: string | null
          category: string
          created_at: string
          criteria: Json
          description: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          points_reward: number
          rarity: string
          updated_at: string
        }
        Insert: {
          badge_image_url?: string | null
          category: string
          created_at?: string
          criteria: Json
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          points_reward?: number
          rarity: string
          updated_at?: string
        }
        Update: {
          badge_image_url?: string | null
          category?: string
          created_at?: string
          criteria?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          points_reward?: number
          rarity?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          check_in_time: string | null
          class_id: string | null
          course_id: string
          created_at: string
          date: string | null
          id: string
          metadata: Json
          period: string | null
          recorded_at: string | null
          scheduled_time: string | null
          session_id: string | null
          source: string
          source_tz: string | null
          status: string
          status_code: string | null
          student_id: string
          time: string | null
          university_id: string
          updated_at: string
        }
        Insert: {
          check_in_time?: string | null
          class_id?: string | null
          course_id: string
          created_at?: string
          date?: string | null
          id?: string
          metadata?: Json
          period?: string | null
          recorded_at?: string | null
          scheduled_time?: string | null
          session_id?: string | null
          source?: string
          source_tz?: string | null
          status: string
          status_code?: string | null
          student_id: string
          time?: string | null
          university_id: string
          updated_at?: string
        }
        Update: {
          check_in_time?: string | null
          class_id?: string | null
          course_id?: string
          created_at?: string
          date?: string | null
          id?: string
          metadata?: Json
          period?: string | null
          recorded_at?: string | null
          scheduled_time?: string | null
          session_id?: string | null
          source?: string
          source_tz?: string | null
          status?: string
          status_code?: string | null
          student_id?: string
          time?: string | null
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          id: string
          joined_at: string
          progress: Json
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          challenge_id: string
          id?: string
          joined_at?: string
          progress?: Json
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          challenge_id?: string
          id?: string
          joined_at?: string
          progress?: Json
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          challenge_type: string
          course_id: string | null
          created_at: string
          creator_id: string | null
          description: string | null
          end_date: string
          goal: Json
          id: string
          metadata: Json
          name: string
          reward_points: number
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          challenge_type: string
          course_id?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          end_date: string
          goal?: Json
          id?: string
          metadata?: Json
          name: string
          reward_points?: number
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          challenge_type?: string
          course_id?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          end_date?: string
          goal?: Json
          id?: string
          metadata?: Json
          name?: string
          reward_points?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_mentions: {
        Row: {
          created_at: string
          id: string
          mentioned_user_id: string
          message_id: string
          notified_at: string | null
          read: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          mentioned_user_id: string
          message_id: string
          notified_at?: string | null
          read?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          mentioned_user_id?: string
          message_id?: string
          notified_at?: string | null
          read?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chat_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachments: Json | null
          author_id: string
          content: string
          course_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          parent_id: string | null
          search_vector: unknown
          university_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          author_id: string
          content: string
          course_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_id?: string | null
          search_vector?: unknown
          university_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          author_id?: string
          content?: string
          course_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_id?: string | null
          search_vector?: unknown
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_read_receipts: {
        Row: {
          last_read_at: string
          university_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          university_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          university_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_read_receipts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_read_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_read_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      class_feedback: {
        Row: {
          clarity: number | null
          class_id: string | null
          class_schedule_id: string
          comments: string | null
          content_quality: number | null
          course_id: string | null
          created_at: string
          id: string
          metadata: Json
          pace: number | null
          student_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          clarity?: number | null
          class_id?: string | null
          class_schedule_id: string
          comments?: string | null
          content_quality?: number | null
          course_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          pace?: number | null
          student_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          clarity?: number | null
          class_id?: string | null
          class_schedule_id?: string
          comments?: string | null
          content_quality?: number | null
          course_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          pace?: number | null
          student_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_feedback_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_feedback_class_schedule_id_fkey"
            columns: ["class_schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_feedback_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedules: {
        Row: {
          class_id: string | null
          course_id: string
          created_at: string
          day_of_week: string
          effective_from: string
          effective_to: string
          end_time: string
          id: string
          instructor_id: string | null
          location: string | null
          metadata: Json
          period: string | null
          start_time: string
          university_id: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          course_id: string
          created_at?: string
          day_of_week: string
          effective_from: string
          effective_to: string
          end_time: string
          id?: string
          instructor_id?: string | null
          location?: string | null
          metadata?: Json
          period?: string | null
          start_time: string
          university_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          course_id?: string
          created_at?: string
          day_of_week?: string
          effective_from?: string
          effective_to?: string
          end_time?: string
          id?: string
          instructor_id?: string | null
          location?: string | null
          metadata?: Json
          period?: string | null
          start_time?: string
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          capacity: number | null
          course_id: string
          created_at: string
          end_date: string | null
          id: string
          instructor_email: string | null
          instructor_name: string | null
          location: string | null
          metadata: Json
          section: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          course_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          instructor_email?: string | null
          instructor_name?: string | null
          location?: string | null
          metadata?: Json
          section?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          course_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          instructor_email?: string | null
          instructor_name?: string | null
          location?: string | null
          metadata?: Json
          section?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          description: string | null
          end_at: string | null
          external_id: string | null
          id: string
          metadata: Json
          name: string
          schedule: Json | null
          short_name: string | null
          start_at: string | null
          university_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json
          name: string
          schedule?: Json | null
          short_name?: string | null
          start_at?: string | null
          university_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json
          name?: string
          schedule?: Json | null
          short_name?: string | null
          start_at?: string | null
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_job_executions: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          job_name: string
          metadata: Json
          records_failed: number | null
          records_processed: number | null
          records_succeeded: number | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          job_name: string
          metadata?: Json
          records_failed?: number | null
          records_processed?: number | null
          records_succeeded?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          job_name?: string
          metadata?: Json
          records_failed?: number | null
          records_processed?: number | null
          records_succeeded?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          created_at: string
          enrolled_at: string
          id: string
          metadata: Json
          role: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          enrolled_at?: string
          id?: string
          metadata?: Json
          role?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          enrolled_at?: string
          id?: string
          metadata?: Json
          role?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_conversations: {
        Row: {
          class_schedule_id: string
          completed_at: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          points_awarded: number | null
          sentiment_score: number | null
          started_at: string | null
          status: string | null
          student_id: string
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          class_schedule_id: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          points_awarded?: number | null
          sentiment_score?: number | null
          started_at?: string | null
          status?: string | null
          student_id: string
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          class_schedule_id?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          points_awarded?: number | null
          sentiment_score?: number | null
          started_at?: string | null
          status?: string | null
          student_id?: string
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_conversations_class_schedule_id_fkey"
            columns: ["class_schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_conversations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_conversations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          sender_type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          sender_type: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "feedback_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_prompts: {
        Row: {
          class_schedule_id: string
          completed_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          last_reminder_sent_at: string | null
          metadata: Json
          prompt_sent_at: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          class_schedule_id: string
          completed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_reminder_sent_at?: string | null
          metadata?: Json
          prompt_sent_at?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          class_schedule_id?: string
          completed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_reminder_sent_at?: string | null
          metadata?: Json
          prompt_sent_at?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_prompts_class_schedule_id_fkey"
            columns: ["class_schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_prompts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_prompts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friends_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friends_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friends_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friends_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboards: {
        Row: {
          course_id: string | null
          created_at: string
          current_streak: number
          id: string
          leaderboard_type: string
          longest_streak: number
          metadata: Json
          period: string
          period_end: string | null
          period_start: string
          points: number
          primary_course_id: string | null
          rank: number
          score: number | null
          student_avatar_url: string | null
          student_id: string
          student_name: string | null
          university_id: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          current_streak?: number
          id?: string
          leaderboard_type: string
          longest_streak?: number
          metadata?: Json
          period: string
          period_end?: string | null
          period_start: string
          points: number
          primary_course_id?: string | null
          rank: number
          score?: number | null
          student_avatar_url?: string | null
          student_id: string
          student_name?: string | null
          university_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          current_streak?: number
          id?: string
          leaderboard_type?: string
          longest_streak?: number
          metadata?: Json
          period?: string
          period_end?: string | null
          period_start?: string
          points?: number
          primary_course_id?: string | null
          rank?: number
          score?: number | null
          student_avatar_url?: string | null
          student_id?: string
          student_name?: string | null
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_leaderboards_primary_course"
            columns: ["primary_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboards_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboards_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json
          id: string
          message: string
          notification_type: string
          read: boolean
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          message: string
          notification_type: string
          read?: boolean
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          message?: string
          notification_type?: string
          read?: boolean
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      points: {
        Row: {
          created_at: string
          description: string | null
          id: string
          metadata: Json
          points: number
          reference_id: string
          student_id: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          points: number
          reference_id: string
          student_id: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          points?: number
          reference_id?: string
          student_id?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          id: string
          student_id: string
          subscription: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          student_id: string
          subscription: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          student_id?: string
          subscription?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      redemption_analytics: {
        Row: {
          attendance_rate: number | null
          brand_id: string | null
          brand_name: string | null
          category: string | null
          created_at: string | null
          current_streak: number | null
          days_since_signup: number | null
          id: string
          platform: string | null
          redemption_id: string
          redemption_value: number | null
          referral_source: string | null
          repeat_redemption_count: number | null
          reward_id: string
          session_duration: string | null
          student_id: string
          time_to_redeem: string | null
          total_points_earned: number | null
          view_to_redemption_time: string | null
          views_before_redemption: number | null
        }
        Insert: {
          attendance_rate?: number | null
          brand_id?: string | null
          brand_name?: string | null
          category?: string | null
          created_at?: string | null
          current_streak?: number | null
          days_since_signup?: number | null
          id?: string
          platform?: string | null
          redemption_id: string
          redemption_value?: number | null
          referral_source?: string | null
          repeat_redemption_count?: number | null
          reward_id: string
          session_duration?: string | null
          student_id: string
          time_to_redeem?: string | null
          total_points_earned?: number | null
          view_to_redemption_time?: string | null
          views_before_redemption?: number | null
        }
        Update: {
          attendance_rate?: number | null
          brand_id?: string | null
          brand_name?: string | null
          category?: string | null
          created_at?: string | null
          current_streak?: number | null
          days_since_signup?: number | null
          id?: string
          platform?: string | null
          redemption_id?: string
          redemption_value?: number | null
          referral_source?: string | null
          repeat_redemption_count?: number | null
          reward_id?: string
          session_duration?: string | null
          student_id?: string
          time_to_redeem?: string | null
          total_points_earned?: number | null
          view_to_redemption_time?: string | null
          views_before_redemption?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "redemption_analytics_redemption_id_fkey"
            columns: ["redemption_id"]
            isOneToOne: false
            referencedRelation: "redemptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemption_analytics_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemption_analytics_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemption_analytics_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      redemptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          issued_at: string | null
          metadata: Json
          points_spent: number
          redemption_code: string
          reward_id: string
          status: string
          student_id: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          metadata?: Json
          points_spent: number
          redemption_code?: string
          reward_id: string
          status?: string
          student_id: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          metadata?: Json
          points_spent?: number
          redemption_code?: string
          reward_id?: string
          status?: string
          student_id?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_views: {
        Row: {
          id: string
          referral_source: string | null
          reward_id: string
          session_id: string | null
          student_id: string
          viewed_at: string | null
        }
        Insert: {
          id?: string
          referral_source?: string | null
          reward_id: string
          session_id?: string | null
          student_id: string
          viewed_at?: string | null
        }
        Update: {
          id?: string
          referral_source?: string | null
          reward_id?: string
          session_id?: string | null
          student_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_views_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_views_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_views_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          active: boolean
          brand: string
          category: string | null
          commission_rate: number
          created_at: string
          description: string | null
          expiry_days: number
          id: string
          image_url: string | null
          metadata: Json
          name: string
          points_cost: number
          stock: number
          terms: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand: string
          category?: string | null
          commission_rate?: number
          created_at?: string
          description?: string | null
          expiry_days?: number
          id?: string
          image_url?: string | null
          metadata?: Json
          name: string
          points_cost: number
          stock?: number
          terms?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string
          category?: string | null
          commission_rate?: number
          created_at?: string
          description?: string | null
          expiry_days?: number
          id?: string
          image_url?: string | null
          metadata?: Json
          name?: string
          points_cost?: number
          stock?: number
          terms?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      streaks: {
        Row: {
          created_at: string
          current_streak: number
          freeze_count: number | null
          freeze_reset_date: string | null
          id: string
          last_attendance_date: string | null
          last_freeze_used_at: string | null
          longest_streak: number
          streak_freeze_count: number
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          freeze_count?: number | null
          freeze_reset_date?: string | null
          id?: string
          last_attendance_date?: string | null
          last_freeze_used_at?: string | null
          longest_streak?: number
          streak_freeze_count?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          freeze_count?: number | null
          freeze_reset_date?: string | null
          id?: string
          last_attendance_date?: string | null
          last_freeze_used_at?: string | null
          longest_streak?: number
          streak_freeze_count?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "streaks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "streaks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      student_achievements: {
        Row: {
          achievement_id: string
          created_at: string
          id: string
          last_progress_at: string | null
          metadata: Json
          progress: Json
          student_id: string
          unlocked: boolean
          unlocked_at: string | null
          updated_at: string
        }
        Insert: {
          achievement_id: string
          created_at?: string
          id?: string
          last_progress_at?: string | null
          metadata?: Json
          progress?: Json
          student_id: string
          unlocked?: boolean
          unlocked_at?: string | null
          updated_at?: string
        }
        Update: {
          achievement_id?: string
          created_at?: string
          id?: string
          last_progress_at?: string | null
          metadata?: Json
          progress?: Json
          student_id?: string
          unlocked?: boolean
          unlocked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements_with_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_achievements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_achievements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          external_id: string
          first_name: string | null
          full_name: string | null
          grade_level: string | null
          id: string
          last_name: string | null
          major: string | null
          metadata: Json
          settings: Json
          status: string | null
          student_number: string | null
          university_id: string
          updated_at: string
          username: string | null
          year: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          external_id: string
          first_name?: string | null
          full_name?: string | null
          grade_level?: string | null
          id?: string
          last_name?: string | null
          major?: string | null
          metadata?: Json
          settings?: Json
          status?: string | null
          student_number?: string | null
          university_id: string
          updated_at?: string
          username?: string | null
          year?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          external_id?: string
          first_name?: string | null
          full_name?: string | null
          grade_level?: string | null
          id?: string
          last_name?: string | null
          major?: string | null
          metadata?: Json
          settings?: Json
          status?: string | null
          student_number?: string | null
          university_id?: string
          updated_at?: string
          username?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          metadata: Json
          records_processed: number | null
          status: string
          sync_type: string
          university_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json
          records_processed?: number | null
          status: string
          sync_type?: string
          university_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json
          records_processed?: number | null
          status?: string
          sync_type?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          active: boolean
          api_config: Json
          created_at: string
          domain: string | null
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          metadata: Json
          name: string
          sis_type: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          api_config?: Json
          created_at?: string
          domain?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          metadata?: Json
          name: string
          sis_type: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          api_config?: Json
          created_at?: string
          domain?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          metadata?: Json
          name?: string
          sis_type?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      achievements_with_progress: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string | null
          name: string | null
          points_reward: number | null
          rarity: string | null
          student_achievement_id: string | null
          student_unlocked_at: string | null
        }
        Relationships: []
      }
      brand_performance: {
        Row: {
          avg_hours_to_convert: number | null
          avg_repeat_rate: number | null
          avg_student_attendance: number | null
          avg_student_streak: number | null
          avg_views_to_convert: number | null
          brand_id: string | null
          brand_name: string | null
          category: string | null
          first_redemption: string | null
          last_redemption: string | null
          total_redemptions: number | null
          total_value: number | null
          unique_redeemers: number | null
        }
        Relationships: []
      }
      conversion_by_engagement: {
        Row: {
          avg_repeat_rate: number | null
          avg_transaction_value: number | null
          conversion_rate: number | null
          engagement_tier: string | null
          students_who_redeemed: number | null
          students_who_viewed: number | null
          total_value: number | null
        }
        Relationships: []
      }
      cron_job_executions_recent: {
        Row: {
          command: string | null
          database: string | null
          end_time: string | null
          job_pid: number | null
          jobid: number | null
          jobname: string | null
          return_message: string | null
          runid: number | null
          start_time: string | null
          status: string | null
          username: string | null
        }
        Relationships: []
      }
      cron_job_health: {
        Row: {
          failed_runs: number | null
          jobid: number | null
          jobname: string | null
          last_run_time: string | null
          success_rate: number | null
          successful_runs: number | null
          total_runs: number | null
        }
        Relationships: []
      }
      student_points_balance: {
        Row: {
          student_id: string | null
          total_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "points_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_display"
            referencedColumns: ["id"]
          },
        ]
      }
      students_display: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          external_id: string | null
          first_name: string | null
          formal_name: string | null
          full_name: string | null
          grade_level: string | null
          id: string | null
          last_name: string | null
          major: string | null
          metadata: Json | null
          settings: Json | null
          short_name: string | null
          status: string | null
          student_number: string | null
          university_id: string | null
          updated_at: string | null
          username: string | null
          year: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: never
          email?: string | null
          external_id?: string | null
          first_name?: string | null
          formal_name?: never
          full_name?: string | null
          grade_level?: string | null
          id?: string | null
          last_name?: string | null
          major?: string | null
          metadata?: Json | null
          settings?: Json | null
          short_name?: never
          status?: string | null
          student_number?: string | null
          university_id?: string | null
          updated_at?: string | null
          username?: string | null
          year?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: never
          email?: string | null
          external_id?: string | null
          first_name?: string | null
          formal_name?: never
          full_name?: string | null
          grade_level?: string | null
          id?: string | null
          last_name?: string | null
          major?: string | null
          metadata?: Json | null
          settings?: Json | null
          short_name?: never
          status?: string | null
          student_number?: string | null
          university_id?: string | null
          updated_at?: string | null
          username?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      bytea_to_text: { Args: { data: string }; Returns: string }
      execute_attendance_sync_job: { Args: never; Returns: undefined }
      generate_redemption_code: { Args: never; Returns: string }
      get_achievements_stats: { Args: { p_student_id: string }; Returns: Json }
      get_my_university_id: { Args: never; Returns: string }
      get_vault_secret: { Args: { p_name: string }; Returns: string }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      text_to_bytea: { Args: { data: string }; Returns: string }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
