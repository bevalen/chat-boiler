/**
 * AI Personality settings section component
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SettingsPersonalitySectionProps {
  personalityTraits: string;
  personalityStyle: string;
  personalityTone: string;
  personalityBackground: string;
  onTraitsChange: (traits: string) => void;
  onStyleChange: (style: string) => void;
  onToneChange: (tone: string) => void;
  onBackgroundChange: (background: string) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

export function SettingsPersonalitySection({
  personalityTraits,
  personalityStyle,
  personalityTone,
  personalityBackground,
  onTraitsChange,
  onStyleChange,
  onToneChange,
  onBackgroundChange,
  onSave,
  isSaving,
}: SettingsPersonalitySectionProps) {
  return (
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
            onChange={(e) => onTraitsChange(e.target.value)}
            placeholder="proactive, thoughtful, efficient"
          />
          <p className="text-xs text-muted-foreground">Comma-separated personality traits</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="personalityStyle">Style</Label>
            <Input
              id="personalityStyle"
              value={personalityStyle}
              onChange={(e) => onStyleChange(e.target.value)}
              placeholder="professional but approachable"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="personalityTone">Tone</Label>
            <Input
              id="personalityTone"
              value={personalityTone}
              onChange={(e) => onToneChange(e.target.value)}
              placeholder="warm and helpful"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="personalityBackground">Background (optional)</Label>
          <Textarea
            id="personalityBackground"
            value={personalityBackground}
            onChange={(e) => onBackgroundChange(e.target.value)}
            placeholder="Describe your assistant's backstory or role..."
            rows={3}
          />
        </div>
        <Button onClick={onSave} disabled={isSaving} className="w-full">
          {isSaving ? "Saving..." : "Save Personality"}
        </Button>
      </CardContent>
    </Card>
  );
}
