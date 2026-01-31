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

export interface AgentIdentityContext {
  role?: string;
  capabilities?: string[];
  owner?: {
    name?: string;
    company?: string;
    role?: string;
    timezone?: string;
  };
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

// Comment types for task/project activity
export type CommentType = "progress" | "question" | "note" | "resolution" | "approval_request" | "approval_granted" | "status_change";

// Author types for comments
export type CommentAuthorType = "user" | "agent" | "system";

// Channel types
export type ChannelType = "app" | "slack" | "email" | "sms" | "discord" | "zapier_mcp";

// Database-level channel type (subset that can be stored)
export type StorableChannelType = "slack" | "email" | "sms" | "discord" | "zapier_mcp";

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

// Union type for all channel credentials
export type ChannelCredentials = SlackCredentials | EmailCredentials | ZapierMCPCredentials | Record<string, unknown>;

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
  type?: "scheduled_notification" | "scheduled_agent_task" | "daily_brief" | "slack_message" | "incoming_email";
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
      task_comments: {
        Row: {
          id: string;
          task_id: string | null;
          project_id: string | null;
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
          author_type?: CommentAuthorType;
          author_id?: string | null;
          content?: string;
          comment_type?: CommentType | null;
          created_at?: string | null;
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
          channel_type: "slack" | "email" | "sms" | "discord" | "zapier_mcp";
          credentials: Json;
          is_active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          channel_type: "slack" | "email" | "sms" | "discord" | "zapier_mcp";
          credentials: Json;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          channel_type?: "slack" | "email" | "sms" | "discord" | "zapier_mcp";
          credentials?: Json;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
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
