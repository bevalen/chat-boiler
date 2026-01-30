-- Create notifications table for the notification system
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('reminder', 'new_message', 'task_update', 'project_update')),
  title TEXT NOT NULL,
  content TEXT,
  link_type TEXT CHECK (link_type IN ('conversation', 'task', 'project', 'reminder')),
  link_id UUID,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notifications_agent_id ON notifications(agent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(agent_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(agent_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own notifications (via their agent)
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  );

-- Create policy for users to update their own notifications (for marking as read)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  );

-- Create policy for users to delete their own notifications
CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  );

-- Create policy for service role to insert notifications (for cron jobs and triggers)
CREATE POLICY "Service role can insert notifications" ON notifications
  FOR INSERT
  WITH CHECK (true);

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Add comment to table
COMMENT ON TABLE notifications IS 'Stores user notifications for reminders, messages, task updates, and project updates';
