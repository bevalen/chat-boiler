import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";
import { getInboxEmails } from "@/lib/db/emails";

/**
 * GET /api/emails
 * List emails for the authenticated user's agent
 * 
 * Query params:
 * - direction: "all" | "inbound" | "outbound" (default: "all")
 * - status: "all" | "read" | "unread" (default: "all")
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
export async function GET(req: NextRequest) {
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

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const direction = searchParams.get("direction") || "all";
    const status = searchParams.get("status") || "all";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Validate direction
    const validDirections = ["all", "inbound", "outbound"];
    if (!validDirections.includes(direction)) {
      return NextResponse.json(
        { error: "Invalid direction parameter" },
        { status: 400 }
      );
    }

    // Fetch emails
    const { emails, error } = await getInboxEmails(supabase, agent.id, {
      direction: direction as "all" | "inbound" | "outbound",
      unreadOnly: status === "unread",
      limit,
      offset,
    });

    if (error) {
      console.error("[api/emails] Error fetching emails:", error);
      return NextResponse.json({ error: "Failed to fetch emails" }, { status: 500 });
    }

    // Filter by read status if needed
    let filteredEmails = emails;
    if (status === "read") {
      filteredEmails = emails.filter((email) => email.is_read);
    }

    // Get total count for pagination
    let countQuery = supabase
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agent.id);

    if (direction !== "all") {
      countQuery = countQuery.eq("direction", direction);
    }
    if (status === "unread") {
      countQuery = countQuery.eq("is_read", false);
    } else if (status === "read") {
      countQuery = countQuery.eq("is_read", true);
    }

    const { count: totalCount } = await countQuery;

    return NextResponse.json({
      emails: filteredEmails,
      pagination: {
        total: totalCount || 0,
        limit,
        offset,
        hasMore: offset + filteredEmails.length < (totalCount || 0),
      },
    });
  } catch (error) {
    console.error("[api/emails] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
