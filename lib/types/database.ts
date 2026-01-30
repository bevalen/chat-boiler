export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
          identity_context: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          email?: string | null;
          identity_context?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          email?: string | null;
          identity_context?: Json | null;
          created_at?: string | null;
        };
      };
      conversations: {
        Row: {
          id: string;
          agent_id: string;
          channel_type: string | null;
          status: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          channel_type?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          agent_id?: string;
          channel_type?: string | null;
          status?: string | null;
          created_at?: string | null;
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
  };
}
