/**
 * Email Attachment API
 * 
 * Provides secure access to email attachments with:
 * - Authentication check
 * - Authorization (user owns the email)
 * - Signed URLs for secure downloads
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAttachmentById, getAttachmentSignedUrl } from "@/lib/email/attachments";

/**
 * GET /api/attachments/[id]
 * 
 * Returns a signed URL for downloading the attachment
 * The URL is valid for 1 hour
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const attachmentId = (await params).id;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get attachment metadata
    const { attachment, error: attachmentError } = await getAttachmentById(
      supabase,
      attachmentId
    );

    if (attachmentError || !attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    // Verify user owns the email this attachment belongs to
    const { data: email, error: emailError } = await supabase
      .from("emails")
      .select("user_id")
      .eq("id", attachment.email_id)
      .single();

    if (emailError || !email || email.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if attachment has been downloaded and stored
    if (!attachment.storage_path || !attachment.is_downloaded) {
      return NextResponse.json(
        { error: "Attachment not yet downloaded" },
        { status: 404 }
      );
    }

    // Generate signed URL
    const { url, error: urlError } = await getAttachmentSignedUrl(
      supabase,
      attachment.storage_path
    );

    if (urlError || !url) {
      return NextResponse.json(
        { error: "Failed to generate download URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      attachment: {
        id: attachment.id,
        filename: attachment.filename,
        contentType: attachment.content_type,
        size: attachment.size_bytes,
        downloadUrl: url,
      },
    });
  } catch (error) {
    console.error("[api/attachments] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
