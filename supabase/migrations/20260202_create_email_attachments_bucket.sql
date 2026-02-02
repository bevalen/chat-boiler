-- Create storage bucket for email attachments
-- Applied via Supabase MCP on 2026-02-02
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'email-attachments',
  'email-attachments',
  false, -- Not public, requires authentication
  52428800, -- 50MB limit
  NULL -- Allow all mime types
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- IMPORTANT: RLS Policies must be configured in Supabase Dashboard
-- ============================================================================
-- Storage RLS policies are managed by Supabase's storage schema and must be
-- configured through the Dashboard at: Storage > Policies
--
-- Required Policies for email-attachments bucket:
--
-- 1. "Users can view own email attachments" (SELECT)
--    USING:
--      bucket_id = 'email-attachments' 
--      AND (storage.foldername(name))[1] IN (
--        SELECT user_id::text FROM agents WHERE user_id = auth.uid()
--      )
--
-- 2. "Service role can manage attachments" (INSERT, UPDATE, DELETE)
--    USING / WITH CHECK:
--      bucket_id = 'email-attachments'
--      AND auth.role() = 'service_role'
--
-- These policies ensure:
-- - Users can only access attachments in their own folder (by user_id)
-- - Service role (backend) has full access for automated operations
-- - No public access
-- ============================================================================
