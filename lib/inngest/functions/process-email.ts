import { inngest } from "../client";
import { getAdminClient } from "@/lib/supabase/admin";
import { addMessage } from "@/lib/db/conversations";
import { logActivity } from "@/lib/db/activity-log";
import { ToolLoopAgent, gateway } from "ai";
import { gatherContextForEmail } from "@/lib/db/search";
import { getAgentById, buildSystemPrompt } from "@/lib/db/agents";
import { buildEmailContextPromptAddition } from "./email-context-prompt";
import { getOrCreateEmailConversation } from "./email-conversation";
import { createToolRegistry } from "@/lib/tools/registry";
import { createEmailAgentTools } from "@/lib/tools/email-agent-tools";


/**
 * Process inbound emails with AI agent
 * 
 * This function:
 * 1. Gathers comprehensive context (thread history, related projects/tasks, semantic search)
 * 2. Creates or finds an email conversation thread
 * 3. Adds the email as a user message
 * 4. Runs the AI agent with full context and linking tools
 * 5. Agent intelligently responds, links, and creates tasks as needed
 */
export const processInboundEmail = inngest.createFunction(
  {
    id: "process-inbound-email",
    name: "Process Inbound Email",
    retries: 3,
  },
  { event: "email/received.process" },
  async ({ event, step }) => {
    const { emailId, agentId, fromAddress, subject, recipientType } = event.data;

    console.log(`[process-email] Processing email ${emailId} for agent ${agentId}`);

    // Step 1: Gather comprehensive context
    const context = await step.run("gather-context", async () => {
      const supabase = getAdminClient();
      const emailContext = await gatherContextForEmail(supabase, agentId, emailId, {
        matchCount: 15,
        matchThreshold: 0.6,
      });

      if (!emailContext) {
        throw new Error("Failed to gather email context");
      }

      return emailContext;
    });

    const email = context.email;

    // Step 2: Get or create email conversation
    const conversation = await step.run("get-or-create-conversation", async () => {
      const supabase = getAdminClient();
      return getOrCreateEmailConversation(
        supabase,
        agentId,
        emailId,
        email.subject,
        email.thread_id,
        email.in_reply_to
      );
    });

    // Step 3: Add email as user message
    await step.run("add-email-message", async () => {
      const supabase = getAdminClient();

      // Fetch full email record for metadata
      const { data: fullEmail } = await supabase
        .from("emails")
        .select("to_addresses, message_id, in_reply_to, thread_id")
        .eq("id", emailId)
        .single();

      // Format email content
      const emailContent = `From: ${email.from_name || email.from_address}
To: ${fullEmail?.to_addresses?.join(", ") || "Unknown"}
Subject: ${email.subject || "(No subject)"}

${email.text_body || email.html_body || "(No content)"}`;

      await addMessage(supabase, conversation.id, "user", emailContent, {
        email_id: emailId,
        from_address: email.from_address,
        subject: email.subject || undefined,
        message_id: fullEmail?.message_id || undefined,
        in_reply_to: email.in_reply_to || undefined,
        thread_id: email.thread_id || undefined,
      });

      return { success: true };
    });

    // Step 4: Run AI agent to process and respond
    const agentResponse = await step.run("run-agent", async () => {
      const supabase = getAdminClient();

      // Get agent using the proper function
      const agent = await getAgentById(supabase, agentId);
      if (!agent) {
        throw new Error("Agent not found");
      }

      const { data: profile } = await supabase
        .from("users")
        .select("name, email, timezone")
        .eq("id", agent.userId)
        .single();

      // Build system prompt using the shared function (same as chat)
      const baseSystemPrompt = await buildSystemPrompt(
        agent,
        {
          id: agent.userId,
          name: profile?.name || "User",
          timezone: profile?.timezone,
          email: profile?.email,
        },
        "email" // channel source
      );

      // Add email-specific context to the prompt (including recipient type)
      const emailContextAddition = buildEmailContextPromptAddition(context, recipientType);
      const systemPrompt = `${baseSystemPrompt}\n\n${emailContextAddition}`;

      // Get conversation history
      const { data: messages } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(20);

      const conversationHistory = (messages || []).map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

      // Build comprehensive tools using the tool registry (same intelligence as chat endpoint)
      const baseTools = createToolRegistry({
        agentId,
        userId: agent.userId,
        supabase,
        conversationId: conversation.id,
        agentName: agent.name,
        userName: profile?.name || "User",
        userEmail: profile?.email,
        userTimezone: profile?.timezone,
      });

      // Add email-specific linking tools
      const emailTools = createEmailAgentTools({
        supabase,
        agentId,
        emailId,
        userId: agent.userId,
      });

      const tools = {
        ...baseTools,
        ...emailTools,
      };
      
      const aiAgent = new ToolLoopAgent({
        model: gateway("anthropic/claude-sonnet-4.5"),
        instructions: systemPrompt,
        tools,
        stopWhen: [],
      });

      // Run the agent
      try {
        const result = await aiAgent.generate({
          messages: conversationHistory,
        });

        // Save agent's response
        if (result.text) {
          await addMessage(supabase, conversation.id, "assistant", result.text);
        }

        // Extract tool usage stats
        const toolsUsed = result.steps
          .flatMap((s) => s.toolCalls || [])
          .map((tc) => tc.toolName);

        // Check if agent linked to anything
        const linkedToProject = toolsUsed.includes("linkEmailToProject");
        const linkedToTask = toolsUsed.includes("linkEmailToTask");
        const createdTask = toolsUsed.includes("createTaskFromEmail");
        const replied = toolsUsed.includes("replyToEmail");

        return {
          success: true,
          response: result.text,
          toolsUsed,
          linkedToProject,
          linkedToTask,
          createdTask,
          replied,
        };
      } catch (error) {
        console.error("[process-email] Agent error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    // Step 5: Mark email as processed
    await step.run("mark-as-processed", async () => {
      const supabase = getAdminClient();

      // Mark the email as processed by the agent
      await supabase
        .from("emails")
        .update({
          processed_by_agent: true,
          processed_at: new Date().toISOString(),
        })
        .eq("id", emailId);
    });

    // Step 6: Log completion
    await step.run("log-completion", async () => {
      const supabase = getAdminClient();

      // Build description
      const actions: string[] = [];
      if ("replied" in agentResponse && agentResponse.replied) actions.push("replied");
      if ("createdTask" in agentResponse && agentResponse.createdTask) actions.push("created task");
      if ("linkedToProject" in agentResponse && agentResponse.linkedToProject) actions.push("linked to project");
      if ("linkedToTask" in agentResponse && agentResponse.linkedToTask) actions.push("linked to task");

      const description = agentResponse.success
        ? actions.length > 0
          ? `Agent ${actions.join(", ")}`
          : "Agent reviewed the email"
        : `Agent encountered an error: ${"error" in agentResponse ? agentResponse.error : "Unknown error"}`;

      await logActivity(supabase, {
        agentId,
        activityType: "email_processed",
        source: "email",
        title: `Processed email from ${fromAddress}`,
        description,
        metadata: {
          email_id: emailId,
          conversation_id: conversation.id,
          tools_used: "toolsUsed" in agentResponse ? agentResponse.toolsUsed : [],
          replied: "replied" in agentResponse ? agentResponse.replied : false,
          created_task: "createdTask" in agentResponse ? agentResponse.createdTask : false,
          linked_to_project: "linkedToProject" in agentResponse ? agentResponse.linkedToProject : false,
          linked_to_task: "linkedToTask" in agentResponse ? agentResponse.linkedToTask : false,
          success: agentResponse.success,
          related_projects_found: context.relatedProjects.length,
          related_tasks_found: context.relatedTasks.length,
        },
        status: agentResponse.success ? "completed" : "failed",
      });
    });

    return {
      emailId,
      conversationId: conversation.id,
      agentResponse,
    };
  }
);
