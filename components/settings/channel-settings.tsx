"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Check, X, Loader2, Eye, EyeOff, ExternalLink, Bell, Mail } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type NotificationChannel = "app" | "slack" | "email" | "sms";

interface SlackConfig {
  configured: boolean;
  active: boolean;
  team_id?: string;
  team_name?: string;
  user_slack_id?: string;
  default_channel_id?: string;
}

interface ChannelSettingsProps {
  userId: string;
  agentId?: string;
}

export function ChannelSettings({ userId, agentId }: ChannelSettingsProps) {
  const [slackConfig, setSlackConfig] = useState<SlackConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Preferred notification channel
  const [preferredChannel, setPreferredChannel] = useState<NotificationChannel>("app");
  const [savingPreference, setSavingPreference] = useState(false);

  // Slack form state
  const [botToken, setBotToken] = useState("");
  const [appToken, setAppToken] = useState("");
  const [userSlackId, setUserSlackId] = useState("");
  const [defaultChannelId, setDefaultChannelId] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Show/hide tokens
  const [showBotToken, setShowBotToken] = useState(false);
  const [showAppToken, setShowAppToken] = useState(false);

  // Slack test result
  const [testResult, setTestResult] = useState<{
    success: boolean;
    team_name?: string;
    bot_name?: string;
    error?: string;
  } | null>(null);

  // Fetch current configuration
  useEffect(() => {
    async function fetchConfig() {
      try {
        // Fetch Slack config
        const slackResponse = await fetch("/api/channels/slack");
        if (slackResponse.ok) {
          const data = await slackResponse.json();
          setSlackConfig(data);
          if (data.configured) {
            setUserSlackId(data.user_slack_id || "");
            setDefaultChannelId(data.default_channel_id || "");
            setIsActive(data.active);
          }
        }

        // Fetch user's preferred notification channel
        const prefResponse = await fetch("/api/user/preferences");
        if (prefResponse.ok) {
          const prefData = await prefResponse.json();
          if (prefData.preferred_notification_channel) {
            setPreferredChannel(prefData.preferred_notification_channel);
          }
        }
      } catch (error) {
        console.error("Error fetching config:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  const handleTestConnection = async () => {
    if (!botToken || !appToken) {
      setMessage({ type: "error", text: "Please enter both Bot Token and App Token" });
      return;
    }

    setTesting(true);
    setTestResult(null);
    setMessage(null);

    try {
      const response = await fetch("/api/channels/slack/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_token: botToken,
          app_token: appToken,
          user_slack_id: userSlackId,
        }),
      });

      const data = await response.json();
      setTestResult(data);

      if (data.success) {
        setMessage({ type: "success", text: `Connected to ${data.team_name} as ${data.bot_name}` });
      } else {
        setMessage({ type: "error", text: data.error || "Connection test failed" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to test connection" });
    } finally {
      setTesting(false);
    }
  };

  const handlePreferredChannelChange = async (channel: NotificationChannel) => {
    // Don't allow selecting Slack if not configured
    if (channel === "slack" && !slackConfig?.configured) {
      setMessage({ type: "error", text: "Please configure Slack first before setting it as your preferred channel" });
      return;
    }

    setSavingPreference(true);
    setMessage(null);

    try {
      const response = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferred_notification_channel: channel }),
      });

      if (response.ok) {
        setPreferredChannel(channel);
        setMessage({ type: "success", text: `Preferred notification channel set to ${channel}` });
      } else {
        const data = await response.json();
        setMessage({ type: "error", text: data.error || "Failed to update preference" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to update preference" });
    } finally {
      setSavingPreference(false);
    }
  };

  const handleSave = async () => {
    // Only require tokens for initial setup, not for updates
    if (!slackConfig?.configured && (!botToken || !appToken || !userSlackId)) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/channels/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_token: botToken,
          app_token: appToken,
          user_slack_id: userSlackId,
          team_name: testResult?.team_name,
          default_channel_id: defaultChannelId || undefined,
          is_active: isActive,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: "success", text: "Slack configuration saved successfully" });
        setSlackConfig({
          configured: true,
          active: isActive,
          user_slack_id: userSlackId,
          team_name: testResult?.team_name,
          default_channel_id: defaultChannelId,
        });
        // Clear the tokens from the form for security
        setBotToken("");
        setAppToken("");
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save configuration" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save configuration" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!slackConfig?.configured) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/channels/slack", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !slackConfig.active }),
      });

      const data = await response.json();

      if (data.success) {
        setSlackConfig({ ...slackConfig, active: data.active });
        setIsActive(data.active);
        setMessage({
          type: "success",
          text: data.active ? "Slack channel enabled" : "Slack channel disabled",
        });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update status" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to update status" });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Slack? Your agent will no longer be able to send or receive messages via Slack.")) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/channels/slack", {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        setSlackConfig({ configured: false, active: false });
        setBotToken("");
        setAppToken("");
        setUserSlackId("");
        setDefaultChannelId("");
        setMessage({ type: "success", text: "Slack disconnected successfully" });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to disconnect" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to disconnect" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Channels</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Channels</CardTitle>
        </div>
        <CardDescription>
          Connect external channels so your assistant can send and receive messages
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {message && (
          <div
            className={`p-3 rounded-md text-sm ${
              message.type === "error"
                ? "bg-destructive/10 text-destructive"
                : "bg-green-500/10 text-green-500"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Preferred Notification Channel */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium">Preferred Notification Channel</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Where should reminders, scheduled notifications, and proactive messages be sent?
          </p>
          <Select
            value={preferredChannel}
            onValueChange={(value) => handlePreferredChannelChange(value as NotificationChannel)}
            disabled={savingPreference}
          >
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Select channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="app">In-App</SelectItem>
              <SelectItem value="slack" disabled={!slackConfig?.configured}>
                Slack {!slackConfig?.configured && "(not configured)"}
              </SelectItem>
              <SelectItem value="email" disabled>
                Email (coming soon)
              </SelectItem>
              <SelectItem value="sms" disabled>
                SMS (coming soon)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Slack Configuration */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#4A154B] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.52-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.124a2.528 2.528 0 0 1 2.521 2.52A2.528 2.528 0 0 1 15.166 24a2.528 2.528 0 0 1-2.521-2.522v-2.52h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312A2.528 2.528 0 0 1 24 15.166a2.528 2.528 0 0 1-2.522 2.521h-6.312z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-medium">Slack</h3>
                <p className="text-sm text-muted-foreground">
                  {slackConfig?.configured
                    ? slackConfig.active
                      ? `Connected${slackConfig.team_name ? ` to ${slackConfig.team_name}` : ""}`
                      : "Configured but disabled"
                    : "Not connected"}
                </p>
              </div>
            </div>
            {slackConfig?.configured && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleActive}
                  disabled={saving}
                >
                  {slackConfig.active ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={saving}
                  className="text-destructive hover:text-destructive"
                >
                  Disconnect
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Setup instructions */}
          {!slackConfig?.configured && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium">To connect Slack, you need to create a Slack App:</p>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                <li>
                  Go to{" "}
                  <a
                    href="https://api.slack.com/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    api.slack.com/apps
                    <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  and create a new app
                </li>
                <li>Enable <strong>Socket Mode</strong> in your app settings</li>
                <li>Add Bot Token Scopes: <code className="text-xs bg-muted px-1 py-0.5 rounded">chat:write</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">im:history</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">im:read</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">im:write</code></li>
                <li>Subscribe to Events: <code className="text-xs bg-muted px-1 py-0.5 rounded">message.im</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">app_mention</code></li>
                <li>Install the app to your workspace</li>
              </ol>
            </div>
          )}

          {/* Connection form */}
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="botToken">
                Bot Token <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="botToken"
                  type={showBotToken ? "text" : "password"}
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder={slackConfig?.configured ? "Enter new token to update" : "xoxb-..."}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowBotToken(!showBotToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showBotToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Found in your Slack app settings under OAuth & Permissions
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="appToken">
                App Token <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="appToken"
                  type={showAppToken ? "text" : "password"}
                  value={appToken}
                  onChange={(e) => setAppToken(e.target.value)}
                  placeholder={slackConfig?.configured ? "Enter new token to update" : "xapp-..."}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAppToken(!showAppToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showAppToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Found in Basic Information under App-Level Tokens (Socket Mode must be enabled)
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="userSlackId">
                Your Slack User ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="userSlackId"
                value={userSlackId}
                onChange={(e) => setUserSlackId(e.target.value)}
                placeholder="U12345678"
              />
              <p className="text-xs text-muted-foreground">
                Your Slack member ID. Click your profile in Slack, then "Copy member ID"
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="defaultChannelId">Default Channel ID (optional)</Label>
              <Input
                id="defaultChannelId"
                value={defaultChannelId}
                onChange={(e) => setDefaultChannelId(e.target.value)}
                placeholder="C12345678"
              />
              <p className="text-xs text-muted-foreground">
                Channel ID for notifications. If not set, notifications will be sent as DMs
              </p>
            </div>

            {testResult && (
              <div
                className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                  testResult.success
                    ? "bg-green-500/10 text-green-500"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {testResult.success ? (
                  <>
                    <Check className="h-4 w-4" />
                    Connected to {testResult.team_name} as {testResult.bot_name}
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    {testResult.error}
                  </>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !botToken || !appToken}
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || (!slackConfig?.configured && (!botToken || !appToken || !userSlackId))}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : slackConfig?.configured ? (
                  "Update Configuration"
                ) : (
                  "Connect Slack"
                )}
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Email Integration (Resend) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-medium">Email (via Resend)</h3>
                <p className="text-sm text-muted-foreground">
                  Maia has a dedicated email address
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600">Active</span>
            </div>
          </div>

          <Separator />

          {/* Email address display */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Maia&apos;s Email Address</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-md bg-background border text-sm font-mono">
                  {agentId ? `agent-${agentId}@send.maia.madewell.ai` : "Loading..."}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (agentId) navigator.clipboard.writeText(`agent-${agentId}@send.maia.madewell.ai`);
                    setMessage({ type: "success", text: "Email address copied to clipboard" });
                    setTimeout(() => setMessage(null), 3000);
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Anyone can email this address to reach Maia. Emails are stored securely and only accessible by you.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Email Capabilities</Label>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
                  <Check className="h-3 w-3" />
                  Send Emails
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
                  <Check className="h-3 w-3" />
                  Receive Emails
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
                  <Check className="h-3 w-3" />
                  Email Threading
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
                  <Check className="h-3 w-3" />
                  Auto Signature
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Signature Preview</Label>
              <div className="p-3 rounded-md border bg-background text-sm">
                <p className="text-muted-foreground text-xs mb-2">Emails from Maia include a professional signature:</p>
                <div className="border-t pt-2 mt-2">
                  <p className="font-medium">Maia</p>
                  <p className="text-muted-foreground text-xs">Your Executive Assistant</p>
                  <p className="text-xs text-muted-foreground mt-1">Powered by Madewell AI</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Future channels placeholder */}
        <div className="space-y-4 opacity-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <svg className="w-6 h-6 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-medium">SMS</h3>
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
