/**
 * Profile settings section component
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Upload, User, X } from "lucide-react";
import Image from "next/image";
import { useAvatarUpload } from "@/hooks/use-avatar-upload";

interface SettingsProfileSectionProps {
  user: {
    id: string;
    email: string;
    name: string;
    timezone: string;
    avatarUrl: string | null;
  };
  name: string;
  timezone: string;
  onNameChange: (name: string) => void;
  onTimezoneChange: (timezone: string) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

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

export function SettingsProfileSection({
  user,
  name,
  timezone,
  onNameChange,
  onTimezoneChange,
  onSave,
  isSaving,
}: SettingsProfileSectionProps) {
  const { avatarUrl, uploading, fileInputRef, handleUpload, handleRemove } =
    useAvatarUpload(user.id, "user", user.avatarUrl || "", () => {});

  return (
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
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
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
            {avatarUrl && (
              <button
                onClick={handleRemove}
                className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <Label>Profile Photo</Label>
            <p className="text-sm text-muted-foreground">Upload a photo for your profile</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Uploading..." : "Upload Image"}
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
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="timezone">Timezone</Label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => onTimezoneChange(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Profile"}
        </Button>
      </CardContent>
    </Card>
  );
}
