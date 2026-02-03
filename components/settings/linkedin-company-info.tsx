/**
 * LinkedIn company info section component
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Video } from "lucide-react";

interface LinkedInCompanyInfoProps {
  companyName: string;
  companyDescription: string;
  industries: string;
  elevatorPitch: string;
  founderStory: string;
  videoOverviewUrl: string;
  onCompanyNameChange: (value: string) => void;
  onCompanyDescriptionChange: (value: string) => void;
  onIndustriesChange: (value: string) => void;
  onElevatorPitchChange: (value: string) => void;
  onFounderStoryChange: (value: string) => void;
  onVideoOverviewUrlChange: (value: string) => void;
}

export function LinkedInCompanyInfo({
  companyName,
  companyDescription,
  industries,
  elevatorPitch,
  founderStory,
  videoOverviewUrl,
  onCompanyNameChange,
  onCompanyDescriptionChange,
  onIndustriesChange,
  onElevatorPitchChange,
  onFounderStoryChange,
  onVideoOverviewUrlChange,
}: LinkedInCompanyInfoProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Company Context</CardTitle>
        </div>
        <CardDescription>
          Information about your company that the SDR will use in conversations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="companyName">Company Name *</Label>
          <Input
            id="companyName"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            placeholder="Madewell AI"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="companyDescription">Company Description *</Label>
          <Textarea
            id="companyDescription"
            value={companyDescription}
            onChange={(e) => onCompanyDescriptionChange(e.target.value)}
            placeholder="We're a revenue engineering firm. We help traditional B2B companies stop losing revenue to broken systems..."
            rows={3}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="industries">Target Industries</Label>
          <Input
            id="industries"
            value={industries}
            onChange={(e) => onIndustriesChange(e.target.value)}
            placeholder="manufacturing, construction, field services, logistics"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="elevatorPitch">Elevator Pitch</Label>
          <Textarea
            id="elevatorPitch"
            value={elevatorPitch}
            onChange={(e) => onElevatorPitchChange(e.target.value)}
            placeholder="I run a revenue engineering firm - we help B2B companies automate the stuff that kills deals."
            rows={2}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="founderStory">Founder Story (Optional)</Label>
          <Textarea
            id="founderStory"
            value={founderStory}
            onChange={(e) => onFounderStoryChange(e.target.value)}
            placeholder="I started this company after..."
            rows={3}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="videoOverviewUrl" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Video Overview URL
          </Label>
          <Input
            id="videoOverviewUrl"
            value={videoOverviewUrl}
            onChange={(e) => onVideoOverviewUrlChange(e.target.value)}
            placeholder="https://youtu.be/yourVideo"
          />
        </div>
      </CardContent>
    </Card>
  );
}
