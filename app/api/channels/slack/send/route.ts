import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getSlackCredentials, getUserBySlackId } from "@/lib/db/channel-credentials";
import { createSlackClient, sendSlackMessage, sendSlackDirectMessage } from "@/lib/slack";
import { SlackCredentials } from "@/lib/types/database";

interface SendSlackRequest {
  user_id: string;
  message: string;
  channel_id?: string;
  thread_ts?: string;
  use_dm?: boolean;
}

/**
 * Internal API endpoint for sending messages to Slack
 * Used by the agent response handler and the cron dispatcher
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal authorization
    const authHeader = request.headers.get("authorization");
    const internalSecret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;

    // Allow requests without auth in development, but require in production
    if (process.env.NODE_ENV === "production" && internalSecret) {
      if (authHeader !== `Bearer ${internalSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body: SendSlackRequest = await request.json();
    const { user_id, message, channel_id, thread_ts, use_dm = true } = body;

    if (!user_id || !message) {
      return NextResponse.json(
        { error: "Missing required fields: user_id, message" },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // Get user's Slack credentials
    const { credentials, isActive, error: credError } = await getSlackCredentials(
      supabase,
      user_id
    );

    if (credError) {
      console.error("[slack/send] Error fetching credentials:", credError);
      return NextResponse.json(
        { error: "Failed to fetch Slack credentials" },
        { status: 500 }
      );
    }

    if (!credentials || !isActive) {
      return NextResponse.json(
        { error: "Slack not configured or inactive for this user" },
        { status: 404 }
      );
    }

    // Create Slack client
    const client = createSlackClient(credentials);

    let result;

    if (channel_id) {
      // Send to specific channel
      result = await sendSlackMessage(client, {
        channelId: channel_id,
        text: message,
        threadTs: thread_ts,
      });
    } else if (use_dm && credentials.user_slack_id) {
      // Send as DM to user
      result = await sendSlackDirectMessage(
        client,
        credentials.user_slack_id,
        message,
        thread_ts
      );
    } else if (credentials.default_channel_id) {
      // Send to default channel
      result = await sendSlackMessage(client, {
        channelId: credentials.default_channel_id,
        text: message,
        threadTs: thread_ts,
      });
    } else {
      return NextResponse.json(
        { error: "No channel specified and no default channel configured" },
        { status: 400 }
      );
    }

    if (!result.success) {
      console.error("[slack/send] Failed to send message:", result.error);
      return NextResponse.json(
        { error: result.error || "Failed to send Slack message" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message_ts: result.messageTs,
      channel_id: result.channelId,
    });
  } catch (error) {
    console.error("[slack/send] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Helper endpoint to verify Slack is working for a user
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json(
      { error: "Missing user_id parameter" },
      { status: 400 }
    );
  }

  const supabase = getAdminClient();

  const { credentials, isActive, error } = await getSlackCredentials(
    supabase,
    userId
  );

  if (error) {
    return NextResponse.json(
      { error: "Failed to check Slack status" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    configured: credentials !== null,
    active: isActive,
    has_user_id: !!credentials?.user_slack_id,
    has_default_channel: !!credentials?.default_channel_id,
  });
}
