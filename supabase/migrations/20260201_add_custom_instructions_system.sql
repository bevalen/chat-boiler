-- Add custom_instructions column to agents table
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS custom_instructions TEXT;

-- Add comment
COMMENT ON COLUMN agents.custom_instructions IS 'Custom instructions that are ALWAYS included in every system prompt';

-- Add always_include flag to context_blocks
ALTER TABLE context_blocks 
ADD COLUMN IF NOT EXISTS always_include BOOLEAN DEFAULT FALSE;

-- Create index for efficient querying of priority blocks
CREATE INDEX IF NOT EXISTS idx_context_blocks_always_include 
ON context_blocks(agent_id, always_include) 
WHERE always_include = TRUE;

-- Add comment
COMMENT ON COLUMN context_blocks.always_include IS 'If true, this context block is ALWAYS included in system prompts (not just via semantic search)';

-- Add category for organizing priority context blocks
ALTER TABLE context_blocks 
ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IS NULL OR category IN (
  'work_preferences', 
  'personal_background', 
  'communication_style', 
  'technical_preferences',
  'general'
));

-- Add comment for category
COMMENT ON COLUMN context_blocks.category IS 'Category for organizing context blocks (work_preferences, personal_background, communication_style, technical_preferences, general)';
