-- Create emails table for storing inbound and outbound emails via Resend
-- This replaces the need to fetch emails from external services and enables proper RLS

-- Email direction type
CREATE TYPE email_direction AS ENUM ('inbound', 'outbound');

-- Email status type
CREATE TYPE email_status AS ENUM ('pending', 'sent', 'delivered', 'bounced', 'failed', 'received');

-- Create emails table
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ownership (RLS enforcement)
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  
  -- Resend identifiers
  resend_email_id TEXT, -- Resend's email ID for tracking
  
  -- Email metadata
  direction email_direction NOT NULL,
  status email_status NOT NULL DEFAULT 'pending',
  
  -- Threading
  message_id TEXT, -- RFC 2822 Message-ID for threading
  in_reply_to TEXT, -- Message-ID this email replies to
  thread_id TEXT, -- Group emails in same thread
  references_ids TEXT[], -- Array of Message-IDs in thread chain
  
  -- Email content
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses TEXT[] NOT NULL,
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  reply_to_address TEXT,
  subject TEXT NOT NULL,
  
  -- Body content
  html_body TEXT,
  text_body TEXT,
  
  -- Headers (for debugging/advanced use)
  headers JSONB DEFAULT '{}',
  
  -- Tracking
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Delivery tracking (for outbound)
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  bounce_reason TEXT,
  
  -- Timestamps
  received_at TIMESTAMPTZ, -- When email was received (inbound)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create email_attachments table
CREATE TABLE IF NOT EXISTS email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  
  -- Resend attachment identifiers
  resend_attachment_id TEXT,
  
  -- File metadata
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  
  -- Storage
  storage_path TEXT, -- Path in Supabase Storage
  download_url TEXT, -- Temporary download URL from Resend (expires in 1 hour)
  download_url_expires_at TIMESTAMPTZ,
  
  -- Status
  is_downloaded BOOLEAN DEFAULT FALSE,
  downloaded_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_agent_id ON emails(agent_id);
CREATE INDEX IF NOT EXISTS idx_emails_direction ON emails(direction);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_is_read ON emails(agent_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
CREATE INDEX IF NOT EXISTS idx_emails_in_reply_to ON emails(in_reply_to);
CREATE INDEX IF NOT EXISTS idx_emails_from_address ON emails(from_address);
CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_resend_id ON emails(resend_email_id);

CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id ON email_attachments(email_id);

-- Enable Row Level Security
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for emails table
-- Users can only read their own emails
CREATE POLICY "Users can read own emails" ON emails
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own emails (for outbound)
CREATE POLICY "Users can insert own emails" ON emails
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own emails (mark as read, etc.)
CREATE POLICY "Users can update own emails" ON emails
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own emails
CREATE POLICY "Users can delete own emails" ON emails
  FOR DELETE
  USING (user_id = auth.uid());

-- Service role has full access (for webhook handlers)
CREATE POLICY "Service role can access all emails" ON emails
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for email_attachments table
-- Users can only access attachments for their emails
CREATE POLICY "Users can read own email attachments" ON email_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM emails 
      WHERE emails.id = email_attachments.email_id 
      AND emails.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert attachments for own emails" ON email_attachments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM emails 
      WHERE emails.id = email_attachments.email_id 
      AND emails.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update attachments for own emails" ON email_attachments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM emails 
      WHERE emails.id = email_attachments.email_id 
      AND emails.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete attachments for own emails" ON email_attachments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM emails 
      WHERE emails.id = email_attachments.email_id 
      AND emails.user_id = auth.uid()
    )
  );

-- Service role has full access to attachments
CREATE POLICY "Service role can access all email attachments" ON email_attachments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_emails_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_emails_timestamp
  BEFORE UPDATE ON emails
  FOR EACH ROW
  EXECUTE FUNCTION update_emails_updated_at();

-- Add comments
COMMENT ON TABLE emails IS 'Stores all inbound and outbound emails via Resend with proper threading support';
COMMENT ON TABLE email_attachments IS 'Stores metadata and storage paths for email attachments';

COMMENT ON COLUMN emails.message_id IS 'RFC 2822 Message-ID header for threading';
COMMENT ON COLUMN emails.in_reply_to IS 'Message-ID of the email this is replying to';
COMMENT ON COLUMN emails.thread_id IS 'Groups related emails in the same conversation thread';
COMMENT ON COLUMN emails.references_ids IS 'Array of Message-IDs from the entire thread chain';
COMMENT ON COLUMN emails.resend_email_id IS 'Resend API email ID for tracking delivery status';

-- Create storage bucket for email attachments (run this in Supabase Dashboard if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('email-attachments', 'email-attachments', false);
