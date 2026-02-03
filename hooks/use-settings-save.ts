/**
 * Hook for saving settings (profile and agent settings)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AgentPersonality, UserPreferences } from "@/lib/types/database";

export function useSettingsSave() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const saveProfile = async (
    userId: string,
    data: { name: string; timezone: string }
  ) => {
    setIsSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.from("users").update(data).eq("id", userId);

    if (error) {
      setMessage("Failed to save profile");
      setIsSaving(false);
      return { success: false };
    }

    setMessage("Profile saved successfully");
    setIsSaving(false);
    router.refresh();
    return { success: true };
  };

  const saveAgent = async (
    agentId: string,
    data: {
      title: string;
      personality: AgentPersonality;
      userPreferences: UserPreferences;
      customInstructions: string | null;
    }
  ) => {
    setIsSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("agents")
      .update({
        name: "Maia", // Standardized name
        avatar_url: "/logos/profile-icon.png", // Standardized avatar
        title: data.title,
        personality: data.personality,
        user_preferences: data.userPreferences,
        custom_instructions: data.customInstructions || null,
      })
      .eq("id", agentId);

    if (error) {
      setMessage("Failed to save agent settings");
      setIsSaving(false);
      return { success: false };
    }

    setMessage("Agent settings saved successfully");
    setIsSaving(false);
    router.refresh();
    return { success: true };
  };

  return {
    isSaving,
    message,
    setMessage,
    saveProfile,
    saveAgent,
  };
}
