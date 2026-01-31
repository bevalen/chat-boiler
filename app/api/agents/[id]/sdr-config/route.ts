import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SDRConfig, AgentIdentityContext } from "@/lib/types/database";

/**
 * PUT /api/agents/[id]/sdr-config
 * 
 * Update the SDR configuration for an agent
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const supabase = await createClient();
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify the agent belongs to the user
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, user_id, identity_context")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    if (agent.user_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Parse request body
    const { sdrConfig } = await request.json() as { sdrConfig: SDRConfig };

    if (!sdrConfig || !sdrConfig.companyName || !sdrConfig.companyDescription) {
      return NextResponse.json(
        { error: "Company name and description are required" },
        { status: 400 }
      );
    }

    // Merge with existing identity context
    const existingContext = (agent.identity_context as AgentIdentityContext) || {};
    const updatedContext: AgentIdentityContext = {
      ...existingContext,
      sdrConfig,
    };

    // Update the agent
    const { error: updateError } = await supabase
      .from("agents")
      .update({ identity_context: updatedContext })
      .eq("id", agentId);

    if (updateError) {
      console.error("[sdr-config] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update SDR configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "SDR configuration saved successfully",
    });
  } catch (error) {
    console.error("[sdr-config] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/[id]/sdr-config
 * 
 * Get the SDR configuration for an agent
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const supabase = await createClient();
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get the agent
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, user_id, identity_context")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    if (agent.user_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const identityContext = (agent.identity_context as AgentIdentityContext) || {};

    return NextResponse.json({
      sdrConfig: identityContext.sdrConfig || null,
    });
  } catch (error) {
    console.error("[sdr-config] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
