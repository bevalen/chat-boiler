import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getZapierMCPCredentials,
  updateZapierMCPCredentials,
  deleteChannelCredentials,
  setChannelActive,
} from "@/lib/db/channel-credentials";
import { ZapierMCPCredentials, ChannelType } from "@/lib/types/database";

/**
 * Get current user's Zapier MCP credentials
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

    const { credentials, isActive, error } = await getZapierMCPCredentials(
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

    // Return credentials (endpoint URL is not as sensitive as tokens)
    return NextResponse.json({
      configured: true,
      active: isActive,
      endpoint_url: credentials.endpoint_url,
      has_api_key: !!credentials.api_key,
      capabilities: credentials.capabilities,
      description: credentials.description,
    });
  } catch (error) {
    console.error("[zapier-mcp] Error getting credentials:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Save/update Zapier MCP credentials
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
      endpoint_url,
      api_key,
      capabilities = { check_email: true, send_email: true, check_calendar: false },
      description,
      is_active = true,
    } = body;

    if (!endpoint_url) {
      return NextResponse.json(
        { error: "Missing required field: endpoint_url" },
        { status: 400 }
      );
    }

    // Validate the endpoint URL
    try {
      new URL(endpoint_url);
    } catch {
      return NextResponse.json(
        { error: "Invalid endpoint URL format" },
        { status: 400 }
      );
    }

    const credentials: ZapierMCPCredentials = {
      endpoint_url,
      api_key,
      capabilities,
      description,
    };

    const { credentials: saved, error } = await updateZapierMCPCredentials(
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
    console.error("[zapier-mcp] Error saving credentials:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Update Zapier MCP active status
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
      "zapier_mcp" as ChannelType,
      is_active
    );

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success, active: is_active });
  } catch (error) {
    console.error("[zapier-mcp] Error updating status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Delete Zapier MCP credentials
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
      "zapier_mcp" as ChannelType
    );

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success });
  } catch (error) {
    console.error("[zapier-mcp] Error deleting credentials:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
