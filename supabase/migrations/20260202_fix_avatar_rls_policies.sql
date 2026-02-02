-- Fix RLS policies for avatar uploads and agent updates
-- This migration addresses security issues where:
-- 1. Storage policies were too permissive (any user could delete/update any avatar)
-- 2. Agents table RLS policy was missing with_check clause

-- Fix agents table RLS policy to include with_check
-- This prevents users from changing the user_id of an agent to someone else's
DROP POLICY IF EXISTS "Users can manage own agents" ON public.agents;

CREATE POLICY "Users can manage own agents"
  ON public.agents
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Fix storage policies to be more restrictive
-- Users should only delete/update their own avatars
DROP POLICY IF EXISTS "Users can delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update avatars" ON storage.objects;

CREATE POLICY "Users can delete own avatars"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] IN (
      auth.uid()::text,
      'users/' || auth.uid()::text,
      (SELECT id::text FROM public.agents WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update own avatars"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] IN (
      auth.uid()::text,
      'users/' || auth.uid()::text,
      (SELECT id::text FROM public.agents WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] IN (
      auth.uid()::text,
      'users/' || auth.uid()::text,
      (SELECT id::text FROM public.agents WHERE user_id = auth.uid())
    )
  );
