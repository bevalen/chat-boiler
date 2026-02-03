/**
 * Hook for saving SDR configuration
 */

import { useState } from "react";
import type { SDRConfig } from "@/lib/types/database";

export function useSdrConfigSave(agentId: string, onSave?: (config: SDRConfig) => Promise<void>) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const saveConfig = async (config: SDRConfig) => {
    setSaving(true);
    setMessage(null);

    try {
      if (onSave) {
        await onSave(config);
      } else {
        const response = await fetch(`/api/agents/${agentId}/sdr-config`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sdrConfig: config }),
        });

        if (!response.ok) {
          throw new Error("Failed to save SDR configuration");
        }
      }
      setMessage({ type: "success", text: "SDR configuration saved successfully" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  };

  return {
    saving,
    message,
    setMessage,
    saveConfig,
  };
}
