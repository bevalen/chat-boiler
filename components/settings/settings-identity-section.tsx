/**
 * AI Identity settings section component
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Bot } from "lucide-react";
import Image from "next/image";

interface SettingsIdentitySectionProps {
  agent: {
    id: string;
    email: string | null;
  };
  agentTitle: string;
  onTitleChange: (title: string) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

export function SettingsIdentitySection({
  agent,
  agentTitle,
  onTitleChange,
  onSave,
  isSaving,
}: SettingsIdentitySectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-muted-foreground" />
          <CardTitle>AI Assistant Identity</CardTitle>
        </div>
        <CardDescription>Your AI assistant is your executive assistant</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Standardized Identity Display */}
        <div className="flex items-start gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-secondary border border-border overflow-hidden">
              <Image
                src="/logos/profile-icon.png"
                alt="AI Assistant"
                width={96}
                height={96}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <Label>Assistant Identity</Label>
            <p className="text-lg font-semibold">AI Assistant</p>
            <p className="text-sm text-muted-foreground">Your AI Executive Assistant</p>
            <p className="text-xs text-muted-foreground mt-2">
              The assistant&apos;s identity is standardized to provide a consistent, professional experience.
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid gap-2">
          <Label htmlFor="agentTitle">Title</Label>
          <Input
            id="agentTitle"
            value={agentTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Executive Assistant"
          />
          <p className="text-xs text-muted-foreground">
            Customize how the assistant introduces itself
          </p>
        </div>

        <div className="grid gap-2">
          <Label>Email</Label>
          <Input value={agent.email || "Not configured"} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">
            Email address used when the assistant sends emails on your behalf
          </p>
        </div>

        <Button onClick={onSave} disabled={isSaving} className="w-full">
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
