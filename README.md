# Chat Boiler - AI Chat Application Boilerplate

A production-ready boilerplate for building AI-powered chat applications with Next.js, Supabase, and the Vercel AI SDK.

## Overview

This boilerplate provides a complete foundation for building AI chat applications. It includes a fully functional chat interface with streaming responses, user authentication, a feedback system, and an extensible AI tool architecture.

## Features Included

- ✅ **Chat Interface** - Full-featured chat UI with streaming responses, markdown rendering, and conversation history
- ✅ **User Authentication** - Complete auth system with Supabase (signup, login, logout)
- ✅ **Feedback System** - Built-in feedback collection for bugs and feature requests with kanban board management
- ✅ **AI Tools** - Extensible tool system with research and feedback tools included
- ✅ **Component Library** - Complete shadcn/ui component library (21 components)
- ✅ **Responsive Design** - Mobile-friendly with dark mode support
- ✅ **Command Palette** - Quick navigation and actions
- ✅ **Real-time Updates** - Supabase realtime subscriptions for live message sync

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **UI:** React 19, Tailwind CSS, shadcn/ui
- **Database:** Supabase (PostgreSQL + Vector)
- **Auth:** Supabase Auth
- **AI:** Vercel AI SDK with AI Gateway (routes through Vercel's gateway)
- **Models:** Claude Sonnet 4.5 (chat), Perplexity Sonar Pro (research)
- **Deployment:** Vercel

## Prerequisites

- Node.js 18+ (check `.nvmrc` for exact version)
- npm/yarn/pnpm
- Supabase account (free tier works)
- Vercel AI Gateway API key (routes AI requests through Vercel's gateway)

## Quick Start

**Before starting:** Review `.docs/PRD.md` for the complete database schema and requirements. The PRD contains the exact table definitions, indexes, and RLS policies needed.

### Step 1: Clone and Setup

```bash
git clone https://github.com/YOUR_USERNAME/chat-boiler.git my-ai-app
cd my-ai-app
npm install
```

### Step 2: Environment Variables

```bash
cp .env.example .env.local
```

**Get your AI Gateway API key:**
1. Go to [Vercel AI Gateway API Keys](https://vercel.com/dashboard/ai-gateway/api-keys)
2. Create a new API key
3. Add it to `.env.local` as `AI_GATEWAY_API_KEY`

The AI Gateway routes all AI requests (chat, research tool) through Vercel's gateway instead of calling providers directly. This provides rate limiting, caching, and analytics.

Required environment variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Gateway (Vercel AI SDK Gateway)
# Get your API key from: https://vercel.com/dashboard/ai-gateway/api-keys
AI_GATEWAY_API_KEY=your_vercel_ai_gateway_api_key
```

### Step 3: Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and keys to `.env.local`
3. **Review `.docs/PRD.md`** for the complete database schema
4. Run the database schema from the PRD (see Database Setup section below)
5. Enable Realtime for the `messages` table:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE messages;
   ```
6. Configure Auth redirect URLs:
   - Development: `http://localhost:3000/auth/callback`
   - Production: `https://your-domain.com/auth/callback`

### Step 4: Customize System Prompt

Edit `lib/db/agents.ts` → `buildSystemPrompt()` function to define your AI assistant's role, personality, and capabilities.

Replace the placeholder text with your specific application requirements.

### Step 5: Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create an account.

### Step 6: Deploy

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

## Database Setup

**IMPORTANT:** 
1. **Review `.docs/PRD.md` first** - It contains the complete, exact database schema with all tables, indexes, and RLS policies
2. **Check for product vision documents** - If you have additional requirements or custom features, review those before setting up
3. **Plan your extensions** - Identify any additional tables or columns you'll need beyond the boilerplate

The PRD contains the authoritative schema. The schema below is a summary - refer to the PRD for complete details including:
- Exact column definitions and constraints
- JSONB field structures
- Complete RLS policies
- Index definitions
- Realtime configuration

### Complete Database Schema

**See `.docs/PRD.md` for the complete, production-ready database schema** including:
- All table definitions with exact column types and constraints
- Complete RLS policies for all tables
- Required indexes (including vector indexes)
- Realtime configuration
- JSONB field structures

The PRD contains copy-paste ready SQL that you can run directly in your Supabase SQL Editor.

**Required Tables Summary:**
- `users` - User profiles (extends Supabase auth.users)
- `agents` - AI assistant configuration
- `conversations` - Conversation threads
- `messages` - Chat messages with vector embeddings
- `feedback_items` - Feedback system (bugs + feature requests)
- `comments` - Comments on feedback items
- `action_log` - Optional tool call logging

## Before You Start

1. **Review the PRD**: Check `.docs/PRD.md` for the complete database schema and requirements
2. **Review Product Vision**: If you have a product vision document, review it for additional requirements
3. **Plan Customizations**: Identify what tables, features, or tools you'll need beyond the boilerplate
4. **Remove "boilerplate" references**: Before deploying to production, search for and remove all instances of "boilerplate" from:
   ```bash
   grep -ri "boilerplate" . --exclude-dir=node_modules --exclude-dir=.git
   ```
   Update these files:
   - `package.json` (name and description)
   - `README.md` (title and content)
   - Code comments and documentation
   - Any other files that will be shipped to production
   - **Critical:** Prevents accidentally shipping a product with "boilerplate" branding
5. **Then proceed** with setup following the steps below

## Customization Guide

### 1. Branding & Design

- **Replace logos:** Update files in `public/logos/` with your own
- **Update favicon:** Replace `app/icon.svg`
- **Modify colors:** Edit `app/globals.css` for your color scheme
- **Update app name:** Change `package.json` name field

### 2. System Prompt

Edit `lib/db/agents.ts` → `buildSystemPrompt()` function:

```typescript
// Replace generic template with your app-specific instructions
sections.push(`## Your Role`);
sections.push(`You are ${agent.name}, ${agent.title || "an AI assistant"}.`);
sections.push(`Your purpose is to [describe your app's purpose]`);
// ... add your specific capabilities and guidelines
```

### 3. Adding New AI Tools

1. Create tool file in `lib/tools/`:
   ```typescript
   import { tool } from "ai";
   import { z } from "zod";
   
   export function createMyTool(agentId: string) {
     return tool({
       description: "What this tool does",
       inputSchema: z.object({
         // your input schema
       }),
       execute: async ({ /* inputs */ }) => {
         // tool logic
         return { success: true, result: "..." };
       },
     });
   }
   ```

2. Register in `lib/tools/registry.ts`:
   ```typescript
   import { createMyTool } from "./my-tool";
   
   export function createToolRegistry(context: ToolRegistryContext) {
     // ...
     const myTool = createMyTool(agentId);
     return {
       // ... other tools
       myTool,
     };
   }
   ```

3. Update system prompt with tool usage guidelines

### 4. Adding New Pages

1. Create page in `app/(dashboard)/your-page/page.tsx`
2. Add nav item to `components/dashboard/app-sidebar.tsx`:
   ```typescript
   const navItems = [
     // ... existing items
     {
       title: "Your Page",
       url: "/your-page",
       icon: YourIcon,
     },
   ];
   ```

### 5. Customizing Settings

Edit `app/(dashboard)/settings/page.tsx` and `components/settings/settings-form.tsx` to add/remove settings sections.

## Feedback System

The feedback system allows users to submit bugs and feature requests via chat, and admins can manage them through kanban boards.

### How It Works

1. **User submits feedback** via chat interface at `/feedback`
2. **AI agent** uses structured tools (`submitFeedback`) to collect details
3. **Feedback saved** to `feedback_items` table
4. **Admin views** feedback on `/feedback/bugs` and `/feedback/features`
5. **Kanban board** for status management (new → under_review → planned → in_progress → done)
6. **Comments** and status updates supported

### Available Tools

- `submitFeedback` - Create new feedback item
- `searchFeedback` - Search existing feedback
- `updateFeedbackItem` - Update status, priority, details
- `deleteFeedbackItem` - Delete feedback

## Development

### Running Locally

```bash
npm run dev
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

### Database Types

Regenerate TypeScript types after schema changes:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/types/database.ts
```

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

### Environment Variables for Production

Same as local, plus:
- `NEXT_PUBLIC_SITE_URL` - Your production URL

**Note:** When deployed on Vercel, you can optionally use `VERCEL_OIDC_TOKEN` instead of `AI_GATEWAY_API_KEY` for automatic authentication. The AI SDK will automatically use the OIDC token if available.

## Common Issues & Solutions

### Chat not streaming

- Check `AI_GATEWAY_API_KEY` is set correctly
- Verify Supabase connection
- Check browser console for errors
- Ensure `NEXT_PUBLIC_SUPABASE_URL` is correct
- Verify your AI Gateway API key is valid at https://vercel.com/dashboard/ai-gateway/api-keys

### Feedback not saving

- Verify RLS policies on `feedback_items` table
- Check Supabase logs for errors
- Ensure user is authenticated

### Authentication redirect loop

- Check `NEXT_PUBLIC_SUPABASE_URL` is correct
- Verify callback URL in Supabase Auth settings matches your domain
- Clear browser cookies and try again

### Messages not syncing in real-time

- Verify Realtime is enabled: `ALTER PUBLICATION supabase_realtime ADD TABLE messages;`
- Check Supabase dashboard → Realtime settings
- Ensure WebSocket connections aren't blocked

## Architecture Overview

```
chat-boiler/
├── app/
│   ├── (auth)/          # Login/signup pages
│   ├── (dashboard)/     # Main app pages (chat, feedback, settings)
│   └── api/             # API routes (chat, feedback, auth)
├── components/
│   ├── chat/            # Chat interface components
│   ├── feedback/        # Feedback system components
│   ├── ui/              # shadcn/ui components
│   └── dashboard/       # Layout components
├── lib/
│   ├── tools/           # AI tool definitions
│   ├── db/              # Database utilities
│   ├── supabase/        # Supabase clients
│   └── types/           # TypeScript types
└── supabase/
    └── migrations/      # Database migrations
```

## License

MIT License - use this boilerplate for any purpose.

## Contributing

This is a boilerplate template. Fork it, customize it, and build your AI chat application!

---

**Need help?** 
- Check the [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md) for step-by-step setup instructions
- Review [.docs/PRD.md](./.docs/PRD.md) for the complete database schema and requirements
