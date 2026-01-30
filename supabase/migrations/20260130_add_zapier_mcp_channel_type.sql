-- Add zapier_mcp to the channel_type constraint for Zapier MCP email/calendar integration

-- Drop the existing constraint
ALTER TABLE user_channel_credentials 
DROP CONSTRAINT IF EXISTS user_channel_credentials_channel_type_check;

-- Add the new constraint with zapier_mcp included
ALTER TABLE user_channel_credentials 
ADD CONSTRAINT user_channel_credentials_channel_type_check 
CHECK (channel_type IN ('slack', 'email', 'sms', 'discord', 'zapier_mcp'));

-- Update the comment to reflect the new channel type
COMMENT ON COLUMN user_channel_credentials.channel_type IS 'Type of channel: slack, email, sms, discord, zapier_mcp';
