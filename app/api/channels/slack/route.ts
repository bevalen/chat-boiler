import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getSlackCredentials,
  updateSlackCredentials,
  deleteChannelCredentials,
  setChannelActive,
} from "@/lib/db/channel-credentials";
import { SlackCredentials } from "@/lib/types/database";

/**
 * Get current user's Slack credentials
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { credentials, isActive, error } = await getSlackCredentials(
      supabase,
      user.id
    );

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    if (!credentials) {
      return NextResponse.json({
        configured: false,
        active: false,
      });
    }

    // Return credentials without the actual tokens (for security)
    return NextResponse.json({
      configured: true,
      active: isActive,
      team_id: credentials.team_id,
      team_name: credentials.team_name,
      user_slack_id: credentials.user_slack_id,
      default_channel_id: credentials.default_channel_id,
      // Don't return bot_token or app_token
    });
  } catch (error) {
    console.error("[slack] Error getting credentials:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Save/update Slack credentials
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      bot_token,
      app_token,
      user_slack_id,
      team_id,
      team_name,
      default_channel_id,
      is_active = true,
    } = body;

    // Get existing credentials to preserve tokens if not provided
    const { credentials: existingCredentials } = await getSlackCredentials(
      supabase,
      user.id
    );

    // For initial setup, require all fields
    // For updates, preserve existing tokens if not provided
    const finalBotToken = bot_token || existingCredentials?.bot_token;
    const finalAppToken = app_token || existingCredentials?.app_token;
    const finalUserSlackId = user_slack_id || existingCredentials?.user_slack_id;

    if (!finalBotToken || !finalAppToken || !finalUserSlackId) {
      return NextResponse.json(
        { error: "Missing required fields: bot_token, app_token, user_slack_id" },
        { status: 400 }
      );
    }

    const credentials: SlackCredentials = {
      bot_token: finalBotToken,
      app_token: finalAppToken,
      user_slack_id: finalUserSlackId,
      team_id: team_id || existingCredentials?.team_id,
      team_name: team_name || existingCredentials?.team_name,
      default_channel_id: default_channel_id || existingCredentials?.default_channel_id,
    };

    const { credentials: saved, error } = await updateSlackCredentials(
      supabase,
      user.id,
      credentials,
      is_active
    );

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      configured: true,
      active: saved?.isActive,
    });
  } catch (error) {
    console.error("[slack] Error saving credentials:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Update Slack active status
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { is_active } = body;

    if (typeof is_active !== "boolean") {
      return NextResponse.json(
        { error: "Missing required field: is_active (boolean)" },
        { status: 400 }
      );
    }

    const { success, error } = await setChannelActive(
      supabase,
      user.id,
      "slack",
      is_active
    );

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success, active: is_active });
  } catch (error) {
    console.error("[slack] Error updating status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Delete Slack credentials
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success, error } = await deleteChannelCredentials(
      supabase,
      user.id,
      "slack"
    );

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success });
  } catch (error) {
    console.error("[slack] Error deleting credentials:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
