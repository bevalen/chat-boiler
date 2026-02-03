/**
 * LinkedIn message templates section component
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare } from "lucide-react";

interface LinkedInMessageTemplatesProps {
  quickIntroTemplate: string;
  onQuickIntroTemplateChange: (value: string) => void;
}

export function LinkedInMessageTemplates({
  quickIntroTemplate,
  onQuickIntroTemplateChange,
}: LinkedInMessageTemplatesProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Message Templates</CardTitle>
        </div>
        <CardDescription>Custom message templates for the SDR to use</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="quickIntroTemplate">Quick Intro Template</Label>
          <Textarea
            id="quickIntroTemplate"
            value={quickIntroTemplate}
            onChange={(e) => onQuickIntroTemplateChange(e.target.value)}
            placeholder="I run a revenue engineering firm - we help B2B companies automate the stuff that kills deals. Lead follow-up, proposals, handoffs, invoicing. Here's a quick look: [video link]"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            This template is used when introducing your company. The SDR will personalize it based on
            context.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
