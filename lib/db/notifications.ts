import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Stub implementation for creating notifications
 * TODO: Implement actual notification system when needed
 */
export async function createNotification(
  _supabase: SupabaseClient,
  _agentId: string,
  _type: string,
  _title: string,
  _message: string,
  _entityType: string,
  _entityId: string
): Promise<{ success: boolean; error?: string }> {
  // Stub implementation - returns success without doing anything
  console.warn("createNotification: Stub implementation called");
  return { success: true };
}
