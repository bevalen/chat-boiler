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

type NotificationChannel = "app" | "email" | "sms";

interface ChannelSettingsProps {
  userId: string;
  agentId?: string;
}

export function ChannelSettings({ userId, agentId }: ChannelSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Preferred notification channel
  const [preferredChannel, setPreferredChannel] = useState<NotificationChannel>("app");
  const [savingPreference, setSavingPreference] = useState(false);

  // Fetch current configuration
  useEffect(() => {
    async function fetchConfig() {
      try {
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

  const handlePreferredChannelChange = async (channel: NotificationChannel) => {
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
