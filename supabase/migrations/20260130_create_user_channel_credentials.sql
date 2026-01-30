-- Create user_channel_credentials table for storing channel-specific credentials (Slack, Email, SMS, etc.)
CREATE TABLE IF NOT EXISTS user_channel_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('slack', 'email', 'sms', 'discord')),
  credentials JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, channel_type)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_channel_credentials_user_id ON user_channel_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_credentials_channel_type ON user_channel_credentials(user_id, channel_type);
CREATE INDEX IF NOT EXISTS idx_user_channel_credentials_active ON user_channel_credentials(user_id, is_active);

-- Enable Row Level Security
ALTER TABLE user_channel_credentials ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own channel credentials
CREATE POLICY "Users can read own channel credentials" ON user_channel_credentials
  FOR SELECT
  USING (user_id = auth.uid());

-- Create policy for users to insert their own channel credentials
CREATE POLICY "Users can insert own channel credentials" ON user_channel_credentials
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Create policy for users to update their own channel credentials
CREATE POLICY "Users can update own channel credentials" ON user_channel_credentials
  FOR UPDATE
  USING (user_id = auth.uid());

-- Create policy for users to delete their own channel credentials
CREATE POLICY "Users can delete own channel credentials" ON user_channel_credentials
  FOR DELETE
  USING (user_id = auth.uid());

-- Create policy for service role to access all credentials (for bot services)
CREATE POLICY "Service role can access all channel credentials" ON user_channel_credentials
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_channel_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_user_channel_credentials_timestamp
  BEFORE UPDATE ON user_channel_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_user_channel_credentials_updated_at();

-- Add comment to table
COMMENT ON TABLE user_channel_credentials IS 'Stores per-user channel credentials for Slack, Email, SMS, and other communication channels';

-- Add comments to columns
COMMENT ON COLUMN user_channel_credentials.channel_type IS 'Type of channel: slack, email, sms, discord';
COMMENT ON COLUMN user_channel_credentials.credentials IS 'JSON object containing channel-specific credentials (tokens, API keys, etc.)';
COMMENT ON COLUMN user_channel_credentials.is_active IS 'Whether this channel is currently active for the user';
