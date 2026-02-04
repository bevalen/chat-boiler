# Chat Boiler - Product Requirements Document

## Overview

Chat Boiler is a production-ready boilerplate for building AI-powered chat applications. It provides a complete foundation with chat interface, authentication, feedback system, and extensible AI tool architecture.

## Core Features

### 1. Chat Interface
- Real-time streaming chat interface
- Message history persistence
- Markdown rendering
- Conversation management
- Responsive design with dark mode

### 2. User Authentication
- Supabase Auth integration
- Signup/login flows
- User profile management
- Session management

### 3. Feedback System
- Chat-based feedback submission
- Bug reports and feature requests
- Kanban board management
- Status workflow (new → under_review → planned → in_progress → done)
- Comments on feedback items

### 4. AI Tools
- Research tool (Perplexity Sonar Pro via Vercel AI SDK Gateway)
- Feedback tools (submit, search, update, delete)
- Extensible tool architecture for custom tools

### 5. UI Components
- Complete shadcn/ui component library
- Command palette navigation
- Responsive sidebar
- Settings pages

## Database Schema

### Required Tables

#### 1. Users Table
Extends Supabase `auth.users` with additional profile information.

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  timezone TEXT DEFAULT 'America/New_York',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. Agents Table
Stores AI assistant configuration for each user.

```sql
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'AI Assistant',
  email TEXT,
  title TEXT,
  avatar_url TEXT,
  personality JSONB,
  user_preferences JSONB,
  identity_context JSONB,
  custom_instructions TEXT,
  safety_permissions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

**JSONB Fields:**
- `personality`: `{ traits: string[], style: string, tone: string, background: string }`
- `user_preferences`: `{ response_style: string, use_bullet_points: boolean, proactive_suggestions: boolean, confirm_before_actions: boolean, preferred_communication: string }`
- `identity_context`: `{ owner: { name, company, role, timezone }, capabilities: string[] }`

#### 3. Conversations Table
Stores conversation threads.

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New conversation',
  channel_source TEXT DEFAULT 'app',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. Messages Table
Stores chat messages with vector embeddings for semantic search.

```sql
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Metadata JSONB Structure:**
- `channel_source`: string (optional)
- `tool_calls`: array of `{ name: string, timestamp: Date }` (optional)

#### 5. Feedback Items Table
Stores user feedback (bugs and feature requests).

```sql
CREATE TABLE IF NOT EXISTS feedback_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('bug_report', 'feature_request', 'improvement', 'question', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  problem TEXT,
  proposed_solution TEXT,
  context JSONB,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT CHECK (status IN ('new', 'under_review', 'planned', 'in_progress', 'done', 'wont_fix')),
  source TEXT CHECK (source IN ('manual', 'agent_error', 'user_report')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 6. Comments Table
Stores comments on feedback items.

```sql
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID REFERENCES feedback_items(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'agent', 'system')),
  content TEXT NOT NULL,
  comment_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 7. Action Log Table (Optional)
Logs tool calls for debugging and analytics.

```sql
CREATE TABLE IF NOT EXISTS action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  action TEXT NOT NULL,
  params JSONB,
  result JSONB,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Required Extensions

```sql
-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;
```

### Required Indexes

```sql
-- Message indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_embedding ON messages USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Feedback indexes
CREATE INDEX IF NOT EXISTS idx_feedback_items_agent_id ON feedback_items(agent_id);
CREATE INDEX IF NOT EXISTS idx_feedback_items_status ON feedback_items(status);
CREATE INDEX IF NOT EXISTS idx_feedback_items_type ON feedback_items(type);

-- Comments index
CREATE INDEX IF NOT EXISTS idx_comments_feedback_id ON comments(feedback_id);
```

### Row Level Security (RLS) Policies

Enable RLS on all tables:

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_log ENABLE ROW LEVEL SECURITY;
```

**Users Policies:**
```sql
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
```

**Agents Policies:**
```sql
CREATE POLICY "Users can view own agent" ON agents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own agent" ON agents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own agent" ON agents FOR INSERT WITH CHECK (auth.uid() = user_id);
```

**Conversations Policies:**
```sql
CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT 
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));
CREATE POLICY "Users can create own conversations" ON conversations FOR INSERT 
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));
```

**Messages Policies:**
```sql
CREATE POLICY "Users can view own messages" ON messages FOR SELECT 
  USING (conversation_id IN (
    SELECT id FROM conversations WHERE agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  ));
CREATE POLICY "Users can create own messages" ON messages FOR INSERT 
  WITH CHECK (conversation_id IN (
    SELECT id FROM conversations WHERE agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  ));
```

**Feedback Policies:**
```sql
CREATE POLICY "Users can view own feedback" ON feedback_items FOR SELECT 
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));
CREATE POLICY "Users can create own feedback" ON feedback_items FOR INSERT 
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own feedback" ON feedback_items FOR UPDATE 
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));
```

**Comments Policies:**
```sql
CREATE POLICY "Users can view own comments" ON comments FOR SELECT 
  USING (feedback_id IN (
    SELECT id FROM feedback_items WHERE agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  ));
CREATE POLICY "Users can create own comments" ON comments FOR INSERT 
  WITH CHECK (feedback_id IN (
    SELECT id FROM feedback_items WHERE agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  ));
```

### Realtime Configuration

Enable realtime for messages table:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

## Environment Variables

Required environment variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Gateway (Vercel AI SDK Gateway)
# Get your API key from: https://vercel.com/dashboard/ai-gateway/api-keys
# This routes all AI requests (chat, research) through Vercel's gateway
AI_GATEWAY_API_KEY=your_vercel_ai_gateway_api_key

# Production
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Note:** When deployed on Vercel, you can optionally use `VERCEL_OIDC_TOKEN` instead of `AI_GATEWAY_API_KEY` for automatic authentication. The AI SDK will automatically use the OIDC token if available.

## Customization Points

### System Prompt
Edit `lib/db/agents.ts` → `buildSystemPrompt()` to customize your AI assistant's role and capabilities.

### AI Tools
Add custom tools in `lib/tools/` and register them in `lib/tools/registry.ts`.

### UI Components
All UI components are in `components/` and can be customized as needed.

## Notes

- This PRD defines the minimum required schema for the boilerplate
- Before setting up a new project, review this PRD and any additional product vision documents
- Add any additional tables/columns needed for your specific application requirements
- The schema is designed to be extensible - add new tables as needed without modifying core tables
