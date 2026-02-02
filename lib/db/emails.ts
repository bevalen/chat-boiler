import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/types/database";

type EmailRow = Database["public"]["Tables"]["emails"]["Row"];
type EmailInsert = Database["public"]["Tables"]["emails"]["Insert"];
type EmailUpdate = Database["public"]["Tables"]["emails"]["Update"];
type AttachmentRow = Database["public"]["Tables"]["email_attachments"]["Row"];
type AttachmentInsert = Database["public"]["Tables"]["email_attachments"]["Insert"];

export interface InboundEmailData {
  userId: string;
  agentId: string;
  resendEmailId: string;
  fromAddress: string;
  fromName?: string;
  toAddresses: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  subject: string;
  htmlBody?: string;
  textBody?: string;
  messageId?: string;
  inReplyTo?: string;
  headers?: Record<string, unknown>;
  receivedAt: string;
  attachments?: {
    resendAttachmentId: string;
    filename: string;
    contentType?: string;
    downloadUrl?: string;
    downloadUrlExpiresAt?: string;
  }[];
}

export interface OutboundEmailData {
  userId: string;
  agentId: string;
  resendEmailId?: string;
  fromAddress: string;
  fromName?: string;
  toAddresses: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  replyToAddress?: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  messageId?: string;
  inReplyTo?: string;
  threadId?: string;
  referencesIds?: string[];
  sentAt?: string;
}

/**
 * Store an inbound email received via webhook
 */
export async function storeInboundEmail(
  supabase: SupabaseClient<Database>,
  data: InboundEmailData
): Promise<{ email: EmailRow | null; error: string | null }> {
  const {
    userId,
    agentId,
    resendEmailId,
    fromAddress,
    fromName,
    toAddresses,
    ccAddresses,
    bccAddresses,
    subject,
    htmlBody,
    textBody,
    messageId,
    inReplyTo,
    headers,
    receivedAt,
    attachments,
  } = data;

  // Try to find existing thread by inReplyTo or messageId
  let threadId: string | null = null;
  if (inReplyTo) {
    const { data: existingEmail } = await supabase
      .from("emails")
      .select("thread_id")
      .eq("agent_id", agentId)
      .eq("message_id", inReplyTo)
      .single();
    
    if (existingEmail?.thread_id) {
      threadId = existingEmail.thread_id;
    }
  }

  // Generate new thread ID if not found
  if (!threadId) {
    threadId = `thread-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  // Insert the email
  const emailInsert: EmailInsert = {
    user_id: userId,
    agent_id: agentId,
    resend_email_id: resendEmailId,
    direction: "inbound",
    status: "received",
    message_id: messageId || null,
    in_reply_to: inReplyTo || null,
    thread_id: threadId,
    from_address: fromAddress,
    from_name: fromName || null,
    to_addresses: toAddresses,
    cc_addresses: ccAddresses || null,
    bcc_addresses: bccAddresses || null,
    subject,
    html_body: htmlBody || null,
    text_body: textBody || null,
    headers: headers || null,
    is_read: false,
    received_at: receivedAt,
  };

  const { data: email, error } = await supabase
    .from("emails")
    .insert(emailInsert)
    .select()
    .single();

  if (error) {
    console.error("[db/emails] Error storing inbound email:", error);
    return { email: null, error: error.message };
  }

  // Store attachments if any
  if (attachments && attachments.length > 0 && email) {
    const attachmentInserts: AttachmentInsert[] = attachments.map((att) => ({
      email_id: email.id,
      resend_attachment_id: att.resendAttachmentId,
      filename: att.filename,
      content_type: att.contentType || null,
      download_url: att.downloadUrl || null,
      download_url_expires_at: att.downloadUrlExpiresAt || null,
      is_downloaded: false,
    }));

    const { error: attError } = await supabase
      .from("email_attachments")
      .insert(attachmentInserts);

    if (attError) {
      console.error("[db/emails] Error storing attachments:", attError);
      // Don't fail the whole operation
    }
  }

  return { email, error: null };
}

/**
 * Store an outbound email after sending
 */
export async function storeOutboundEmail(
  supabase: SupabaseClient<Database>,
  data: OutboundEmailData
): Promise<{ email: EmailRow | null; error: string | null }> {
  const emailInsert: EmailInsert = {
    user_id: data.userId,
    agent_id: data.agentId,
    resend_email_id: data.resendEmailId || null,
    direction: "outbound",
    status: "sent",
    message_id: data.messageId || null,
    in_reply_to: data.inReplyTo || null,
    thread_id: data.threadId || `thread-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    references_ids: data.referencesIds || null,
    from_address: data.fromAddress,
    from_name: data.fromName || null,
    to_addresses: data.toAddresses,
    cc_addresses: data.ccAddresses || null,
    bcc_addresses: data.bccAddresses || null,
    reply_to_address: data.replyToAddress || null,
    subject: data.subject,
    html_body: data.htmlBody || null,
    text_body: data.textBody || null,
    sent_at: data.sentAt || new Date().toISOString(),
  };

  const { data: email, error } = await supabase
    .from("emails")
    .insert(emailInsert)
    .select()
    .single();

  if (error) {
    console.error("[db/emails] Error storing outbound email:", error);
    return { email: null, error: error.message };
  }

  return { email, error: null };
}

/**
 * Get an email by ID
 */
export async function getEmailById(
  supabase: SupabaseClient<Database>,
  emailId: string
): Promise<{ email: EmailRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("emails")
    .select()
    .eq("id", emailId)
    .single();

  if (error) {
    return { email: null, error: error.message };
  }

  return { email: data, error: null };
}

/**
 * Get unread emails for an agent's inbox
 */
export async function getInboxEmails(
  supabase: SupabaseClient<Database>,
  agentId: string,
  options: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
    direction?: "inbound" | "outbound" | "all";
  } = {}
): Promise<{ emails: EmailRow[]; error: string | null }> {
  const { unreadOnly = false, limit = 50, offset = 0, direction = "all" } = options;

  let query = supabase
    .from("emails")
    .select()
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  if (direction !== "all") {
    query = query.eq("direction", direction);
  }

  const { data, error } = await query;

  if (error) {
    return { emails: [], error: error.message };
  }

  return { emails: data || [], error: null };
}

/**
 * Mark an email as read
 */
export async function markEmailAsRead(
  supabase: SupabaseClient<Database>,
  emailId: string
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from("emails")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", emailId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Mark multiple emails as read
 */
export async function markEmailsAsRead(
  supabase: SupabaseClient<Database>,
  emailIds: string[]
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from("emails")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .in("id", emailIds);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Update email status (for delivery webhooks)
 */
export async function updateEmailStatus(
  supabase: SupabaseClient<Database>,
  resendEmailId: string,
  status: "delivered" | "bounced" | "failed",
  additionalData?: {
    bounceReason?: string;
    deliveredAt?: string;
    bouncedAt?: string;
  }
): Promise<{ success: boolean; error: string | null }> {
  const update: EmailUpdate = {
    status,
    ...(additionalData?.bounceReason && { bounce_reason: additionalData.bounceReason }),
    ...(additionalData?.deliveredAt && { delivered_at: additionalData.deliveredAt }),
    ...(additionalData?.bouncedAt && { bounced_at: additionalData.bouncedAt }),
  };

  const { error } = await supabase
    .from("emails")
    .update(update)
    .eq("resend_email_id", resendEmailId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Get emails in a thread
 */
export async function getEmailThread(
  supabase: SupabaseClient<Database>,
  threadId: string
): Promise<{ emails: EmailRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("emails")
    .select()
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) {
    return { emails: [], error: error.message };
  }

  return { emails: data || [], error: null };
}

/**
 * Get attachments for an email
 */
export async function getEmailAttachments(
  supabase: SupabaseClient<Database>,
  emailId: string
): Promise<{ attachments: AttachmentRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("email_attachments")
    .select()
    .eq("email_id", emailId);

  if (error) {
    return { attachments: [], error: error.message };
  }

  return { attachments: data || [], error: null };
}

/**
 * Update attachment storage info after downloading
 */
export async function updateAttachmentStorage(
  supabase: SupabaseClient<Database>,
  attachmentId: string,
  storagePath: string,
  sizeBytes?: number
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from("email_attachments")
    .update({
      storage_path: storagePath,
      size_bytes: sizeBytes || null,
      is_downloaded: true,
      downloaded_at: new Date().toISOString(),
    })
    .eq("id", attachmentId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Get unread email count for an agent
 */
export async function getUnreadEmailCount(
  supabase: SupabaseClient<Database>,
  agentId: string
): Promise<{ count: number; error: string | null }> {
  const { count, error } = await supabase
    .from("emails")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("is_read", false)
    .eq("direction", "inbound");

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: count || 0, error: null };
}

/**
 * Find agent by email address (for routing inbound emails)
 */
export async function findAgentByEmailAddress(
  supabase: SupabaseClient<Database>,
  emailAddress: string
): Promise<{ agent: { id: string; user_id: string; name: string } | null; error: string | null }> {
  // Extract agent ID from email address format: agent-{agentId}@domain
  const match = emailAddress.match(/^agent-([a-f0-9-]+)@/i);
  
  if (!match) {
    return { agent: null, error: "Invalid agent email address format" };
  }

  const agentId = match[1];

  // Find the agent directly by ID
  const { data, error } = await supabase
    .from("agents")
    .select("id, user_id, name")
    .eq("id", agentId)
    .single();

  if (error) {
    return { agent: null, error: error.message };
  }

  return { agent: data, error: null };
}
