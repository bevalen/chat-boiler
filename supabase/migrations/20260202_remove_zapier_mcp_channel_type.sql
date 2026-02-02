-- Remove zapier_mcp channel type from the database
-- This migration cleans up after deprecating Zapier MCP in favor of Resend

-- First, delete any existing zapier_mcp channel credentials
DELETE FROM user_channel_credentials WHERE channel_type = 'zapier_mcp';

-- Drop the old constraint
ALTER TABLE user_channel_credentials 
DROP CONSTRAINT IF EXISTS user_channel_credentials_channel_type_check;

-- Add the new constraint without zapier_mcp
ALTER TABLE user_channel_credentials 
ADD CONSTRAINT user_channel_credentials_channel_type_check 
CHECK (channel_type IN ('slack', 'email', 'sms', 'discord', 'linkedin'));

-- Update the column comment to reflect the change
COMMENT ON COLUMN user_channel_credentials.channel_type IS 'Type of channel: slack, email, sms, discord, linkedin';
