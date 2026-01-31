-- LinkedIn Leads Table for SDR Functionality
-- This table stores lead information from LinkedIn conversations

CREATE TABLE IF NOT EXISTS linkedin_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  linkedin_profile_url TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  title TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'qualified', 'meeting_booked', 'closed', 'disqualified')),
  -- BANT qualification scores
  bant_budget BOOLEAN,
  bant_authority BOOLEAN,
  bant_need BOOLEAN,
  bant_timing BOOLEAN,
  -- Additional tracking
  notes TEXT,
  last_conversation_id UUID REFERENCES conversations(id),
  meeting_booked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure unique lead per agent
  UNIQUE(agent_id, linkedin_profile_url)
);

-- Enable Row Level Security
ALTER TABLE linkedin_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access leads for their own agents
CREATE POLICY "Users can access their own leads"
  ON linkedin_leads
  FOR ALL
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  );

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_linkedin_leads_agent_status ON linkedin_leads(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_linkedin_leads_profile_url ON linkedin_leads(linkedin_profile_url);
CREATE INDEX IF NOT EXISTS idx_linkedin_leads_updated_at ON linkedin_leads(updated_at DESC);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE linkedin_leads;

-- Update trigger to automatically set updated_at
CREATE OR REPLACE FUNCTION update_linkedin_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_linkedin_leads_updated_at
  BEFORE UPDATE ON linkedin_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_linkedin_leads_updated_at();

-- Grant service role access
GRANT ALL ON linkedin_leads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON linkedin_leads TO authenticated;
