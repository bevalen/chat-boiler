import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { LinkedInCredentials } from "@/lib/types/database";

/**
 * POST /api/auth/extension/validate
 * 
 * Validate an extension token (called by the Chrome extension).
 * Uses Bearer token authentication.
 */
export async function POST(request: Request) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 401 }
      );
    }

    // Parse request body for extension ID
    const body = await request.json().catch(() => ({}));
    const { extensionId } = body as { extensionId?: string };

    // Use admin client to look up the token
    const adminClient = getAdminClient();
    
    // Find credentials with this token
    const { data: credentialsData, error: queryError } = await adminClient
      .from("user_channel_credentials")
      .select("user_id, credentials, is_active")
      .eq("channel_type", "linkedin")
      .eq("is_active", true);

    if (queryError) {
      console.error("[auth/extension/validate] Query error:", queryError);
      return NextResponse.json(
        { error: "Failed to validate token" },
        { status: 500 }
      );
    }

    // Find matching token
    const matchingCredential = credentialsData?.find((cred) => {
      const linkedInCreds = cred.credentials as LinkedInCredentials;
      return linkedInCreds.extension_token === token;
    });

    if (!matchingCredential) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const linkedInCreds = matchingCredential.credentials as LinkedInCredentials;

    // Check if token is expired
    if (linkedInCreds.token_expires_at) {
      const expiresAt = new Date(linkedInCreds.token_expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: "Token has expired. Please generate a new token in your settings." },
          { status: 401 }
        );
      }
    }

    // Get the user's agent
    const { data: agent, error: agentError } = await adminClient
      .from("agents")
      .select("id")
      .eq("user_id", matchingCredential.user_id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Optionally update the extension_id if provided
    if (extensionId && extensionId !== linkedInCreds.extension_id) {
      const updatedCreds: LinkedInCredentials = {
        ...linkedInCreds,
        extension_id: extensionId,
      };

      await adminClient
        .from("user_channel_credentials")
        .update({ credentials: updatedCreds })
        .eq("user_id", matchingCredential.user_id)
        .eq("channel_type", "linkedin");
    }

    console.log(`[auth/extension/validate] Token validated for user ${matchingCredential.user_id}`);

    return NextResponse.json({
      valid: true,
      userId: matchingCredential.user_id,
      agentId: agent.id,
      expiresAt: linkedInCreds.token_expires_at,
      settings: linkedInCreds.settings,
      capabilities: linkedInCreds.capabilities,
    });
  } catch (error) {
    console.error("[auth/extension/validate] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
