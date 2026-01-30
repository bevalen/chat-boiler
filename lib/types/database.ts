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
          status: "pending" | "in_progress" | "completed" | null;
          priority: "high" | "medium" | "low" | null;
          due_date: string | null;
          created_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          project_id?: string | null;
          title: string;
          description?: string | null;
          status?: "pending" | "in_progress" | "completed" | null;
          priority?: "high" | "medium" | "low" | null;
          due_date?: string | null;
          created_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          agent_id?: string;
          project_id?: string | null;
          title?: string;
          description?: string | null;
          status?: "pending" | "in_progress" | "completed" | null;
          priority?: "high" | "medium" | "low" | null;
          due_date?: string | null;
          created_at?: string | null;
          completed_at?: string | null;
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
