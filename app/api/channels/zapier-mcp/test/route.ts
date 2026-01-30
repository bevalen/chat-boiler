import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Test Zapier MCP connection
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
    const { endpoint_url, api_key } = body;

    if (!endpoint_url) {
      return NextResponse.json(
        { error: "Missing required field: endpoint_url" },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(endpoint_url);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Try to call the endpoint with a test/ping action
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (api_key) {
        headers["Authorization"] = `Bearer ${api_key}`;
      }

      const response = await fetch(endpoint_url, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "ping" }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({
          success: false,
          error: `Endpoint returned ${response.status}: ${errorText.substring(0, 200)}`,
        });
      }

      // Try to parse response
      let responseData;
      try {
        responseData = await response.json();
      } catch {
        // If not JSON, that's okay - the endpoint responded successfully
        responseData = { message: "Endpoint responded successfully" };
      }

      return NextResponse.json({
        success: true,
        message: "Connection successful",
        response: responseData,
      });
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : "Unknown error";
      return NextResponse.json({
        success: false,
        error: `Failed to connect: ${errorMessage}`,
      });
    }
  } catch (error) {
    console.error("[zapier-mcp/test] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
