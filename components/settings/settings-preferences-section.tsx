/**
 * User Preferences settings section component
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface SettingsPreferencesSectionProps {
  responseStyle: "concise" | "detailed" | "balanced";
  preferredCommunication: string;
  useBulletPoints: boolean;
  proactiveSuggestions: boolean;
  confirmBeforeActions: boolean;
  onResponseStyleChange: (style: "concise" | "detailed" | "balanced") => void;
  onPreferredCommunicationChange: (comm: string) => void;
  onUseBulletPointsChange: (value: boolean) => void;
  onProactiveSuggestionsChange: (value: boolean) => void;
  onConfirmBeforeActionsChange: (value: boolean) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

export function SettingsPreferencesSection({
  responseStyle,
  preferredCommunication,
  useBulletPoints,
  proactiveSuggestions,
  confirmBeforeActions,
  onResponseStyleChange,
  onPreferredCommunicationChange,
  onUseBulletPointsChange,
  onProactiveSuggestionsChange,
  onConfirmBeforeActionsChange,
  onSave,
  isSaving,
}: SettingsPreferencesSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Preferences</CardTitle>
        <CardDescription>Tell your assistant how you prefer to communicate</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="responseStyle">Response Style</Label>
          <select
            id="responseStyle"
            value={responseStyle}
            onChange={(e) =>
              onResponseStyleChange(e.target.value as "concise" | "detailed" | "balanced")
            }
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
            onChange={(e) => onPreferredCommunicationChange(e.target.value)}
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
              <p className="text-xs text-muted-foreground">Format lists and key info as bullets</p>
            </div>
            <input
              type="checkbox"
              checked={useBulletPoints}
              onChange={(e) => onUseBulletPointsChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Proactive suggestions</p>
              <p className="text-xs text-muted-foreground">Suggest next steps when appropriate</p>
            </div>
            <input
              type="checkbox"
              checked={proactiveSuggestions}
              onChange={(e) => onProactiveSuggestionsChange(e.target.checked)}
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
              onChange={(e) => onConfirmBeforeActionsChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
          </div>
        </div>

        <Separator />

        <Button onClick={onSave} disabled={isSaving} className="w-full">
          {isSaving ? "Saving..." : "Save Assistant Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
