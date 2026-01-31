import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getAgentForUser } from "@/lib/db/agents";
import { updateLinkedInCredentials } from "@/lib/db/channel-credentials";
import { LinkedInCredentials } from "@/lib/types/database";
import { randomBytes } from "crypto";

/**
 * POST /api/auth/extension
 * 
 * Generate an extension token for the LinkedIn SDR Chrome extension.
 * Requires authenticated user session.
 * 
 * Request body:
 * {
 *   extensionId?: string  // Optional extension identifier
 *   settings?: {
 *     autoRespond?: boolean
 *     draftMode?: boolean
 *     activeHoursOnly?: boolean
 *     responseDelaySeconds?: number
 *     activeHoursStart?: string
 *     activeHoursEnd?: string
 *     activeDays?: string[]
 *   }
 * }
 * 
 * Response:
 * {
 *   token: string
 *   expiresAt: string
 *   userId: string
 *   agentId: string
 * }
 */
export async function POST(request: Request) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in first." },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { extensionId, settings } = body as {
      extensionId?: string;
      settings?: {
        autoRespond?: boolean;
        draftMode?: boolean;
        activeHoursOnly?: boolean;
        responseDelaySeconds?: number;
        activeHoursStart?: string;
        activeHoursEnd?: string;
        activeDays?: string[];
      };
    };

    // Get user's agent
    const agent = await getAgentForUser(supabase, user.id);
    if (!agent) {
      return NextResponse.json(
        { error: "No agent found. Please set up your assistant first." },
        { status: 400 }
      );
    }

    // Generate a secure token
    const token = randomBytes(32).toString("hex");
    
    // Token expires in 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Build LinkedIn credentials
    const linkedInCredentials: LinkedInCredentials = {
      extension_token: token,
      extension_id: extensionId,
      capabilities: {
        auto_respond: settings?.autoRespond ?? false,
        draft_mode: settings?.draftMode ?? true, // Default to draft mode for safety
        active_hours_only: settings?.activeHoursOnly ?? false,
      },
      settings: {
        response_delay_seconds: settings?.responseDelaySeconds ?? 3,
        active_hours_start: settings?.activeHoursStart ?? "09:00",
        active_hours_end: settings?.activeHoursEnd ?? "17:00",
        active_days: settings?.activeDays ?? ["monday", "tuesday", "wednesday", "thursday", "friday"],
      },
      token_expires_at: expiresAt.toISOString(),
    };

    // Save credentials to database using admin client
    const adminClient = getAdminClient();
    const { credentials, error: saveError } = await updateLinkedInCredentials(
      adminClient,
      user.id,
      linkedInCredentials,
      true // isActive
    );

    if (saveError || !credentials) {
      console.error("[auth/extension] Error saving credentials:", saveError);
      return NextResponse.json(
        { error: "Failed to save extension credentials" },
        { status: 500 }
      );
    }

    console.log(`[auth/extension] Token generated for user ${user.id}`);

    return NextResponse.json({
      success: true,
      token,
      expiresAt: expiresAt.toISOString(),
      userId: user.id,
      agentId: agent.id,
      settings: linkedInCredentials.settings,
      capabilities: linkedInCredentials.capabilities,
    });
  } catch (error) {
    console.error("[auth/extension] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/extension
 * 
 * Check if the user has an active LinkedIn extension token.
 * Requires authenticated user session.
 */
export async function GET() {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get LinkedIn credentials
    const { data: credentials } = await supabase
      .from("user_channel_credentials")
      .select("credentials, is_active, updated_at")
      .eq("user_id", user.id)
      .eq("channel_type", "linkedin")
      .single();

    if (!credentials) {
      return NextResponse.json({
        hasToken: false,
        isActive: false,
      });
    }

    const linkedInCreds = credentials.credentials as LinkedInCredentials;
    const expiresAt = linkedInCreds.token_expires_at ? new Date(linkedInCreds.token_expires_at) : null;
    const isExpired = expiresAt ? expiresAt < new Date() : true;

    return NextResponse.json({
      hasToken: true,
      isActive: credentials.is_active && !isExpired,
      isExpired,
      expiresAt: linkedInCreds.token_expires_at,
      settings: linkedInCreds.settings,
      capabilities: linkedInCreds.capabilities,
      lastUpdated: credentials.updated_at,
    });
  } catch (error) {
    console.error("[auth/extension] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/extension
 * 
 * Revoke the LinkedIn extension token.
 * Requires authenticated user session.
 */
export async function DELETE() {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Deactivate LinkedIn credentials
    const { error: updateError } = await supabase
      .from("user_channel_credentials")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("channel_type", "linkedin");

    if (updateError) {
      console.error("[auth/extension] Error revoking token:", updateError);
      return NextResponse.json(
        { error: "Failed to revoke token" },
        { status: 500 }
      );
    }

    console.log(`[auth/extension] Token revoked for user ${user.id}`);

    return NextResponse.json({
      success: true,
      message: "Extension token revoked successfully",
    });
  } catch (error) {
    console.error("[auth/extension] DELETE Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
