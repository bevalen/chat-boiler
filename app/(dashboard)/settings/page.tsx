import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/settings-form";

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
    <SettingsForm
      user={{
        id: user.id,
        email: user.email || "",
        name: profile?.name || "",
        timezone: profile?.timezone || "America/New_York",
      }}
      agent={agent}
    />
  );
}
