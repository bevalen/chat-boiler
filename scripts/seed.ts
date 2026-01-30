/**
 * Seed script to create initial data for the MAIA MVP
 * Run with: npx tsx scripts/seed.ts
 *
 * Prerequisites:
 * - Set SUPABASE_SERVICE_ROLE_KEY in .env.local
 * - Have a user created via Supabase Auth (the script will use this user's ID)
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing environment variables");
  console.error("Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log("Starting seed process...\n");

  // Get the first user from auth.users (should be Ben)
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

  if (authError || !authUsers?.users?.length) {
    console.error("No users found. Please create a user first via the signup page.");
    console.error("Error:", authError);
    process.exit(1);
  }

  const user = authUsers.users[0];
  console.log(`Found user: ${user.email}`);

  // Check if user already has an agent
  const { data: existingAgent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (existingAgent) {
    console.log("User already has an agent. Skipping seed.");
    return;
  }

  // Create the agent (Milo)
  console.log("Creating agent Milo...");
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .insert({
      user_id: user.id,
      name: "Milo",
      email: "milo@madewell.ai",
      identity_context: {
        role: "AI Executive Assistant",
        personality: "Proactive, efficient, and thoughtful",
        expertise: ["Project management", "Task tracking", "Email coordination", "Calendar management"],
      },
    })
    .select()
    .single();

  if (agentError || !agent) {
    console.error("Failed to create agent:", agentError);
    process.exit(1);
  }

  console.log(`Agent created with ID: ${agent.id}\n`);

  // Create context blocks
  console.log("Creating context blocks...");

  const contextBlocks = [
    {
      agent_id: agent.id,
      type: "identity",
      title: "Agent Identity",
      content: `You are Milo, an AI executive assistant created by MAIA. 
You are proactive, thoughtful, and efficient. You help your user manage their work, projects, and tasks.
You have a professional but friendly demeanor. You anticipate needs and provide helpful suggestions.
Your goal is to make your user's work life more organized and less stressful.`,
    },
    {
      agent_id: agent.id,
      type: "user_profile",
      title: "User Profile - Ben Valentin",
      content: `User: Ben Valentin
Role: Founder & CEO at Madewell.ai
Company: Madewell.ai - AI-powered sales intelligence platform
Timezone: America/New_York (Eastern Time)
Work Style: Values efficiency, clear communication, and data-driven decisions
Priorities: Product development, customer acquisition, team building
Communication Preference: Concise updates, proactive alerts for urgent matters`,
    },
    {
      agent_id: agent.id,
      type: "tools",
      title: "Available Tools",
      content: `Available tools and their capabilities:

1. Project Management:
   - createProject: Create new projects to track initiatives
   - listProjects: View all projects by status
   - updateProject: Update project details and status

2. Task Management:
   - createTask: Create tasks (standalone or linked to projects)
   - listTasks: View tasks by status or project
   - completeTask: Mark tasks as done
   - updateTask: Modify task details

3. Email (via Zapier MCP):
   - checkEmail: Check inbox for recent/unread emails
   - sendEmail: Send emails as Milo

4. Calendar (via Zapier MCP):
   - checkCalendar: View calendar events for today/upcoming`,
    },
    {
      agent_id: agent.id,
      type: "preferences",
      title: "User Preferences",
      content: `Preferences and guidelines:

Communication:
- Use bullet points for lists
- Keep responses concise but thorough
- Proactively suggest next steps

Projects & Tasks:
- Default priority is "medium" unless specified
- Always ask for due dates on high-priority tasks
- Link tasks to projects when relevant

Email:
- Confirm before sending emails
- Prioritize emails from team and customers
- Summarize rather than quote entire emails

Calendar:
- Include event times in Eastern Time
- Flag conflicts or back-to-back meetings
- Suggest buffer time between calls`,
    },
  ];

  for (const block of contextBlocks) {
    const { error } = await supabase.from("context_blocks").insert(block);
    if (error) {
      console.error(`Failed to create context block "${block.title}":`, error);
    } else {
      console.log(`Created context block: ${block.title}`);
    }
  }

  // Create initial conversation
  console.log("\nCreating initial conversation...");
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .insert({
      agent_id: agent.id,
      channel_type: "app",
      status: "active",
    })
    .select()
    .single();

  if (convError || !conversation) {
    console.error("Failed to create conversation:", convError);
    process.exit(1);
  }

  console.log(`Conversation created with ID: ${conversation.id}`);

  // Create welcome message
  console.log("Creating welcome message...");
  const welcomeMessage = `Hi Ben! I'm Milo, your AI executive assistant.

I'm here to help you stay organized and focused on what matters most. Here's what I can do for you:

**Project & Task Management**
- Create and track projects
- Manage your tasks and to-dos
- Keep you updated on what's pending

**Calendar & Email**
- Check your schedule for today and upcoming events
- Review your inbox for important messages
- Send emails on my behalf when you need coordination

**How to get started:**
- Ask me "What's on my calendar today?" to see your schedule
- Say "Create a project called..." to start tracking an initiative
- Tell me "Add a task to..." for anything you need to remember

What would you like to tackle first?`;

  const { error: msgError } = await supabase.from("messages").insert({
    conversation_id: conversation.id,
    role: "assistant",
    content: welcomeMessage,
  });

  if (msgError) {
    console.error("Failed to create welcome message:", msgError);
  } else {
    console.log("Welcome message created");
  }

  console.log("\n✅ Seed completed successfully!");
  console.log(`\nUser: ${user.email}`);
  console.log(`Agent: ${agent.name} (${agent.id})`);
  console.log(`Conversation: ${conversation.id}`);
}

seed().catch(console.error);
