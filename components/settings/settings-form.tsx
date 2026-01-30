"use client";

import { useState, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { User, Bot, Shield, Upload, X } from "lucide-react";
import Image from "next/image";
import { AgentPersonality, UserPreferences } from "@/lib/types/database";

interface SettingsFormProps {
  user: {
    id: string;
    email: string;
    name: string;
    timezone: string;
    avatarUrl: string | null;
  };
  agent: {
    id: string;
    name: string;
    email: string | null;
    title: string | null;
    avatarUrl: string | null;
    personality: AgentPersonality | null;
    userPreferences: UserPreferences | null;
  } | null;
}

export function SettingsForm({ user, agent }: SettingsFormProps) {
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone);
  const [userAvatarUrl, setUserAvatarUrl] = useState(user.avatarUrl || "");
  const [uploadingUserAvatar, setUploadingUserAvatar] = useState(false);
  
  // Agent state
  const [agentName, setAgentName] = useState(agent?.name || "Milo");
  const [agentTitle, setAgentTitle] = useState(agent?.title || "AI Assistant");
  const [avatarUrl, setAvatarUrl] = useState(agent?.avatarUrl || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Personality state
  const [personalityTraits, setPersonalityTraits] = useState(
    agent?.personality?.traits?.join(", ") || "proactive, thoughtful, efficient"
  );
  const [personalityStyle, setPersonalityStyle] = useState(
    agent?.personality?.style || "professional but approachable"
  );
  const [personalityTone, setPersonalityTone] = useState(
    agent?.personality?.tone || "warm and helpful"
  );
  const [personalityBackground, setPersonalityBackground] = useState(
    agent?.personality?.background || ""
  );
  
  // Preferences state
  const [responseStyle, setResponseStyle] = useState<"concise" | "detailed" | "balanced">(
    agent?.userPreferences?.response_style || "concise"
  );
  const [useBulletPoints, setUseBulletPoints] = useState(
    agent?.userPreferences?.use_bullet_points ?? true
  );
  const [proactiveSuggestions, setProactiveSuggestions] = useState(
    agent?.userPreferences?.proactive_suggestions ?? true
  );
  const [confirmBeforeActions, setConfirmBeforeActions] = useState(
    agent?.userPreferences?.confirm_before_actions ?? true
  );
  const [preferredCommunication, setPreferredCommunication] = useState(
    agent?.userPreferences?.preferred_communication || "straightforward but fun"
  );
  
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userFileInputRef = useRef<HTMLInputElement>(null);

  const handleUserAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingUserAvatar(true);
    setMessage(null);

    const supabase = createClient();
    const fileExt = file.name.split(".").pop();
    const filePath = `users/${user.id}/avatar.${fileExt}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setMessage("Failed to upload profile image");
      setUploadingUserAvatar(false);
      return;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const newAvatarUrl = urlData.publicUrl;

    // Update user record
    const { error: updateError } = await supabase
      .from("users")
      .update({ avatar_url: newAvatarUrl })
      .eq("id", user.id);

    if (updateError) {
      setMessage("Failed to save profile image URL");
    } else {
      setUserAvatarUrl(newAvatarUrl);
      setMessage("Profile image uploaded successfully");
      router.refresh();
    }

    setUploadingUserAvatar(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !agent) return;

    setUploadingAvatar(true);
    setMessage(null);

    const supabase = createClient();
    const fileExt = file.name.split(".").pop();
    const filePath = `${agent.id}/avatar.${fileExt}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setMessage("Failed to upload avatar");
      setUploadingAvatar(false);
      return;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const newAvatarUrl = urlData.publicUrl;

    // Update agent record
    const { error: updateError } = await supabase
      .from("agents")
      .update({ avatar_url: newAvatarUrl })
      .eq("id", agent.id);

    if (updateError) {
      setMessage("Failed to save avatar URL");
    } else {
      setAvatarUrl(newAvatarUrl);
      setMessage("Avatar uploaded successfully");
      router.refresh();
    }

    setUploadingAvatar(false);
  };

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
    
    const personality: AgentPersonality = {
      traits: personalityTraits.split(",").map((t) => t.trim()).filter(Boolean),
      style: personalityStyle,
      tone: personalityTone,
      background: personalityBackground,
    };

    const userPreferences: UserPreferences = {
      response_style: responseStyle,
      verbosity: responseStyle === "concise" ? "brief" : responseStyle === "detailed" ? "verbose" : "moderate",
      use_bullet_points: useBulletPoints,
      proactive_suggestions: proactiveSuggestions,
      confirm_before_actions: confirmBeforeActions,
      preferred_communication: preferredCommunication,
    };

    const { error } = await supabase
      .from("agents")
      .update({
        name: agentName,
        title: agentTitle,
        personality,
        user_preferences: userPreferences,
      })
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
          <CardContent className="space-y-6">
            {/* User Avatar Upload */}
            <div className="flex items-start gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-secondary border border-border overflow-hidden">
                  {userAvatarUrl ? (
                    <Image
                      src={userAvatarUrl}
                      alt={name || "Profile"}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                {userAvatarUrl && (
                  <button
                    onClick={() => setUserAvatarUrl("")}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Label>Profile Photo</Label>
                <p className="text-sm text-muted-foreground">
                  Upload a photo for your profile
                </p>
                <input
                  ref={userFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUserAvatarUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => userFileInputRef.current?.click()}
                  disabled={uploadingUserAvatar}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadingUserAvatar ? "Uploading..." : "Upload Image"}
                </Button>
              </div>
            </div>

            <Separator />

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
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>AI Assistant Identity</CardTitle>
                </div>
                <CardDescription>
                  Customize how your assistant presents itself
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Upload */}
                <div className="flex items-start gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-secondary border border-border overflow-hidden">
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt={agentName}
                          width={96}
                          height={96}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Bot className="w-10 h-10 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    {avatarUrl && (
                      <button
                        onClick={() => setAvatarUrl("")}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>Profile Photo</Label>
                    <p className="text-sm text-muted-foreground">
                      Upload an image for your assistant
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingAvatar ? "Uploading..." : "Upload Image"}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="agentName">Name</Label>
                    <Input
                      id="agentName"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Milo Carter"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="agentTitle">Title</Label>
                    <Input
                      id="agentTitle"
                      value={agentTitle}
                      onChange={(e) => setAgentTitle(e.target.value)}
                      placeholder="Executive Assistant"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    value={agent.email || "Not configured"}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email address used when sending emails on your behalf
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Personality</CardTitle>
                <CardDescription>
                  Define your assistant&apos;s personality traits and communication style
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="personalityTraits">Traits</Label>
                  <Input
                    id="personalityTraits"
                    value={personalityTraits}
                    onChange={(e) => setPersonalityTraits(e.target.value)}
                    placeholder="proactive, thoughtful, efficient"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated personality traits
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="personalityStyle">Style</Label>
                    <Input
                      id="personalityStyle"
                      value={personalityStyle}
                      onChange={(e) => setPersonalityStyle(e.target.value)}
                      placeholder="professional but approachable"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="personalityTone">Tone</Label>
                    <Input
                      id="personalityTone"
                      value={personalityTone}
                      onChange={(e) => setPersonalityTone(e.target.value)}
                      placeholder="warm and helpful"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="personalityBackground">Background (optional)</Label>
                  <Textarea
                    id="personalityBackground"
                    value={personalityBackground}
                    onChange={(e) => setPersonalityBackground(e.target.value)}
                    placeholder="Describe your assistant's backstory or role..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your Preferences</CardTitle>
                <CardDescription>
                  Tell your assistant how you prefer to communicate
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="responseStyle">Response Style</Label>
                  <select
                    id="responseStyle"
                    value={responseStyle}
                    onChange={(e) => setResponseStyle(e.target.value as "concise" | "detailed" | "balanced")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="concise">Concise - Brief and to the point</option>
                    <option value="balanced">Balanced - Moderate detail</option>
                    <option value="detailed">Detailed - Thorough explanations</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="preferredCommunication">Communication Vibe</Label>
                  <Input
                    id="preferredCommunication"
                    value={preferredCommunication}
                    onChange={(e) => setPreferredCommunication(e.target.value)}
                    placeholder="straightforward but fun"
                  />
                  <p className="text-xs text-muted-foreground">
                    Describe how you want your assistant to communicate
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Use bullet points</p>
                      <p className="text-xs text-muted-foreground">
                        Format lists and key info as bullets
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={useBulletPoints}
                      onChange={(e) => setUseBulletPoints(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Proactive suggestions</p>
                      <p className="text-xs text-muted-foreground">
                        Suggest next steps when appropriate
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={proactiveSuggestions}
                      onChange={(e) => setProactiveSuggestions(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Confirm before actions</p>
                      <p className="text-xs text-muted-foreground">
                        Ask before sending emails or making changes
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={confirmBeforeActions}
                      onChange={(e) => setConfirmBeforeActions(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </div>
                </div>

                <Separator />

                <Button onClick={handleSaveAgent} disabled={isSaving} className="w-full">
                  {isSaving ? "Saving..." : "Save Assistant Settings"}
                </Button>
              </CardContent>
            </Card>
          </>
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
