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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      action_log: {
        Row: {
          action: string
          agent_id: string
          created_at: string | null
          embedding: string | null
          id: string
          params: Json | null
          result: Json | null
          tool_name: string
        }
        Insert: {
          action: string
          agent_id: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          params?: Json | null
          result?: Json | null
          tool_name: string
        }
        Update: {
          action?: string
          agent_id?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          params?: Json | null
          result?: Json | null
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          activity_type: string
          agent_id: string
          conversation_id: string | null
          created_at: string | null
          description: string | null
          duration_ms: number | null
          id: string
          job_id: string | null
          metadata: Json | null
          project_id: string | null
          source: string
          status: string | null
          task_id: string | null
          title: string
        }
        Insert: {
          activity_type: string
          agent_id: string
          conversation_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_ms?: number | null
          id?: string
          job_id?: string | null
          metadata?: Json | null
          project_id?: string | null
          source: string
          status?: string | null
          task_id?: string | null
          title: string
        }
        Update: {
          activity_type?: string
          agent_id?: string
          conversation_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_ms?: number | null
          id?: string
          job_id?: string | null
          metadata?: Json | null
          project_id?: string | null
          source?: string
          status?: string | null
          task_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scheduled_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          custom_instructions: string | null
          email: string | null
          id: string
          identity_context: Json | null
          name: string
          personality: Json | null
          safety_permissions: Json | null
          title: string | null
          user_id: string
          user_preferences: Json | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          email?: string | null
          id?: string
          identity_context?: Json | null
          name: string
          personality?: Json | null
          safety_permissions?: Json | null
          title?: string | null
          user_id: string
          user_preferences?: Json | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          email?: string | null
          id?: string
          identity_context?: Json | null
          name?: string
          personality?: Json | null
          safety_permissions?: Json | null
          title?: string | null
          user_id?: string
          user_preferences?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          author_type: string
          comment_type: string | null
          content: string
          created_at: string | null
          feedback_id: string | null
          id: string
          project_id: string | null
          task_id: string | null
        }
        Insert: {
          author_id?: string | null
          author_type: string
          comment_type?: string | null
          content: string
          created_at?: string | null
          feedback_id?: string | null
          id?: string
          project_id?: string | null
          task_id?: string | null
        }
        Update: {
          author_id?: string | null
          author_type?: string
          comment_type?: string | null
          content?: string
          created_at?: string | null
          feedback_id?: string | null
          id?: string
          project_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      context_blocks: {
        Row: {
          agent_id: string
          always_include: boolean | null
          category: string | null
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          title: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          always_include?: boolean | null
          category?: string | null
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          title?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          always_include?: boolean | null
          category?: string | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          title?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "context_blocks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agent_id: string
          channel_type: string | null
          created_at: string | null
          id: string
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          channel_type?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          channel_type?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      email_attachments: {
        Row: {
          content_type: string | null
          created_at: string | null
          download_url: string | null
          download_url_expires_at: string | null
          downloaded_at: string | null
          email_id: string
          filename: string
          id: string
          is_downloaded: boolean | null
          resend_attachment_id: string | null
          size_bytes: number | null
          storage_path: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          download_url?: string | null
          download_url_expires_at?: string | null
          downloaded_at?: string | null
          email_id: string
          filename: string
          id?: string
          is_downloaded?: boolean | null
          resend_attachment_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          download_url?: string | null
          download_url_expires_at?: string | null
          downloaded_at?: string | null
          email_id?: string
          filename?: string
          id?: string
          is_downloaded?: boolean | null
          resend_attachment_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          agent_id: string
          bcc_addresses: string[] | null
          bounce_reason: string | null
          bounced_at: string | null
          cc_addresses: string[] | null
          created_at: string | null
          delivered_at: string | null
          direction: Database["public"]["Enums"]["email_direction"]
          from_address: string
          from_name: string | null
          headers: Json | null
          html_body: string | null
          id: string
          in_reply_to: string | null
          is_read: boolean | null
          message_id: string | null
          processed_at: string | null
          processed_by_agent: boolean | null
          read_at: string | null
          received_at: string | null
          references_ids: string[] | null
          reply_to_address: string | null
          resend_email_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string
          text_body: string | null
          thread_id: string | null
          to_addresses: string[]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          bcc_addresses?: string[] | null
          bounce_reason?: string | null
          bounced_at?: string | null
          cc_addresses?: string[] | null
          created_at?: string | null
          delivered_at?: string | null
          direction: Database["public"]["Enums"]["email_direction"]
          from_address: string
          from_name?: string | null
          headers?: Json | null
          html_body?: string | null
          id?: string
          in_reply_to?: string | null
          is_read?: boolean | null
          message_id?: string | null
          processed_at?: string | null
          processed_by_agent?: boolean | null
          read_at?: string | null
          received_at?: string | null
          references_ids?: string[] | null
          reply_to_address?: string | null
          resend_email_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject: string
          text_body?: string | null
          thread_id?: string | null
          to_addresses: string[]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          bcc_addresses?: string[] | null
          bounce_reason?: string | null
          bounced_at?: string | null
          cc_addresses?: string[] | null
          created_at?: string | null
          delivered_at?: string | null
          direction?: Database["public"]["Enums"]["email_direction"]
          from_address?: string
          from_name?: string | null
          headers?: Json | null
          html_body?: string | null
          id?: string
          in_reply_to?: string | null
          is_read?: boolean | null
          message_id?: string | null
          processed_at?: string | null
          processed_by_agent?: boolean | null
          read_at?: string | null
          received_at?: string | null
          references_ids?: string[] | null
          reply_to_address?: string | null
          resend_email_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
          text_body?: string | null
          thread_id?: string | null
          to_addresses?: string[]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_items: {
        Row: {
          agent_id: string
          context: Json | null
          conversation_id: string | null
          created_at: string | null
          description: string | null
          id: string
          priority: string | null
          problem: string | null
          proposed_solution: string | null
          source: string | null
          status: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          context?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          problem?: string | null
          proposed_solution?: string | null
          source?: string | null
          status?: string | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          context?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          problem?: string | null
          proposed_solution?: string | null
          source?: string | null
          status?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_items_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_items_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_executions: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string | null
          error: string | null
          id: string
          job_id: string
          result: Json | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          job_id: string
          result?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          job_id?: string
          result?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_executions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_executions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scheduled_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_leads: {
        Row: {
          agent_id: string
          bant_authority: boolean | null
          bant_budget: boolean | null
          bant_need: boolean | null
          bant_timing: boolean | null
          company: string | null
          created_at: string | null
          email: string | null
          id: string
          last_conversation_id: string | null
          linkedin_profile_url: string
          meeting_booked_at: string | null
          name: string
          notes: string | null
          status: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          bant_authority?: boolean | null
          bant_budget?: boolean | null
          bant_need?: boolean | null
          bant_timing?: boolean | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_conversation_id?: string | null
          linkedin_profile_url: string
          meeting_booked_at?: string | null
          name: string
          notes?: string | null
          status?: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          bant_authority?: boolean | null
          bant_budget?: boolean | null
          bant_need?: boolean | null
          bant_timing?: boolean | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_conversation_id?: string | null
          linkedin_profile_url?: string
          meeting_booked_at?: string | null
          name?: string
          notes?: string | null
          status?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_leads_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_leads_last_conversation_id_fkey"
            columns: ["last_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          agent_id: string
          content: string | null
          created_at: string | null
          id: string
          link_id: string | null
          link_type: string | null
          read: boolean | null
          title: string
          type: string
        }
        Insert: {
          agent_id: string
          content?: string | null
          created_at?: string | null
          id?: string
          link_id?: string | null
          link_type?: string | null
          read?: boolean | null
          title: string
          type: string
        }
        Update: {
          agent_id?: string
          content?: string | null
          created_at?: string | null
          id?: string
          link_id?: string | null
          link_type?: string | null
          read?: boolean | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          agent_id: string
          created_at: string | null
          description: string | null
          embedding: string | null
          id: string
          priority: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          agent_id: string
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          agent_id: string
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          agent_id?: string
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_jobs: {
        Row: {
          action_payload: Json | null
          action_type: string
          agent_id: string
          cancel_conditions: Json | null
          consecutive_failures: number | null
          conversation_id: string | null
          created_at: string | null
          cron_expression: string | null
          description: string | null
          id: string
          job_type: string
          last_lock_at: string | null
          last_run_at: string | null
          locked_until: string | null
          max_runs: number | null
          next_run_at: string | null
          project_id: string | null
          run_at: string | null
          run_count: number | null
          schedule_type: string
          status: string | null
          task_id: string | null
          timezone: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          action_payload?: Json | null
          action_type: string
          agent_id: string
          cancel_conditions?: Json | null
          consecutive_failures?: number | null
          conversation_id?: string | null
          created_at?: string | null
          cron_expression?: string | null
          description?: string | null
          id?: string
          job_type: string
          last_lock_at?: string | null
          last_run_at?: string | null
          locked_until?: string | null
          max_runs?: number | null
          next_run_at?: string | null
          project_id?: string | null
          run_at?: string | null
          run_count?: number | null
          schedule_type: string
          status?: string | null
          task_id?: string | null
          timezone?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          action_payload?: Json | null
          action_type?: string
          agent_id?: string
          cancel_conditions?: Json | null
          consecutive_failures?: number | null
          conversation_id?: string | null
          created_at?: string | null
          cron_expression?: string | null
          description?: string | null
          id?: string
          job_type?: string
          last_lock_at?: string | null
          last_run_at?: string | null
          locked_until?: string | null
          max_runs?: number | null
          next_run_at?: string | null
          project_id?: string | null
          run_at?: string | null
          run_count?: number | null
          schedule_type?: string
          status?: string | null
          task_id?: string | null
          timezone?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_jobs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_jobs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agent_id: string
          agent_run_state: string | null
          assignee_id: string | null
          assignee_type: string | null
          blocked_by: string[] | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          embedding: string | null
          failure_reason: string | null
          id: string
          last_agent_run_at: string | null
          lock_expires_at: string | null
          priority: string | null
          project_id: string | null
          retry_count: number | null
          status: string | null
          title: string
        }
        Insert: {
          agent_id: string
          agent_run_state?: string | null
          assignee_id?: string | null
          assignee_type?: string | null
          blocked_by?: string[] | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          embedding?: string | null
          failure_reason?: string | null
          id?: string
          last_agent_run_at?: string | null
          lock_expires_at?: string | null
          priority?: string | null
          project_id?: string | null
          retry_count?: number | null
          status?: string | null
          title: string
        }
        Update: {
          agent_id?: string
          agent_run_state?: string | null
          assignee_id?: string | null
          assignee_type?: string | null
          blocked_by?: string[] | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          embedding?: string | null
          failure_reason?: string | null
          id?: string
          last_agent_run_at?: string | null
          lock_expires_at?: string | null
          priority?: string | null
          project_id?: string | null
          retry_count?: number | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_channel_credentials: {
        Row: {
          channel_type: string
          created_at: string | null
          credentials: Json
          id: string
          is_active: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel_type: string
          created_at?: string | null
          credentials?: Json
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel_type?: string
          created_at?: string | null
          credentials?: Json
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_channel_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          preferred_notification_channel: string | null
          timezone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id: string
          name: string
          preferred_notification_channel?: string | null
          timezone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          preferred_notification_channel?: string | null
          timezone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      task_comments: {
        Row: {
          author_id: string | null
          author_type: string | null
          comment_type: string | null
          content: string | null
          created_at: string | null
          feedback_id: string | null
          id: string | null
          project_id: string | null
          task_id: string | null
        }
        Insert: {
          author_id?: string | null
          author_type?: string | null
          comment_type?: string | null
          content?: string | null
          created_at?: string | null
          feedback_id?: string | null
          id?: string | null
          project_id?: string | null
          task_id?: string | null
        }
        Update: {
          author_id?: string | null
          author_type?: string | null
          comment_type?: string | null
          content?: string | null
          created_at?: string | null
          feedback_id?: string | null
          id?: string | null
          project_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      match_messages: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_conversation_id?: string
          query_embedding: string
        }
        Returns: {
          content: string
          conversation_id: string
          id: string
          role: string
          similarity: number
        }[]
      }
      search_action_log: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_agent_id: string
          query_embedding: string
        }
        Returns: {
          action: string
          created_at: string
          id: string
          params: Json
          result: Json
          similarity: number
          tool_name: string
        }[]
      }
      search_context_blocks: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_agent_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          created_at: string
          id: string
          similarity: number
          title: string
          type: string
        }[]
      }
      search_messages: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_agent_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          similarity: number
        }[]
      }
      search_projects: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_agent_id: string
          query_embedding: string
        }
        Returns: {
          created_at: string
          description: string
          id: string
          priority: string
          similarity: number
          status: string
          title: string
        }[]
      }
      search_tasks: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_agent_id: string
          query_embedding: string
        }
        Returns: {
          created_at: string
          description: string
          due_date: string
          id: string
          priority: string
          project_id: string
          similarity: number
          status: string
          title: string
        }[]
      }
      semantic_search_all: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_agent_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          created_at: string
          metadata: Json
          similarity: number
          source_id: string
          source_type: string
          title: string
        }[]
      }
    }
    Enums: {
      email_direction: "inbound" | "outbound"
      email_status:
        | "pending"
        | "sent"
        | "delivered"
        | "bounced"
        | "failed"
        | "received"
    }
    CompositeTypes: {
      [_ in never]: never
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
  public: {
    Enums: {
      email_direction: ["inbound", "outbound"],
      email_status: [
        "pending",
        "sent",
        "delivered",
        "bounced",
        "failed",
        "received",
      ],
    },
  },
} as const

// Agent personality structure
export interface AgentPersonality {
  communication_style?: string;
  tone?: string;
  formality?: string;
  traits?: string[];
}

// User preferences structure
export interface UserPreferences {
  work_hours?: {
    start?: string;
    end?: string;
  };
  notification_preferences?: {
    email?: boolean;
    push?: boolean;
  };
  preferences?: Record<string, any>;
}

// Agent identity context (includes SDR config)
export interface AgentIdentityContext {
  sdrConfig?: {
    companyName?: string;
    productDescription?: string;
    targetAudience?: string;
    valueProposition?: string;
    outreachStrategy?: string;
    followUpCadence?: string;
  };
}

