export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Typed structures for agent configuration
export interface AgentPersonality {
  traits?: string[];
  style?: string;
  tone?: string;
  background?: string;
}

export interface UserPreferences {
  response_style?: "concise" | "detailed" | "balanced";
  verbosity?: "brief" | "moderate" | "verbose";
  use_bullet_points?: boolean;
  proactive_suggestions?: boolean;
  confirm_before_actions?: boolean;
  preferred_communication?: string;
}

// SDR Configuration for LinkedIn SDR mode
export interface SDRConfig {
  // Company info
  companyName: string;
  companyDescription: string;
  industries?: string;
  elevatorPitch?: string;
  founderStory?: string;
  videoOverviewUrl?: string;
  
  // ICP criteria
  icpCriteria?: string[];
  icpPositiveSignals?: string[];
  icpNegativeSignals?: string[];
  
  // Templates
  quickIntroTemplate?: string;
  
  // Settings
  minimumRevenue?: string;
  targetTitles?: string[];
}

export interface AgentIdentityContext {
  role?: string;
  capabilities?: string[];
  owner?: {
    name?: string;
    company?: string;
    role?: string;
    timezone?: string;
  };
  // SDR-specific configuration
  sdrConfig?: SDRConfig;
}

// Safety permissions for agent actions
export interface AgentSafetyPermissions {
  require_confirmation: string[];
  auto_approve: string[];
}

// Task status types
export type TaskStatus = "todo" | "in_progress" | "waiting_on" | "done";

// Task assignee types
export type AssigneeType = "user" | "agent";

// Agent run state for automation
export type AgentRunState = "not_started" | "running" | "needs_input" | "failed" | "completed";

// Comment types for task/project/feedback activity
export type CommentType = "progress" | "question" | "note" | "resolution" | "approval_request" | "approval_granted" | "status_change";

// Author types for comments
export type CommentAuthorType = "user" | "agent" | "system";

// Feedback types
export type FeedbackType = "feature_request" | "bug_report";
export type FeedbackStatus = "new" | "under_review" | "planned" | "in_progress" | "done" | "wont_fix";
export type FeedbackSource = "manual" | "automatic" | "agent_error";
export type FeedbackPriority = "critical" | "high" | "medium" | "low";

// Channel types
export type ChannelType = "app" | "slack" | "email" | "sms" | "discord" | "zapier_mcp" | "linkedin";

// Database-level channel type (subset that can be stored)
export type StorableChannelType = "slack" | "email" | "sms" | "discord" | "zapier_mcp" | "linkedin";

// Slack-specific credentials
export interface SlackCredentials {
  bot_token: string;
  app_token: string;
  user_slack_id: string;
  team_id?: string;
  team_name?: string;
  default_channel_id?: string;
}

// Email-specific credentials (for future use)
export interface EmailCredentials {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  from_address?: string;
}

// Zapier MCP credentials for email/calendar integration
export interface ZapierMCPCredentials {
  endpoint_url: string;
  api_key?: string; // Optional API key for authentication
  capabilities: {
    check_email: boolean;
    send_email: boolean;
    check_calendar: boolean;
  };
  description?: string; // User-friendly description
  email_signature?: string; // HTML email signature to append to outgoing emails
}

// LinkedIn SDR extension credentials
export interface LinkedInCredentials {
  extension_token: string;
  extension_id?: string;
  user_linkedin_id?: string;
  user_linkedin_name?: string;
  capabilities: {
    auto_respond: boolean;
    draft_mode: boolean;
    active_hours_only: boolean;
  };
  settings: {
    response_delay_seconds?: number; // Delay before responding (simulate human)
    active_hours_start?: string; // e.g., "09:00"
    active_hours_end?: string; // e.g., "17:00"
    active_days?: string[]; // e.g., ["monday", "tuesday", ...]
  };
  token_expires_at?: string;
}

// Union type for all channel credentials
export type ChannelCredentials = SlackCredentials | EmailCredentials | ZapierMCPCredentials | LinkedInCredentials | Record<string, unknown>;

// Action payload with preferred channel support
export interface ActionPayload {
  message?: string;
  instruction?: string;
  preferred_channel?: ChannelType;
  slack_channel_id?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

// Message metadata with channel source tracking
export interface MessageMetadata extends Record<string, unknown> {
  type?: "scheduled_notification" | "scheduled_agent_task" | "daily_brief" | "slack_message" | "incoming_email" | "linkedin_message";
  job_id?: string;
  job_type?: string;
  instruction?: string;
  date?: string;
  channel_source?: ChannelType;
  slack_channel_id?: string;
  slack_thread_ts?: string;
  slack_user_id?: string;
  email_from?: string;
  email_subject?: string;
  email_message_id?: string;
  // LinkedIn-specific metadata
  linkedin_conversation_id?: string;
  linkedin_profile_url?: string;
  linkedin_message_id?: string;
  linkedin_sender_name?: string;
  linkedin_sender_title?: string;
  linkedin_sender_company?: string;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          timezone: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          timezone?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          timezone?: string | null;
          created_at?: string | null;
        };
      };
      agents: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          email: string | null;
          title: string | null;
          avatar_url: string | null;
          personality: Json | null;
          user_preferences: Json | null;
          identity_context: Json | null;
          safety_permissions: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          email?: string | null;
          title?: string | null;
          avatar_url?: string | null;
          personality?: Json | null;
          user_preferences?: Json | null;
          identity_context?: Json | null;
          safety_permissions?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          email?: string | null;
          title?: string | null;
          avatar_url?: string | null;
          personality?: Json | null;
          user_preferences?: Json | null;
          identity_context?: Json | null;
          safety_permissions?: Json | null;
          created_at?: string | null;
        };
      };
      conversations: {
        Row: {
          id: string;
          agent_id: string;
          title: string | null;
          channel_type: string | null;
          status: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          title?: string | null;
          channel_type?: string | null;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          agent_id?: string;
          title?: string | null;
          channel_type?: string | null;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          embedding: number[] | null;
          metadata: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          embedding?: number[] | null;
          metadata?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: "user" | "assistant" | "system";
          content?: string;
          embedding?: number[] | null;
          metadata?: Json | null;
          created_at?: string | null;
        };
      };
      context_blocks: {
        Row: {
          id: string;
          agent_id: string;
          type: "identity" | "user_profile" | "tools" | "preferences";
          title: string | null;
          content: string;
          embedding: number[] | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          type: "identity" | "user_profile" | "tools" | "preferences";
          title?: string | null;
          content: string;
          embedding?: number[] | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          agent_id?: string;
          type?: "identity" | "user_profile" | "tools" | "preferences";
          title?: string | null;
          content?: string;
          embedding?: number[] | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      projects: {
        Row: {
          id: string;
          agent_id: string;
          title: string;
          description: string | null;
          status: "active" | "paused" | "completed" | null;
          priority: "high" | "medium" | "low" | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          title: string;
          description?: string | null;
          status?: "active" | "paused" | "completed" | null;
          priority?: "high" | "medium" | "low" | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          agent_id?: string;
          title?: string;
          description?: string | null;
          status?: "active" | "paused" | "completed" | null;
          priority?: "high" | "medium" | "low" | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      tasks: {
        Row: {
          id: string;
          agent_id: string;
          project_id: string | null;
          title: string;
          description: string | null;
          status: TaskStatus | null;
          priority: "high" | "medium" | "low" | null;
          due_date: string | null;
          created_at: string | null;
          completed_at: string | null;
          // Assignee fields
          assignee_type: AssigneeType | null;
          assignee_id: string | null;
          // Dependency tracking
          blocked_by: string[] | null;
          // Agent automation fields
          agent_run_state: AgentRunState | null;
          last_agent_run_at: string | null;
          lock_expires_at: string | null;
          failure_reason: string | null;
          retry_count: number | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          project_id?: string | null;
          title: string;
          description?: string | null;
          status?: TaskStatus | null;
          priority?: "high" | "medium" | "low" | null;
          due_date?: string | null;
          created_at?: string | null;
          completed_at?: string | null;
          assignee_type?: AssigneeType | null;
          assignee_id?: string | null;
          blocked_by?: string[] | null;
          agent_run_state?: AgentRunState | null;
          last_agent_run_at?: string | null;
          lock_expires_at?: string | null;
          failure_reason?: string | null;
          retry_count?: number | null;
        };
        Update: {
          id?: string;
          agent_id?: string;
          project_id?: string | null;
          title?: string;
          description?: string | null;
          status?: TaskStatus | null;
          priority?: "high" | "medium" | "low" | null;
          due_date?: string | null;
          created_at?: string | null;
          completed_at?: string | null;
          assignee_type?: AssigneeType | null;
          assignee_id?: string | null;
          blocked_by?: string[] | null;
          agent_run_state?: AgentRunState | null;
          last_agent_run_at?: string | null;
          lock_expires_at?: string | null;
          failure_reason?: string | null;
          retry_count?: number | null;
        };
      };
      // Renamed from task_comments - now supports tasks, projects, and feedback
      comments: {
        Row: {
          id: string;
          task_id: string | null;
          project_id: string | null;
          feedback_id: string | null;
          author_type: CommentAuthorType;
          author_id: string | null;
          content: string;
          comment_type: CommentType | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          task_id?: string | null;
          project_id?: string | null;
          feedback_id?: string | null;
          author_type: CommentAuthorType;
          author_id?: string | null;
          content: string;
          comment_type?: CommentType | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string | null;
          project_id?: string | null;
          feedback_id?: string | null;
          author_type?: CommentAuthorType;
          author_id?: string | null;
          content?: string;
          comment_type?: CommentType | null;
          created_at?: string | null;
        };
      };
      // Backward-compatible view pointing to comments table
      task_comments: {
        Row: {
          id: string;
          task_id: string | null;
          project_id: string | null;
          feedback_id: string | null;
          author_type: CommentAuthorType;
          author_id: string | null;
          content: string;
          comment_type: CommentType | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          task_id?: string | null;
          project_id?: string | null;
          feedback_id?: string | null;
          author_type: CommentAuthorType;
          author_id?: string | null;
          content: string;
          comment_type?: CommentType | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string | null;
          project_id?: string | null;
          feedback_id?: string | null;
          author_type?: CommentAuthorType;
          author_id?: string | null;
          content?: string;
          comment_type?: CommentType | null;
          created_at?: string | null;
        };
      };
      feedback_items: {
        Row: {
          id: string;
          agent_id: string;
          type: FeedbackType;
          title: string;
          description: string | null;
          problem: string | null;
          proposed_solution: string | null;
          context: Json | null;
          priority: FeedbackPriority | null;
          status: FeedbackStatus | null;
          source: FeedbackSource | null;
          conversation_id: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          type: FeedbackType;
          title: string;
          description?: string | null;
          problem?: string | null;
          proposed_solution?: string | null;
          context?: Json | null;
          priority?: FeedbackPriority | null;
          status?: FeedbackStatus | null;
          source?: FeedbackSource | null;
          conversation_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          agent_id?: string;
          type?: FeedbackType;
          title?: string;
          description?: string | null;
          problem?: string | null;
          proposed_solution?: string | null;
          context?: Json | null;
          priority?: FeedbackPriority | null;
          status?: FeedbackStatus | null;
          source?: FeedbackSource | null;
          conversation_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      action_log: {
        Row: {
          id: string;
          agent_id: string;
          tool_name: string;
          action: string;
          params: Json | null;
          result: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          tool_name: string;
          action: string;
          params?: Json | null;
          result?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          agent_id?: string;
          tool_name?: string;
          action?: string;
          params?: Json | null;
          result?: Json | null;
          created_at?: string | null;
        };
      };
      scheduled_jobs: {
        Row: {
          id: string;
          agent_id: string;
          job_type: "reminder" | "follow_up" | "recurring" | "one_time";
          title: string;
          description: string | null;
          schedule_type: "once" | "cron";
          run_at: string | null;
          cron_expression: string | null;
          timezone: string | null;
          action_type: "notify" | "agent_task" | "webhook";
          action_payload: Json;
          task_id: string | null;
          project_id: string | null;
          conversation_id: string | null;
          cancel_conditions: Json;
          status: "active" | "paused" | "completed" | "cancelled";
          last_run_at: string | null;
          next_run_at: string | null;
          run_count: number;
          max_runs: number | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          job_type: "reminder" | "follow_up" | "recurring" | "one_time";
          title: string;
          description?: string | null;
          schedule_type: "once" | "cron";
          run_at?: string | null;
          cron_expression?: string | null;
          timezone?: string | null;
          action_type: "notify" | "agent_task" | "webhook";
          action_payload?: Json;
          task_id?: string | null;
          project_id?: string | null;
          conversation_id?: string | null;
          cancel_conditions?: Json;
          status?: "active" | "paused" | "completed" | "cancelled";
          last_run_at?: string | null;
          next_run_at?: string | null;
          run_count?: number;
          max_runs?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          agent_id?: string;
          job_type?: "reminder" | "follow_up" | "recurring" | "one_time";
          title?: string;
          description?: string | null;
          schedule_type?: "once" | "cron";
          run_at?: string | null;
          cron_expression?: string | null;
          timezone?: string | null;
          action_type?: "notify" | "agent_task" | "webhook";
          action_payload?: Json;
          task_id?: string | null;
          project_id?: string | null;
          conversation_id?: string | null;
          cancel_conditions?: Json;
          status?: "active" | "paused" | "completed" | "cancelled";
          last_run_at?: string | null;
          next_run_at?: string | null;
          run_count?: number;
          max_runs?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      job_executions: {
        Row: {
          id: string;
          job_id: string;
          agent_id: string;
          started_at: string | null;
          completed_at: string | null;
          status: "running" | "success" | "failed" | "skipped" | null;
          result: Json | null;
          error: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          job_id: string;
          agent_id: string;
          started_at?: string | null;
          completed_at?: string | null;
          status?: "running" | "success" | "failed" | "skipped" | null;
          result?: Json | null;
          error?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          job_id?: string;
          agent_id?: string;
          started_at?: string | null;
          completed_at?: string | null;
          status?: "running" | "success" | "failed" | "skipped" | null;
          result?: Json | null;
          error?: string | null;
          created_at?: string | null;
        };
      };
      notifications: {
        Row: {
          id: string;
          agent_id: string;
          type: "reminder" | "new_message" | "task_update" | "project_update";
          title: string;
          content: string | null;
          link_type: "conversation" | "task" | "project" | "reminder" | null;
          link_id: string | null;
          read: boolean;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          type: "reminder" | "new_message" | "task_update" | "project_update";
          title: string;
          content?: string | null;
          link_type?: "conversation" | "task" | "project" | "reminder" | null;
          link_id?: string | null;
          read?: boolean;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          agent_id?: string;
          type?: "reminder" | "new_message" | "task_update" | "project_update";
          title?: string;
          content?: string | null;
          link_type?: "conversation" | "task" | "project" | "reminder" | null;
          link_id?: string | null;
          read?: boolean;
          created_at?: string | null;
        };
      };
      user_channel_credentials: {
        Row: {
          id: string;
          user_id: string;
          channel_type: "slack" | "email" | "sms" | "discord" | "zapier_mcp" | "linkedin";
          credentials: Json;
          is_active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          channel_type: "slack" | "email" | "sms" | "discord" | "zapier_mcp" | "linkedin";
          credentials: Json;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          channel_type?: "slack" | "email" | "sms" | "discord" | "zapier_mcp" | "linkedin";
          credentials?: Json;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      // LinkedIn leads tracking for SDR functionality
      linkedin_leads: {
        Row: {
          id: string;
          agent_id: string;
          linkedin_profile_url: string;
          name: string;
          company: string | null;
          title: string | null;
          email: string | null;
          status: "new" | "qualified" | "meeting_booked" | "closed" | "disqualified";
          bant_budget: boolean | null;
          bant_authority: boolean | null;
          bant_need: boolean | null;
          bant_timing: boolean | null;
          notes: string | null;
          last_conversation_id: string | null;
          meeting_booked_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          linkedin_profile_url: string;
          name: string;
          company?: string | null;
          title?: string | null;
          email?: string | null;
          status?: "new" | "qualified" | "meeting_booked" | "closed" | "disqualified";
          bant_budget?: boolean | null;
          bant_authority?: boolean | null;
          bant_need?: boolean | null;
          bant_timing?: boolean | null;
          notes?: string | null;
          last_conversation_id?: string | null;
          meeting_booked_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          agent_id?: string;
          linkedin_profile_url?: string;
          name?: string;
          company?: string | null;
          title?: string | null;
          email?: string | null;
          status?: "new" | "qualified" | "meeting_booked" | "closed" | "disqualified";
          bant_budget?: boolean | null;
          bant_authority?: boolean | null;
          bant_need?: boolean | null;
          bant_timing?: boolean | null;
          notes?: string | null;
          last_conversation_id?: string | null;
          meeting_booked_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      activity_log: {
        Row: {
          id: string;
          agent_id: string;
          activity_type: "tool_call" | "cron_execution" | "email_sent" | "email_received" | "research" | "memory_saved" | "task_created" | "task_updated" | "project_created" | "project_updated" | "reminder_created" | "job_scheduled" | "notification_sent" | "slack_message" | "webhook_triggered" | "error" | "system";
          source: "chat" | "cron" | "webhook" | "slack" | "email" | "system";
          title: string;
          description: string | null;
          metadata: Json;
          conversation_id: string | null;
          task_id: string | null;
          project_id: string | null;
          job_id: string | null;
          status: "started" | "completed" | "failed";
          duration_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          activity_type: "tool_call" | "cron_execution" | "email_sent" | "email_received" | "research" | "memory_saved" | "task_created" | "task_updated" | "project_created" | "project_updated" | "reminder_created" | "job_scheduled" | "notification_sent" | "slack_message" | "webhook_triggered" | "error" | "system";
          source: "chat" | "cron" | "webhook" | "slack" | "email" | "system";
          title: string;
          description?: string | null;
          metadata?: Json;
          conversation_id?: string | null;
          task_id?: string | null;
          project_id?: string | null;
          job_id?: string | null;
          status?: "started" | "completed" | "failed";
          duration_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          activity_type?: "tool_call" | "cron_execution" | "email_sent" | "email_received" | "research" | "memory_saved" | "task_created" | "task_updated" | "project_created" | "project_updated" | "reminder_created" | "job_scheduled" | "notification_sent" | "slack_message" | "webhook_triggered" | "error" | "system";
          source?: "chat" | "cron" | "webhook" | "slack" | "email" | "system";
          title?: string;
          description?: string | null;
          metadata?: Json;
          conversation_id?: string | null;
          task_id?: string | null;
          project_id?: string | null;
          job_id?: string | null;
          status?: "started" | "completed" | "failed";
          duration_ms?: number | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_messages: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
          p_conversation_id?: string | null;
        };
        Returns: {
          id: string;
          conversation_id: string;
          role: string;
          content: string;
          similarity: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
