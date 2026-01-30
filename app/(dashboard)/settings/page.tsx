import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/settings-form";
import { ChannelSettings } from "@/components/settings/channel-settings";
import { AgentPersonality, UserPreferences } from "@/lib/types/database";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  // Get user's agent
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="h-full">
      <SettingsForm
        user={{
          id: user.id,
          email: user.email || "",
          name: profile?.name || "",
          timezone: profile?.timezone || "America/New_York",
          avatarUrl: profile?.avatar_url || null,
        }}
        agent={
          agent
            ? {
                id: agent.id,
                name: agent.name,
                email: agent.email,
                title: agent.title,
                avatarUrl: agent.avatar_url,
                personality: agent.personality as AgentPersonality | null,
                userPreferences: agent.user_preferences as UserPreferences | null,
              }
            : null
        }
        channelsComponent={<ChannelSettings userId={user.id} />}
      />
    </div>
  );
}
