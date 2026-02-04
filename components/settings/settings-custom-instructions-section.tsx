/**
 * Custom Instructions settings section component
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";
import { PriorityPreferences } from "./priority-preferences";

interface SettingsCustomInstructionsSectionProps {
  customInstructions: string;
  onInstructionsChange: (instructions: string) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  agentId: string;
}

export function SettingsCustomInstructionsSection({
  customInstructions,
  onInstructionsChange,
  onSave,
  isSaving,
  agentId,
}: SettingsCustomInstructionsSectionProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Custom Instructions</CardTitle>
          </div>
          <CardDescription>
            Tell your AI assistant about yourself, your preferences, and how you work. This information is
            included in every conversation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="customInstructions">Your Instructions</Label>
            <Textarea
              id="customInstructions"
              value={customInstructions}
              onChange={(e) => onInstructionsChange(e.target.value)}
              placeholder="Examples:&#10;- I'm a TypeScript developer working on web apps&#10;- I prefer concise, actionable responses&#10;- I live in San Francisco (PST timezone)&#10;- I'm vegan&#10;- Always use TypeScript, never JavaScript"
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This is like giving your AI assistant a &quot;user manual&quot; about you. Be specific!
            </p>
          </div>

          <Separator />

          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="font-medium mb-2 text-sm">What to include:</h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Your role, work, and technical preferences</li>
              <li>Communication style preferences</li>
              <li>Personal context (location, dietary, interests)</li>
              <li>Common tasks and workflows</li>
              <li>Important do&apos;s and don&apos;ts</li>
            </ul>
          </div>

          <Button onClick={onSave} disabled={isSaving} className="w-full">
            {isSaving ? "Saving..." : "Save Custom Instructions"}
          </Button>
        </CardContent>
      </Card>

      {/* Priority Preferences - structured preferences */}
      <div className="mt-6">
        <PriorityPreferences agentId={agentId} />
      </div>
    </>
  );
}
