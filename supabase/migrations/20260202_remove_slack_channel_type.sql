-- Remove slack channel type from the database
-- This migration cleans up after deprecating the Slack bot

-- First, delete any existing slack channel credentials
DELETE FROM user_channel_credentials WHERE channel_type = 'slack';

-- Drop the old constraint
ALTER TABLE user_channel_credentials 
DROP CONSTRAINT IF EXISTS user_channel_credentials_channel_type_check;

-- Add the new constraint without slack
ALTER TABLE user_channel_credentials 
ADD CONSTRAINT user_channel_credentials_channel_type_check 
CHECK (channel_type IN ('email', 'sms', 'discord', 'linkedin'));

-- Update the column comment to reflect the change
COMMENT ON COLUMN user_channel_credentials.channel_type IS 'Type of channel: email, sms, discord, linkedin';
