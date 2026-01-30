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
import { MessageSquare, Check, X, Loader2, Eye, EyeOff, ExternalLink, Bell, Zap, Mail, Calendar } from "lucide-react";
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

interface ZapierMCPConfig {
  configured: boolean;
  active: boolean;
  endpoint_url?: string;
  has_api_key?: boolean;
  capabilities?: {
    check_email: boolean;
    send_email: boolean;
    check_calendar: boolean;
  };
  description?: string;
}

interface ChannelSettingsProps {
  userId: string;
}

export function ChannelSettings({ userId }: ChannelSettingsProps) {
  const [slackConfig, setSlackConfig] = useState<SlackConfig | null>(null);
  const [zapierConfig, setZapierConfig] = useState<ZapierMCPConfig | null>(null);
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

  // Zapier MCP form state
  const [zapierEndpointUrl, setZapierEndpointUrl] = useState("");
  const [zapierApiKey, setZapierApiKey] = useState("");
  const [zapierDescription, setZapierDescription] = useState("");
  const [zapierCheckEmail, setZapierCheckEmail] = useState(true);
  const [zapierSendEmail, setZapierSendEmail] = useState(true);
  const [zapierCheckCalendar, setZapierCheckCalendar] = useState(false);
  const [zapierIsActive, setZapierIsActive] = useState(true);
  const [showZapierApiKey, setShowZapierApiKey] = useState(false);
  const [savingZapier, setSavingZapier] = useState(false);
  const [testingZapier, setTestingZapier] = useState(false);
  const [zapierTestResult, setZapierTestResult] = useState<{
    success: boolean;
    message?: string;
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

        // Fetch Zapier MCP config
        const zapierResponse = await fetch("/api/channels/zapier-mcp");
        if (zapierResponse.ok) {
          const data = await zapierResponse.json();
          setZapierConfig(data);
          if (data.configured) {
            setZapierEndpointUrl(data.endpoint_url || "");
            setZapierDescription(data.description || "");
            setZapierCheckEmail(data.capabilities?.check_email ?? true);
            setZapierSendEmail(data.capabilities?.send_email ?? true);
            setZapierCheckCalendar(data.capabilities?.check_calendar ?? false);
            setZapierIsActive(data.active);
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
    if (!botToken || !appToken || !userSlackId) {
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

  // Zapier MCP handlers
  const handleZapierTestConnection = async () => {
    if (!zapierEndpointUrl) {
      setMessage({ type: "error", text: "Please enter the Zapier MCP endpoint URL" });
      return;
    }

    setTestingZapier(true);
    setZapierTestResult(null);
    setMessage(null);

    try {
      const response = await fetch("/api/channels/zapier-mcp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint_url: zapierEndpointUrl,
          api_key: zapierApiKey || undefined,
        }),
      });

      const data = await response.json();
      setZapierTestResult(data);

      if (data.success) {
        setMessage({ type: "success", text: "Zapier MCP connection successful" });
      } else {
        setMessage({ type: "error", text: data.error || "Connection test failed" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to test connection" });
    } finally {
      setTestingZapier(false);
    }
  };

  const handleZapierSave = async () => {
    if (!zapierEndpointUrl) {
      setMessage({ type: "error", text: "Please enter the Zapier MCP endpoint URL" });
      return;
    }

    setSavingZapier(true);
    setMessage(null);

    try {
      const response = await fetch("/api/channels/zapier-mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint_url: zapierEndpointUrl,
          api_key: zapierApiKey || undefined,
          capabilities: {
            check_email: zapierCheckEmail,
            send_email: zapierSendEmail,
            check_calendar: zapierCheckCalendar,
          },
          description: zapierDescription || undefined,
          is_active: zapierIsActive,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: "success", text: "Zapier MCP configuration saved successfully" });
        setZapierConfig({
          configured: true,
          active: zapierIsActive,
          endpoint_url: zapierEndpointUrl,
          has_api_key: !!zapierApiKey,
          capabilities: {
            check_email: zapierCheckEmail,
            send_email: zapierSendEmail,
            check_calendar: zapierCheckCalendar,
          },
          description: zapierDescription,
        });
        // Clear the API key from the form for security
        setZapierApiKey("");
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save configuration" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save configuration" });
    } finally {
      setSavingZapier(false);
    }
  };

  const handleZapierToggleActive = async () => {
    if (!zapierConfig?.configured) return;

    setSavingZapier(true);
    setMessage(null);

    try {
      const response = await fetch("/api/channels/zapier-mcp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !zapierConfig.active }),
      });

      const data = await response.json();

      if (data.success) {
        setZapierConfig({ ...zapierConfig, active: data.active });
        setZapierIsActive(data.active);
        setMessage({
          type: "success",
          text: data.active ? "Zapier MCP enabled" : "Zapier MCP disabled",
        });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update status" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to update status" });
    } finally {
      setSavingZapier(false);
    }
  };

  const handleZapierDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Zapier MCP? Your agent will no longer be able to check or send emails.")) {
      return;
    }

    setSavingZapier(true);
    setMessage(null);

    try {
      const response = await fetch("/api/channels/zapier-mcp", {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        setZapierConfig({ configured: false, active: false });
        setZapierEndpointUrl("");
        setZapierApiKey("");
        setZapierDescription("");
        setZapierCheckEmail(true);
        setZapierSendEmail(true);
        setZapierCheckCalendar(false);
        setMessage({ type: "success", text: "Zapier MCP disconnected successfully" });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to disconnect" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to disconnect" });
    } finally {
      setSavingZapier(false);
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
                disabled={saving || !botToken || !appToken || !userSlackId}
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

        {/* Zapier MCP Configuration */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-medium">Zapier MCP (Email & Calendar)</h3>
                <p className="text-sm text-muted-foreground">
                  {zapierConfig?.configured
                    ? zapierConfig.active
                      ? "Connected and active"
                      : "Configured but disabled"
                    : "Not connected"}
                </p>
              </div>
            </div>
            {zapierConfig?.configured && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleZapierToggleActive}
                  disabled={savingZapier}
                >
                  {zapierConfig.active ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZapierDisconnect}
                  disabled={savingZapier}
                  className="text-destructive hover:text-destructive"
                >
                  Disconnect
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Setup instructions */}
          {!zapierConfig?.configured && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium">To connect Zapier MCP for email integration:</p>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                <li>
                  Create a Zapier automation with a webhook trigger
                </li>
                <li>Configure actions for checking Gmail and sending emails</li>
                <li>Copy the webhook URL and paste it below</li>
                <li>Test the connection to verify it works</li>
              </ol>
            </div>
          )}

          {/* Zapier MCP form */}
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="zapierEndpointUrl">
                Zapier Webhook URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="zapierEndpointUrl"
                type="url"
                value={zapierEndpointUrl}
                onChange={(e) => setZapierEndpointUrl(e.target.value)}
                placeholder={zapierConfig?.configured ? "Enter new URL to update" : "https://hooks.zapier.com/hooks/catch/..."}
              />
              <p className="text-xs text-muted-foreground">
                The webhook URL from your Zapier automation
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="zapierApiKey">API Key (optional)</Label>
              <div className="relative">
                <Input
                  id="zapierApiKey"
                  type={showZapierApiKey ? "text" : "password"}
                  value={zapierApiKey}
                  onChange={(e) => setZapierApiKey(e.target.value)}
                  placeholder={zapierConfig?.has_api_key ? "Enter new key to update" : "Optional authentication key"}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowZapierApiKey(!showZapierApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showZapierApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Optional API key for additional authentication
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="zapierDescription">Description (optional)</Label>
              <Input
                id="zapierDescription"
                value={zapierDescription}
                onChange={(e) => setZapierDescription(e.target.value)}
                placeholder="e.g., Ben's Gmail via Zapier"
              />
            </div>

            {/* Capabilities */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Enabled Capabilities</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="checkEmail"
                    checked={zapierCheckEmail}
                    onCheckedChange={(checked) => setZapierCheckEmail(checked === true)}
                  />
                  <label
                    htmlFor="checkEmail"
                    className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Check Emails
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sendEmail"
                    checked={zapierSendEmail}
                    onCheckedChange={(checked) => setZapierSendEmail(checked === true)}
                  />
                  <label
                    htmlFor="sendEmail"
                    className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Send Emails
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="checkCalendar"
                    checked={zapierCheckCalendar}
                    onCheckedChange={(checked) => setZapierCheckCalendar(checked === true)}
                  />
                  <label
                    htmlFor="checkCalendar"
                    className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Check Calendar
                  </label>
                </div>
              </div>
            </div>

            {zapierTestResult && (
              <div
                className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                  zapierTestResult.success
                    ? "bg-green-500/10 text-green-500"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {zapierTestResult.success ? (
                  <>
                    <Check className="h-4 w-4" />
                    {zapierTestResult.message || "Connection successful"}
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    {zapierTestResult.error}
                  </>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleZapierTestConnection}
                disabled={testingZapier || !zapierEndpointUrl}
              >
                {testingZapier ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
              <Button
                onClick={handleZapierSave}
                disabled={savingZapier || !zapierEndpointUrl}
              >
                {savingZapier ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : zapierConfig?.configured ? (
                  "Update Configuration"
                ) : (
                  "Connect Zapier MCP"
                )}
              </Button>
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
