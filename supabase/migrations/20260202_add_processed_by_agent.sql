-- Add processed_by_agent tracking to emails table
-- This allows distinguishing between AI-processed emails and user-read emails

-- Add the processed_by_agent field
ALTER TABLE emails ADD COLUMN IF NOT EXISTS processed_by_agent BOOLEAN DEFAULT FALSE;

-- Add timestamp for when it was processed
ALTER TABLE emails ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- Add index for filtering processed emails
CREATE INDEX IF NOT EXISTS idx_emails_processed_by_agent ON emails(agent_id, processed_by_agent) WHERE processed_by_agent = TRUE;

-- Add comments
COMMENT ON COLUMN emails.processed_by_agent IS 'Whether the AI agent has processed this email (replied, created tasks, etc.)';
COMMENT ON COLUMN emails.processed_at IS 'Timestamp when the AI agent finished processing this email';
