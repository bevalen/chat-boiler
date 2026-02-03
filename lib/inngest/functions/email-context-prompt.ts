/**
 * Email context prompt builder
 * Builds the email-specific context addition to the base system prompt
 */

import type { EmailContext } from "@/lib/db/search";

/**
 * Build email-specific context addition to the base system prompt
 * This adds the email context to the standard buildSystemPrompt output
 */
export function buildEmailContextPromptAddition(
  context: EmailContext,
  recipientType?: "to" | "cc" | "bcc"
): string {
  const sections: string[] = [];

  sections.push(`## 📧 INCOMING EMAIL CONTEXT`);
  sections.push(`You're processing an incoming email. Here's what you need to know:\n`);

  sections.push(`### Current Email`);
  sections.push(`**From:** ${context.email.from_name || context.email.from_address}`);
  sections.push(`**Subject:** ${context.email.subject || "(No subject)"}`);

  // Important: Indicate how the agent was addressed
  if (recipientType === "cc") {
    sections.push(
      `**⚠️ IMPORTANT:** You were CC'd on this email (not the primary recipient). This email is primarily addressed to someone else, and you're included for awareness. Be judicious about whether to reply - only respond if:`
    );
    sections.push(`  - You're directly asked a question`);
    sections.push(`  - There's a clear action item for you`);
    sections.push(`  - Your input would add significant value`);
    sections.push(
      `  - Otherwise, you may just want to mark it as read and save any relevant information to memory`
    );
  } else if (recipientType === "bcc") {
    sections.push(
      `**⚠️ IMPORTANT:** You were BCC'd on this email (hidden recipient). This email is for your awareness only. DO NOT reply unless absolutely critical, as the sender intended for you to observe silently.`
    );
  } else {
    sections.push(`**Recipient Status:** You are a direct recipient (TO) of this email.`);
  }

  sections.push(`**Content:**`);
  sections.push(context.email.text_body || context.email.html_body || "(No content)");
  sections.push(``);

  // Email thread history
  if (context.threadHistory.length > 0) {
    sections.push(`### Email Thread History`);
    sections.push(`This email is part of an ongoing conversation:`);
    context.threadHistory.forEach((email) => {
      sections.push(`- [${email.direction}] ${email.from_address}: ${email.subject || "(No subject)"}`);
      if (email.text_body) {
        sections.push(
          `  ${email.text_body.substring(0, 150)}${email.text_body.length > 150 ? "..." : ""}`
        );
      }
    });
    sections.push(``);
  }

  // Related projects
  if (context.relatedProjects.length > 0) {
    sections.push(`### Related Projects (AI-Detected via Semantic Search)`);
    sections.push(`These projects might be related to this email:`);
    context.relatedProjects.forEach((project) => {
      sections.push(
        `- **${project.title}** (ID: \`${project.id}\`, ${project.status}, ${Math.round(project.similarity * 100)}% match)`
      );
      if (project.description) {
        sections.push(
          `  ${project.description.substring(0, 150)}${project.description.length > 150 ? "..." : ""}`
        );
      }
    });
    sections.push(``);
  }

  // Related tasks
  if (context.relatedTasks.length > 0) {
    sections.push(`### Related Tasks (AI-Detected via Semantic Search)`);
    sections.push(`These tasks might be related to this email:`);
    context.relatedTasks.forEach((task) => {
      sections.push(
        `- **${task.title}** (ID: \`${task.id}\`, ${task.status}, ${Math.round(task.similarity * 100)}% match)`
      );
    });
    sections.push(``);
  }

  // Related conversations
  if (context.relatedConversations.length > 0) {
    sections.push(`### Related Past Conversations`);
    context.relatedConversations.forEach((conv) => {
      sections.push(`- **${conv.title || "Untitled"}** (${conv.channel_type})`);
      if (conv.recentMessage) {
        sections.push(`  Recent: ${conv.recentMessage.substring(0, 100)}...`);
      }
    });
    sections.push(``);
  }

  // Semantic context
  if (context.semanticContext) {
    sections.push(context.semanticContext);
    sections.push(``);
  }

  sections.push(`## Email Processing Instructions`);
  sections.push(`1. **Understand:** Read the email and thread history carefully`);
  sections.push(
    `2. **Check for Task Completion:** Before creating new tasks, check if this email resolves any existing open tasks:`
  );
  sections.push(`   - Look at the related tasks shown above`);
  sections.push(
    `   - If this email provides the information or confirmation you were waiting for, use \`updateTaskFromEmail\` to mark the task as "done"`
  );
  sections.push(
    `   - Examples: reply confirming a meeting, answering a question you asked, providing requested information`
  );
  sections.push(`3. **Link:** Use \`linkEmailToProject\` or \`linkEmailToTask\` if this relates to existing work`);
  sections.push(`4. **Act:**`);
  sections.push(`   - Use \`replyToEmail\` for responses (maintains threading)`);
  sections.push(
    `   - Use \`createTaskFromEmail\` for NEW action items (tool automatically checks for duplicates)`
  );
  sections.push(`   - Use \`createProject\` for new initiatives mentioned in email`);
  sections.push(`   - Use \`markEmailAsRead\` for spam/automated emails`);
  sections.push(`5. **Remember:** Save important info to memory if the user shares preferences or context`);
  sections.push(``);
  sections.push(
    `**Be contextually aware:** Use the related projects/tasks above to maintain continuity across long-running work.`
  );
  sections.push(
    `**Important:** If you sent an email asking for information and this is the reply, mark that task as complete!`
  );

  return sections.join("\n");
}
