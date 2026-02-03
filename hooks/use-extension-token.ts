/**
 * Hook for managing extension token generation and status
 */

import { useState, useEffect } from "react";

interface ExtensionStatus {
  hasToken: boolean;
  isActive: boolean;
  isExpired: boolean;
  expiresAt?: string;
}

export function useExtensionToken() {
  const [loading, setLoading] = useState(true);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchExtensionStatus();
  }, []);

  async function fetchExtensionStatus() {
    try {
      const response = await fetch("/api/auth/extension");
      if (response.ok) {
        const data = await response.json();
        setExtensionStatus(data);
      }
    } catch (error) {
      console.error("Error fetching extension status:", error);
    } finally {
      setLoading(false);
    }
  }

  async function generateToken() {
    setGeneratingToken(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/extension", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            draftMode: true,
            responseDelaySeconds: 3,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate token");
      }

      const data = await response.json();
      setGeneratedToken(data.token);
      setShowToken(true);
      await fetchExtensionStatus();
      setMessage({ type: "success", text: "Token generated! Copy it to the Chrome extension to connect." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to generate token",
      });
    } finally {
      setGeneratingToken(false);
    }
  }

  async function revokeToken() {
    try {
      await fetch("/api/auth/extension", { method: "DELETE" });
      await fetchExtensionStatus();
      setMessage({ type: "success", text: "Extension token revoked" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to revoke token" });
    }
  }

  async function downloadExtension() {
    setMessage(null);

    try {
      const response = await fetch("/api/extension/download");

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Download failed" }));
        throw new Error(error.error || "Failed to download extension");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "maia-linkedin-sdr.zip";
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage({ type: "success", text: "Extension downloaded! Unzip and load it in Chrome." });
    } catch (error) {
      console.error("Download error:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to download extension",
      });
    }
  }

  return {
    loading,
    extensionStatus,
    generatingToken,
    generatedToken,
    showToken,
    setShowToken,
    message,
    setMessage,
    generateToken,
    revokeToken,
    downloadExtension,
    refetch: fetchExtensionStatus,
  };
}
