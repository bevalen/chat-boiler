import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";
import { getEmailById, getEmailAttachments, markEmailAsRead, getEmailThread } from "@/lib/db/emails";

/**
 * GET /api/emails/[id]
 * Get a single email with its attachments and thread
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: emailId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agent = await getAgentForUser(supabase, user.id);
    if (!agent) {
      return NextResponse.json({ error: "No agent found" }, { status: 404 });
    }

    // Fetch the email
    const { email, error } = await getEmailById(supabase, emailId);

    if (error || !email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Verify the email belongs to this agent
    if (email.agent_id !== agent.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch attachments
    const { attachments } = await getEmailAttachments(supabase, emailId);

    // Fetch thread if email has a thread_id
    let thread: typeof email[] = [];
    if (email.thread_id) {
      const { emails: threadEmails } = await getEmailThread(supabase, email.thread_id);
      thread = threadEmails;
    }

    return NextResponse.json({
      email,
      attachments,
      thread,
    });
  } catch (error) {
    console.error("[api/emails/[id]] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/emails/[id]
 * Update email (mark as read/unread)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: emailId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agent = await getAgentForUser(supabase, user.id);
    if (!agent) {
      return NextResponse.json({ error: "No agent found" }, { status: 404 });
    }

    // Verify the email belongs to this agent
    const { email, error: fetchError } = await getEmailById(supabase, emailId);
    if (fetchError || !email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }
    if (email.agent_id !== agent.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse body
    const body = await req.json();
    const { is_read } = body;

    if (typeof is_read !== "boolean") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (is_read) {
      // Mark as read
      const { success, error } = await markEmailAsRead(supabase, emailId);
      if (!success) {
        return NextResponse.json(
          { error: error || "Failed to mark as read" },
          { status: 500 }
        );
      }
    } else {
      // Mark as unread
      const { error } = await supabase
        .from("emails")
        .update({
          is_read: false,
          read_at: null,
        })
        .eq("id", emailId);

      if (error) {
        return NextResponse.json(
          { error: "Failed to mark as unread" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/emails/[id]] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
