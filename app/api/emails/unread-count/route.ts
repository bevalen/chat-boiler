import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";
import { getUnreadEmailCount } from "@/lib/db/emails";

/**
 * GET /api/emails/unread-count
 * Get the count of unread emails for the authenticated user's agent
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

    const agent = await getAgentForUser(supabase, user.id);
    if (!agent) {
      return NextResponse.json({ error: "No agent found" }, { status: 404 });
    }

    const { count, error } = await getUnreadEmailCount(supabase, agent.id);

    if (error) {
      console.error("[api/emails/unread-count] Error:", error);
      return NextResponse.json(
        { error: "Failed to fetch unread count" },
        { status: 500 }
      );
    }

    return NextResponse.json({ count });
  } catch (error) {
    console.error("[api/emails/unread-count] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
