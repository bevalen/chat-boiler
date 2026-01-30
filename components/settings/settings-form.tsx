"use client";

import { useState } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { User, Bot, Shield } from "lucide-react";

interface SettingsFormProps {
  user: {
    id: string;
    email: string;
    name: string;
    timezone: string;
  };
  agent: {
    id: string;
    name: string;
    email: string | null;
  } | null;
}

export function SettingsForm({ user, agent }: SettingsFormProps) {
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone);
  const [agentName, setAgentName] = useState(agent?.name || "Milo");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({ name, timezone })
      .eq("id", user.id);

    if (error) {
      setMessage("Failed to save profile");
    } else {
      setMessage("Profile saved successfully");
      router.refresh();
    }
    setIsSaving(false);
  };

  const handleSaveAgent = async () => {
    if (!agent) return;
    setIsSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("agents")
      .update({ name: agentName })
      .eq("id", agent.id);

    if (error) {
      setMessage("Failed to save agent settings");
    } else {
      setMessage("Agent settings saved successfully");
      router.refresh();
    }
    setIsSaving(false);
  };

  const timezones = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Singapore",
    "Australia/Sydney",
    "Pacific/Auckland",
  ];

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-md text-sm ${
            message.includes("Failed")
              ? "bg-destructive/10 text-destructive"
              : "bg-green-500/10 text-green-500"
          }`}
        >
          {message}
        </div>
      )}

      <div className="space-y-6">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Profile</CardTitle>
            </div>
            <CardDescription>Your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user.email} disabled className="bg-muted" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleSaveProfile} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        {/* Agent Settings */}
        {agent && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-muted-foreground" />
                <CardTitle>AI Assistant</CardTitle>
              </div>
              <CardDescription>
                Customize your AI executive assistant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="agentName">Assistant Name</Label>
                <Input
                  id="agentName"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Milo"
                />
                <p className="text-xs text-muted-foreground">
                  This is how your assistant will refer to itself
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Assistant Email</Label>
                <Input
                  value={agent.email || "Not configured"}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email address used when the assistant sends emails on your behalf
                </p>
              </div>
              <Button onClick={handleSaveAgent} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Agent Settings"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>Manage your account security</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Password</p>
                <p className="text-sm text-muted-foreground">
                  Change your password
                </p>
              </div>
              <Button variant="outline" disabled>
                Change Password
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-destructive">Delete Account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all data
                </p>
              </div>
              <Button variant="destructive" disabled>
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
