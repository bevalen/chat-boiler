import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { testSlackConnection } from "@/lib/slack";
import { SlackCredentials } from "@/lib/types/database";

/**
 * Test Slack connection with provided credentials
 * Used by the settings UI to verify credentials before saving
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
    const { bot_token, app_token, user_slack_id } = body;

    if (!bot_token || !app_token) {
      return NextResponse.json(
        { error: "Missing required fields: bot_token, app_token" },
        { status: 400 }
      );
    }

    const credentials: SlackCredentials = {
      bot_token,
      app_token,
      user_slack_id: user_slack_id || "",
    };

    const result = await testSlackConnection(credentials);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Connection test failed",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      team_name: result.teamName,
      bot_name: result.botName,
    });
  } catch (error) {
    console.error("[slack/test] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
