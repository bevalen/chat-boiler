/**
 * Agent Tools for Email Attachments
 * 
 * Provides AI agent with ability to:
 * - List attachments for an email
 * - Download attachment content
 * - Get attachment metadata
 */

import { tool } from "ai";
import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/types/database";
import { getAttachmentById, downloadAttachment } from "@/lib/email/attachments";

/**
 * Create tools for accessing email attachments
 */
export function createAttachmentTools(
  supabase: SupabaseClient<Database>,
  agentId: string
) {
  return {
    listEmailAttachments: tool({
      description:
        "List all attachments for a specific email. Use this when you need to see what files were attached to an email.",
      inputSchema: z.object({
        emailId: z.string().describe("The ID of the email to get attachments for"),
      }),
      execute: async ({ emailId }) => {
        // Verify email belongs to this agent
        const { data: email, error: emailError } = await supabase
          .from("emails")
          .select("id")
          .eq("id", emailId)
          .eq("agent_id", agentId)
          .single();

        if (emailError || !email) {
          return {
            success: false,
            error: "Email not found or not accessible",
          };
        }

        // Get attachments
        const { data: attachments, error } = await supabase
          .from("email_attachments")
          .select()
          .eq("email_id", emailId);

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          count: attachments?.length || 0,
          attachments: attachments?.map((att) => ({
            id: att.id,
            filename: att.filename,
            contentType: att.content_type,
            size: att.size_bytes,
            isDownloaded: att.is_downloaded,
            downloadedAt: att.downloaded_at,
          })),
        };
      },
    }),

    getAttachmentInfo: tool({
      description:
        "Get detailed information about a specific attachment including its metadata and availability.",
      inputSchema: z.object({
        attachmentId: z.string().describe("The ID of the attachment"),
      }),
      execute: async ({ attachmentId }) => {
        const { attachment, error } = await getAttachmentById(
          supabase,
          attachmentId
        );

        if (error || !attachment) {
          return {
            success: false,
            error: error || "Attachment not found",
          };
        }

        // Verify attachment belongs to an email owned by this agent
        const { data: email, error: emailError } = await supabase
          .from("emails")
          .select("agent_id")
          .eq("id", attachment.email_id)
          .single();

        if (emailError || !email || email.agent_id !== agentId) {
          return {
            success: false,
            error: "Attachment not found or not accessible",
          };
        }

        return {
          success: true,
          attachment: {
            id: attachment.id,
            filename: attachment.filename,
            contentType: attachment.content_type,
            size: attachment.size_bytes,
            isDownloaded: attachment.is_downloaded,
            storagePath: attachment.storage_path,
            downloadedAt: attachment.downloaded_at,
            emailId: attachment.email_id,
          },
        };
      },
    }),

    readAttachmentContent: tool({
      description:
        "Download and read the content of an attachment. Use this when you need to analyze the contents of a file (e.g., read a text document, parse CSV data). Returns the file content as text if possible.",
      inputSchema: z.object({
        attachmentId: z.string().describe("The ID of the attachment to read"),
      }),
      execute: async ({ attachmentId }) => {
        // Get attachment metadata
        const { attachment, error: getError } = await getAttachmentById(
          supabase,
          attachmentId
        );

        if (getError || !attachment) {
          return {
            success: false,
            error: getError || "Attachment not found",
          };
        }

        // Verify attachment belongs to an email owned by this agent
        const { data: email, error: emailError } = await supabase
          .from("emails")
          .select("agent_id")
          .eq("id", attachment.email_id)
          .single();

        if (emailError || !email || email.agent_id !== agentId) {
          return {
            success: false,
            error: "Attachment not found or not accessible",
          };
        }

        // Check if downloaded
        if (!attachment.storage_path || !attachment.is_downloaded) {
          return {
            success: false,
            error: "Attachment has not been downloaded yet",
          };
        }

        // Download the file
        const { data: blob, error: downloadError } = await downloadAttachment(
          supabase,
          attachment.storage_path
        );

        if (downloadError || !blob) {
          return {
            success: false,
            error: downloadError || "Failed to download attachment",
          };
        }

        // Try to read as text if it's a text-based file
        const textTypes = [
          "text/",
          "application/json",
          "application/xml",
          "application/javascript",
        ];
        const isTextFile = textTypes.some(
          (type) => attachment.content_type?.startsWith(type)
        );

        if (isTextFile) {
          try {
            const text = await blob.text();
            return {
              success: true,
              filename: attachment.filename,
              contentType: attachment.content_type,
              size: attachment.size_bytes,
              content: text,
              type: "text",
            };
          } catch (error) {
            return {
              success: false,
              error: "Failed to read file as text",
            };
          }
        }

        // For binary files, return metadata only
        return {
          success: true,
          filename: attachment.filename,
          contentType: attachment.content_type,
          size: attachment.size_bytes,
          type: "binary",
          message:
            "This is a binary file. Content cannot be read as text. You can reference this attachment in your response to the user.",
        };
      },
    }),
  };
}
