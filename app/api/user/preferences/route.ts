import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET user preferences
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("users")
      .select("preferred_notification_channel")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching user preferences:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      preferred_notification_channel: data?.preferred_notification_channel || "app",
    });
  } catch (error) {
    console.error("Error in GET /api/user/preferences:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH update user preferences
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { preferred_notification_channel } = body;

    // Validate the channel
    const validChannels = ["app", "slack", "email", "sms"];
    if (preferred_notification_channel && !validChannels.includes(preferred_notification_channel)) {
      return NextResponse.json({ error: "Invalid notification channel" }, { status: 400 });
    }

    // If setting to Slack, verify the user has Slack configured
    if (preferred_notification_channel === "slack") {
      const { data: credentials } = await supabase
        .from("user_channel_credentials")
        .select("is_active")
        .eq("user_id", user.id)
        .eq("channel_type", "slack")
        .single();

      if (!credentials?.is_active) {
        return NextResponse.json({ 
          error: "Please configure and enable Slack before setting it as your preferred channel" 
        }, { status: 400 });
      }
    }

    const { error } = await supabase
      .from("users")
      .update({ preferred_notification_channel })
      .eq("id", user.id);

    if (error) {
      console.error("Error updating user preferences:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      preferred_notification_channel,
    });
  } catch (error) {
    console.error("Error in PATCH /api/user/preferences:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
