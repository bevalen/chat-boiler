/**
 * Email Attachment Management
 * 
 * Handles downloading attachments from Resend and storing in Supabase Storage
 * following best practices:
 * - Download immediately (URLs expire in 1 hour)
 * - Standard uploads for < 6MB, resumable for larger
 * - Organized by user/agent/email structure
 * - Secure access via RLS policies
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/types/database";
import { resend } from "./resend-client";

type AttachmentRow = Database["public"]["Tables"]["email_attachments"]["Row"];

export interface AttachmentMetadata {
  id: string;
  filename: string;
  contentType: string;
  size?: number;
}

/**
 * Download attachment from Resend and store in Supabase Storage
 * 
 * Best practices:
 * - Downloads immediately before URL expires (1 hour)
 * - Uses standard upload for files < 6MB
 * - Stores with path: {userId}/{agentId}/{emailId}/{filename}
 */
export async function downloadAndStoreAttachment(
  supabase: SupabaseClient<Database>,
  options: {
    attachmentId: string;
    resendEmailId: string;
    userId: string;
    agentId: string;
    emailId: string;
    filename: string;
    contentType: string;
  }
): Promise<{ success: boolean; storagePath?: string; error?: string }> {
  const { attachmentId, resendEmailId, userId, agentId, emailId, filename, contentType } = options;

  try {
    if (!resend) {
      return { success: false, error: "Resend client not initialized" };
    }

    // Get attachment download URL from Resend
    console.log(`[attachments] Fetching attachment ${attachmentId} from Resend`);
    const { data: attachmentData, error: resendError } = await resend.emails.receiving.attachments.get({
      emailId: resendEmailId,
      id: attachmentId,
    });

    if (resendError || !attachmentData) {
      console.error("[attachments] Failed to get attachment from Resend:", resendError);
      return { success: false, error: resendError?.message || "Failed to get attachment" };
    }

    // Download the file content
    console.log(`[attachments] Downloading attachment content`);
    const downloadUrl = (attachmentData as any).download_url;
    if (!downloadUrl) {
      return { success: false, error: "No download URL provided by Resend" };
    }

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      return { success: false, error: `Failed to download attachment: ${response.statusText}` };
    }

    const fileBuffer = await response.arrayBuffer();
    const fileSize = fileBuffer.byteLength;

    console.log(`[attachments] Downloaded ${fileSize} bytes`);

    // Sanitize filename to prevent path traversal
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

    // Construct storage path: userId/agentId/emailId/filename
    const storagePath = `${userId}/${agentId}/${emailId}/${sanitizedFilename}`;

    // Upload to Supabase Storage
    // Use standard upload (files are typically < 6MB per Resend limits)
    console.log(`[attachments] Uploading to Supabase Storage: ${storagePath}`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("email-attachments")
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[attachments] Failed to upload to storage:", uploadError);
      return { success: false, error: uploadError.message };
    }

    console.log(`[attachments] Successfully stored attachment at ${storagePath}`);

    // Update attachment record in database
    const { error: updateError } = await supabase
      .from("email_attachments")
      .update({
        storage_path: storagePath,
        size_bytes: fileSize,
        is_downloaded: true,
        downloaded_at: new Date().toISOString(),
      })
      .eq("resend_attachment_id", attachmentId)
      .eq("email_id", emailId);

    if (updateError) {
      console.error("[attachments] Failed to update attachment record:", updateError);
      // Don't fail - file is stored, just metadata update failed
    }

    return { success: true, storagePath };
  } catch (error) {
    console.error("[attachments] Error downloading/storing attachment:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Download all attachments for an email
 */
export async function downloadEmailAttachments(
  supabase: SupabaseClient<Database>,
  options: {
    resendEmailId: string;
    emailId: string;
    userId: string;
    agentId: string;
    attachments: AttachmentMetadata[];
  }
): Promise<{ successCount: number; failedCount: number; errors: string[] }> {
  const { resendEmailId, emailId, userId, agentId, attachments } = options;

  const results = await Promise.allSettled(
    attachments.map((attachment) =>
      downloadAndStoreAttachment(supabase, {
        attachmentId: attachment.id,
        resendEmailId,
        userId,
        agentId,
        emailId,
        filename: attachment.filename,
        contentType: attachment.contentType,
      })
    )
  );

  const successCount = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
  const failedCount = results.length - successCount;
  const errors = results
    .filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success))
    .map((r) => {
      if (r.status === "rejected") return r.reason;
      if (r.status === "fulfilled") return r.value.error || "Unknown error";
      return "Unknown error";
    });

  console.log(`[attachments] Downloaded ${successCount}/${attachments.length} attachments for email ${emailId}`);

  return { successCount, failedCount, errors };
}

/**
 * Get a signed URL for accessing an attachment
 * URLs are valid for 1 hour
 */
export async function getAttachmentSignedUrl(
  supabase: SupabaseClient<Database>,
  storagePath: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.storage
    .from("email-attachments")
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    return { url: null, error: error.message };
  }

  return { url: data.signedUrl, error: null };
}

/**
 * Download an attachment directly (for agent access)
 */
export async function downloadAttachment(
  supabase: SupabaseClient<Database>,
  storagePath: string
): Promise<{ data: Blob | null; error: string | null }> {
  const { data, error } = await supabase.storage
    .from("email-attachments")
    .download(storagePath);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * Get attachment metadata by ID
 */
export async function getAttachmentById(
  supabase: SupabaseClient<Database>,
  attachmentId: string
): Promise<{ attachment: AttachmentRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("email_attachments")
    .select()
    .eq("id", attachmentId)
    .single();

  if (error) {
    return { attachment: null, error: error.message };
  }

  return { attachment: data, error: null };
}

/**
 * Delete an attachment from storage and database
 */
export async function deleteAttachment(
  supabase: SupabaseClient<Database>,
  attachmentId: string
): Promise<{ success: boolean; error: string | null }> {
  // Get attachment to find storage path
  const { attachment, error: getError } = await getAttachmentById(supabase, attachmentId);
  
  if (getError || !attachment) {
    return { success: false, error: getError || "Attachment not found" };
  }

  // Delete from storage if stored
  if (attachment.storage_path) {
    const { error: storageError } = await supabase.storage
      .from("email-attachments")
      .remove([attachment.storage_path]);

    if (storageError) {
      console.error("[attachments] Failed to delete from storage:", storageError);
      // Continue to delete database record anyway
    }
  }

  // Delete database record
  const { error: deleteError } = await supabase
    .from("email_attachments")
    .delete()
    .eq("id", attachmentId);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  return { success: true, error: null };
}
