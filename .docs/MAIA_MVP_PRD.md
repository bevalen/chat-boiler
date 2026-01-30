# MAIA MVP - Product Requirements Document

## Objective

Build a functional AI executive assistant for Ben Valentin that demonstrates core MAIA capabilities: context-aware conversations, proactive task execution, basic project/task management, and simple tool integration. 

This MVP proves the concept and establishes the foundation for multi-tenant expansion.

**Timeline:** Right now
**Scope:** Single user (Ben), basic features, foundational architecture

## Core User Stories

1. **As Ben, I want to chat with Milo and have him remember our conversation history** so that I don't have to repeat context.

2. **As Ben, I want Milo to proactively send me a daily brief each morning** with my calendar, active projects, and priorities.

3. **As Ben, I want to create and track projects and tasks through conversation** so I can manage work without switching tools.

4. **As Ben, I want Milo to read my emails and calendar** so he has context about my schedule and communications.

5. **As Ben, I want Milo to send emails on his own behalf** when coordinating or following up on tasks.

## MVP Features

### 1. Chat Interface (Web App)

**Basic Requirements:**
- Simple chat UI (web only for MVP)
- Message history persists across sessions
- Real-time message delivery
- Support for markdown formatting
- Loading states while agent thinks

**Out of Scope for MVP:**
- Mobile app
- Multiple channels (Slack, SMS, etc.)
- File uploads
- Voice input

### 2. Context Engine (Simplified)

**Basic Requirements:**
- Store all messages with vector embeddings (using Supabase pgvector)
- Store context blocks (identity, preferences, tools)
- Simple retrieval: get last 10 messages + relevant context blocks
- Single user context (Ben)

**Database Tables:**
```
users (id, name, email, timezone, created_at)
agents (id, user_id, name, email, identity_context, created_at)
conversations (id, agent_id, channel_type, status, created_at)
messages (id, conversation_id, role, content, embedding, created_at)
context_blocks (id, agent_id, type, content, embedding, created_at)
```

**Context Block Types:**
- `identity` (who Milo is)
- `user_profile` (who Ben is)
- `tools` (what Milo can do)
- `preferences` (how Ben likes to work)

**Out of Scope for MVP:**
- Advanced vector search (top-k similarity)
- Memory snapshots
- Multi-conversation context linking
- Context visibility rules

### 3. Projects & Tasks

**Basic Requirements:**
- Create projects via conversation ("Start a project called X")
- Create tasks via conversation ("Add a task to follow up with Chris")
- List active projects and tasks
- Mark tasks as complete
- Simple priority levels (high/medium/low)

**Database Tables:**
```
projects (id, agent_id, title, description, status, priority, created_at, updated_at)
tasks (id, agent_id, project_id, title, description, status, priority, due_date, created_at, completed_at)
```

**Agent Capabilities:**
- Parse project/task creation from natural language
- Update task status when user says "I finished X"
- Include active projects/tasks in context when relevant

**Out of Scope for MVP:**
- Complex task dependencies
- Recurring tasks
- Task assignments (multi-user)
- Project templates
- Time tracking

### 4. Email & Calendar Integration (Read-Only via MCP)

**Basic Requirements:**
- Zapier MCP for reading Ben's Gmail (read-only)
- Zapier MCP for reading Ben's Google Calendar (read-only)
- Zapier MCP for Milo's Gmail (send capability)
- Agent can check Ben's inbox on request
- Agent can check Ben's calendar for today/tomorrow
- Agent can send emails as Milo

**Agent Capabilities:**
- "What's on my calendar today?" → Reads Ben's calendar
- "Any important emails?" → Scans Ben's inbox
- "Send an email to Chris about X" → Sends from milo@madewell.ai

**Out of Scope for MVP:**
- Email categorization/filtering
- Calendar event creation (on Ben's calendar)
- Email thread tracking
- Calendar conflict detection
- OAuth (use Zapier MCPs instead)

### 5. Proactive Daily Brief (Single Cron Job)

**Basic Requirements:**
- Supabase Edge Function triggered via pg_cron
- Runs every morning at 8:00 AM EST
- Gathers: today's calendar events, active projects, pending tasks
- Creates a new message in the main conversation
- Simple, clean summary format

**Daily Brief Content:**
```
Good morning, Ben.

CALENDAR TODAY:
- 10:00 AM: Call with Chris (30 min)
- 2:00 PM: Team standup (15 min)

ACTIVE PROJECTS (2):
- Launch sales automation feature (Status: In progress)
- Q1 revenue projections (Status: Planning)

PENDING TASKS (3):
- Follow up with Chris about pricing model (High priority, Due: Today)
- Review Doug's GTM plan (Medium priority)
- Update Madewell positioning doc (Low priority)

Anything you need me to prioritize today?
```

**Out of Scope for MVP:**
- Multiple cron jobs
- User-configured timing
- Agent-created cron jobs
- Conditional execution (skip if no events, etc.)
- Multi-channel delivery (just posts to main chat)

### 6. Simple Agent Tools System

**Basic Requirements:**
- Agent knows available tools from context_blocks
- Tools are called via sub-agent pattern (MCP wrappers)
- Log all tool calls to action_log table

**Initial Tools:**
- `check_ben_email` (read Ben's Gmail via Zapier MCP)
- `check_ben_calendar` (read Ben's calendar via Zapier MCP)
- `send_email_as_milo` (send from milo@madewell.ai via Zapier MCP)

**Database Table:**
```
action_log (id, agent_id, tool_name, action, params, result, created_at)
```

**Out of Scope for MVP:**
- Permission system (all tools available to Milo by default)
- Tool configuration UI
- OAuth integrations
- Advanced tools (Slack, Drive, CRM, etc.)

## Technical Stack

**Frontend:**
- Next.js 14 (App Router)
- Tailwind CSS
- Supabase client for auth + realtime

**Backend:**
- Supabase (Postgres + Auth + Realtime + Storage)
- Supabase Edge Functions (Deno runtime)
- pg_cron for scheduled tasks
- pgvector for embeddings

**AI:**
- Vercel AI SDK
- Anthropic Claude (Sonnet 3.5 or 4)
- OpenAI text-embedding-3-small (for embeddings)

**Tools:**
- Zapier (MCP servers for Gmail/Calendar)
- Custom MCP wrappers for tool calling

## Database Schema (MVP)

```sql
-- Core tables
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  identity_context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  channel_type TEXT DEFAULT 'app',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI embedding dimension
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE context_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'identity', 'user_profile', 'tools', 'preferences'
  title TEXT,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'completed'
  priority TEXT DEFAULT 'medium', -- 'high', 'medium', 'low'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  action TEXT NOT NULL,
  params JSONB,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for vector search
CREATE INDEX ON messages USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON context_blocks USING ivfflat (embedding vector_cosine_ops);
```

## User Flows

### 1. Initial Setup (One-Time)

**Manual setup by Ben:**
1. Create Supabase project
2. Run database migrations (create tables, enable pgvector)
3. Create user record for Ben
4. Create agent record for Milo
5. Seed context_blocks (identity, user_profile, tools, preferences)
6. Set up Zapier MCPs (Gmail read, Calendar read, Gmail send)
7. Configure daily brief cron job
8. Deploy Next.js app

**Out of Scope:**
- User registration flow
- Onboarding wizard
- OAuth connection UI

### 2. Daily Chat Session

1. Ben opens MAIA web app
2. Sees main conversation with Milo (loads last 50 messages)
3. Types message: "What's on my calendar today?"
4. Milo:
   - Embeds the message
   - Retrieves last 10 messages + relevant context
   - Calls `check_ben_calendar` tool
   - Responds with calendar summary
5. Ben: "Add a task to follow up with Chris about pricing"
6. Milo:
   - Parses intent (create task)
   - Creates task in database
   - Responds: "Added task: Follow up with Chris about pricing (Priority: Medium)"
7. Conversation continues...

### 3. Morning Brief (Automated)

1. 8:00 AM EST: pg_cron triggers Edge Function
2. Edge Function:
   - Identifies Ben's agent (Milo)
   - Calls tools: `check_ben_calendar`, gets active projects, gets pending tasks
   - Constructs brief message
   - Inserts message into main conversation (role: assistant)
3. Ben opens app later, sees brief at top of conversation

### 4. Email Management

1. Ben: "Any important emails this morning?"
2. Milo:
   - Calls `check_ben_email` (last 10 unread)
   - Scans subject lines + senders
   - Responds: "You have 3 unread emails: 1 from Chris about Q1 projections, 2 newsletters"
3. Ben: "Send Chris an email asking when he'll have the projections ready"
4. Milo:
   - Calls `send_email_as_milo`
   - Drafts email from milo@madewell.ai to chris@madewell.ai
   - Logs action
   - Responds: "Sent email to Chris"

## Success Criteria

**MVP is successful if:**
1. Ben can have natural conversations with Milo that persist across sessions
2. Milo sends a useful daily brief every morning at 8am
3. Ben can create/manage projects and tasks via conversation
4. Milo can read Ben's email and calendar and respond with accurate info
5. Milo can send emails on his own behalf
6. The system is stable enough for daily use

**Metrics to track:**
- Messages per day
- Tool calls per day
- Projects/tasks created
- Daily brief delivery success rate
- User satisfaction (Ben's subjective rating)

## Out of Scope (Post-MVP)

**Explicitly NOT building in MVP:**
- Multi-user / multi-tenant
- Advanced vector search
- Agent-created cron jobs
- Multiple channels (Slack, SMS, etc.)
- OAuth integrations (use Zapier instead)
- Mobile app
- Team projects / agent coordination
- Complex security rules
- File uploads / document processing
- Voice interface
- Advanced tool integrations (CRM, Drive, etc.)

## Architecture Decisions

**Why Supabase:**
- Built-in auth, realtime, storage
- pgvector for embeddings
- Edge Functions for serverless compute
- pg_cron for scheduled tasks
- All-in-one reduces complexity for MVP

**Why Zapier MCPs for MVP:**
- Faster than building OAuth flows
- Handles auth complexity
- Can swap for native OAuth post-MVP
- Allows us to focus on core agent logic

**Why single conversation:**
- Simpler context management
- Easier to debug
- Daily brief posts to same thread
- Multi-channel can come later

**Why simple retrieval:**
- Just last 10 messages + context blocks
- Faster to implement
- Proves the concept
- Advanced vector search post-MVP

## Development Phases

### Week 1: Foundation
- [ ] Set up Supabase project
- [ ] Create database schema + migrations
- [ ] Set up Next.js app with Supabase auth
- [ ] Build basic chat UI
- [ ] Implement message storage + retrieval
- [ ] Seed initial context blocks

### Week 2: Agent Logic
- [ ] Integrate Vercel AI SDK + Claude
- [ ] Implement embedding generation (OpenAI)
- [ ] Build context retrieval logic
- [ ] Create MCP wrappers for tools
- [ ] Implement project/task management
- [ ] Test conversation flow end-to-end

### Week 3: Proactive Features + Polish
- [ ] Set up pg_cron + daily brief Edge Function
- [ ] Test email/calendar integration
- [ ] Implement action logging
- [ ] Polish UI/UX
- [ ] Deploy to production
- [ ] Monitor first week of usage

## Deployment

**Hosting:**
- Frontend: Vercel
- Backend: Supabase (hosted)
- Edge Functions: Supabase Edge Functions

**Environment Variables:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
OPENAI_API_KEY
ZAPIER_MCP_EMAIL_ENDPOINT
ZAPIER_MCP_CALENDAR_ENDPOINT
```

**Monitoring:**
- Supabase logs for database queries
- Vercel logs for frontend
- Custom logging in Edge Functions
- Simple error tracking (console.error for MVP)

## Next Steps After MVP

Once MVP is working for Ben:

1. **Gather usage data:** How often is Milo used? What features get the most use?
2. **Identify pain points:** What's missing? What's clunky?
3. **Advanced vector search:** Implement proper semantic retrieval
4. **Agent-created crons:** Let Milo schedule his own follow-ups
5. **Multi-channel:** Add Slack integration
6. **OAuth:** Replace Zapier with native Gmail/Calendar OAuth
7. **Multi-tenant:** Prepare for Chris to get his own agent

The MVP proves the concept. Post-MVP, we scale it.

---

*Build fast, learn fast, iterate fast.*
