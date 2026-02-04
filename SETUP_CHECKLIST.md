# Setup Checklist for New Project

Use this checklist when starting a new AI chat app from this boilerplate.

## 1. Clone and Rename

- [ ] Clone the repository: `git clone https://github.com/YOUR_USERNAME/chat-boiler.git my-new-app`
- [ ] Navigate to directory: `cd my-new-app`
- [ ] Remove existing git history: `rm -rf .git`
- [ ] Initialize new git repo: `git init`
- [ ] Create initial commit: `git add . && git commit -m "Initial commit from chat-boiler"`

## 2. Update Project Identity

- [ ] Update `package.json` name field: `"name": "my-new-app"`
- [ ] Update `package.json` description, author, etc.
- [ ] Replace logos in `public/logos/` with your own
- [ ] Update `app/icon.svg` for your favicon
- [ ] Update branding text in `app/(auth)/login/page.tsx` and `signup/page.tsx`
- [ ] Update `public/manifest.json` with your app name and description
- [ ] **Remove all "boilerplate" references** from the codebase:
  - [ ] Search for "boilerplate" (case-insensitive): `grep -ri "boilerplate" . --exclude-dir=node_modules --exclude-dir=.git`
  - [ ] Update `package.json` description (remove "boilerplate")
  - [ ] Update `README.md` title and description
  - [ ] Update any comments or documentation that mention "boilerplate"
  - [ ] Ensure no production code references "boilerplate" in names, descriptions, or comments
  - **Important:** This prevents accidentally shipping a product with "boilerplate" in the name

## 3. Review Requirements

- [ ] Read `.docs/PRD.md` for complete database schema
- [ ] Review any product vision documents for additional requirements
- [ ] Identify any custom tables/features needed beyond the boilerplate
- [ ] Plan your database schema modifications

## 4. Supabase Setup (Required for Full Functionality)

**Note:** You can skip this step initially and preview the UI. The app runs in "preview mode" without Supabase credentials, but full functionality (auth, chat, feedback) requires Supabase setup.

- [ ] Create new Supabase project at https://supabase.com
- [ ] Copy project URL and anon key
- [ ] Copy service role key (keep this secret!)
- [ ] Run database schema from PRD.md (see Database Setup section)
- [ ] Enable Realtime for `messages` table:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  ```
- [ ] Configure Auth redirect URLs in Supabase dashboard:
  - Development: `http://localhost:3000/auth/callback`
  - Production: `https://your-domain.com/auth/callback`

**After Supabase setup:** The app automatically switches from preview mode to full functionality. Users will be redirected to login/signup, and all features will work.

## 5. Environment Variables

- [ ] Copy `.env.example` to `.env.local` (if it exists, or create new file)
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL` (from Supabase project settings)
- [ ] Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from Supabase project settings)
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` (from Supabase project settings - API → service_role key)
- [ ] Add `AI_GATEWAY_API_KEY` (from Vercel AI Gateway - https://vercel.com/dashboard/ai-gateway/api-keys)
  - This routes all AI requests through Vercel's gateway (chat + research tool)
  - If deploying on Vercel, you can use `VERCEL_OIDC_TOKEN` instead (auto-configured)

## 6. Customize System Prompt

- [ ] Open `lib/db/agents.ts`
- [ ] Find `buildSystemPrompt()` function
- [ ] Edit the "Your Role" section to define your AI assistant's purpose
- [ ] Replace placeholder text like "Customize this section for your specific application."
- [ ] Define your AI assistant's personality and capabilities
- [ ] Update tool usage guidelines if you add custom tools
- [ ] Test the prompt by creating a conversation

## 7. Customize UI (Optional)

- [ ] Update color scheme in `app/globals.css` (search for CSS variables)
- [ ] Modify sidebar navigation in `components/dashboard/app-sidebar.tsx`
- [ ] Customize welcome screen in `components/chat/welcome-screen.tsx`
- [ ] Update auth page branding text
- [ ] Adjust spacing/layout as needed

## 8. Install and Test

- [ ] Run `npm install` to install dependencies
- [ ] Run `npm run dev` to start development server
- [ ] **Important:** After cloning, restart the dev server (`Ctrl+C` then `npm run dev`) to clear Turbopack cache
- [ ] Open http://localhost:3000
- [ ] **Preview mode:** If Supabase is not configured, you'll see the dashboard in preview mode (no auth required) - this lets you explore the UI before setting up Supabase
- [ ] **Full functionality:** Once Supabase is configured (Step 4), create a test account via signup page
- [ ] **Note:** The app uses `proxy.ts` (not `middleware.ts`) for Next.js 16 - don't create a `middleware.ts` file
- [ ] Test chat functionality:
  - [ ] Send a message
  - [ ] Verify streaming response works
  - [ ] Check conversation history persists
- [ ] Test feedback submission:
  - [ ] Go to `/feedback`
  - [ ] Submit a test bug report
  - [ ] Submit a test feature request
  - [ ] View feedback on `/feedback/bugs` and `/feedback/features`
- [ ] Test settings page:
  - [ ] Update profile information
  - [ ] Modify AI personality settings
  - [ ] Update preferences

## 9. Deploy

- [ ] Push to GitHub: `git remote add origin YOUR_REPO_URL && git push -u origin main`
- [ ] Connect to Vercel (or your preferred platform):
  - [ ] Import project from GitHub
  - [ ] Add all environment variables from `.env.local`
  - [ ] Set build command: `npm run build`
  - [ ] Set output directory: `.next`
- [ ] Deploy and test production:
  - [ ] Verify authentication works
  - [ ] Test chat functionality
  - [ ] Verify feedback system works
  - [ ] Check that real-time updates work

## 10. Optional Enhancements

- [ ] Add custom AI tools (see README.md Customization Guide)
- [ ] Add new pages/features
- [ ] Configure custom domain
- [ ] Set up analytics (e.g., Vercel Analytics, Plausible)
- [ ] Add SEO metadata to pages
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Configure email templates (if using email features)

## 11. Pre-Production Checklist

- [ ] **Search for "boilerplate"** (case-insensitive) across entire codebase:
  ```bash
  grep -ri "boilerplate" . --exclude-dir=node_modules --exclude-dir=.git
  ```
- [ ] Remove all "boilerplate" references from:
  - [ ] `package.json` (name and description)
  - [ ] `README.md` (title and all content)
  - [ ] Code comments
  - [ ] Documentation files (`.docs/` folder)
  - [ ] Any other production files
- [ ] Verify no "boilerplate" appears in:
  - [ ] App metadata (`public/manifest.json`, `app/layout.tsx`)
  - [ ] Error messages or user-facing text
  - [ ] API responses or logs
  - [ ] Environment variable names or values
- [ ] **Critical:** This prevents accidentally shipping a product with "boilerplate" branding to production

## 12. Clean Up

- [ ] Remove this SETUP_CHECKLIST.md file (or keep as reference)
- [ ] Remove any boilerplate-specific documentation you don't need
- [ ] Write your own app-specific README sections
- [ ] Update LICENSE file if needed
- [ ] Add your own CONTRIBUTING.md if open source

---

**Estimated time to complete:** 20-30 minutes

**Need help?** Check the README.md for detailed instructions on each step.
