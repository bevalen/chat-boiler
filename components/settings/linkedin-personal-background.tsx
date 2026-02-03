/**
 * LinkedIn personal background section component
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Settings2 } from "lucide-react";

interface LinkedInPersonalBackgroundProps {
  militaryService: string;
  education: string;
  hometown: string;
  interests: string;
  personalOther: string;
  onMilitaryServiceChange: (value: string) => void;
  onEducationChange: (value: string) => void;
  onHometownChange: (value: string) => void;
  onInterestsChange: (value: string) => void;
  onPersonalOtherChange: (value: string) => void;
}

export function LinkedInPersonalBackground({
  militaryService,
  education,
  hometown,
  interests,
  personalOther,
  onMilitaryServiceChange,
  onEducationChange,
  onHometownChange,
  onInterestsChange,
  onPersonalOtherChange,
}: LinkedInPersonalBackgroundProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Personal Background</CardTitle>
        </div>
        <CardDescription>
          Personal details the SDR can use for rapport building. Only share what you&apos;re
          comfortable with.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="militaryService">Military Service</Label>
          <Input
            id="militaryService"
            value={militaryService}
            onChange={(e) => onMilitaryServiceChange(e.target.value)}
            placeholder="e.g., USMC Reservist, Lima 3/23, 0311 Infantry, 2015-2021"
          />
          <p className="text-xs text-muted-foreground">
            Include unit, MOS, years, etc. if you want to build rapport with veteran leads
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="education">Education</Label>
          <Input
            id="education"
            value={education}
            onChange={(e) => onEducationChange(e.target.value)}
            placeholder="e.g., University of Texas, Business Administration"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="hometown">Hometown/Location</Label>
          <Input
            id="hometown"
            value={hometown}
            onChange={(e) => onHometownChange(e.target.value)}
            placeholder="e.g., Originally from Houston, now based in Austin"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="interests">Interests/Hobbies</Label>
          <Input
            id="interests"
            value={interests}
            onChange={(e) => onInterestsChange(e.target.value)}
            placeholder="e.g., golf, travel, fitness"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="personalOther">Other Personal Details</Label>
          <Textarea
            id="personalOther"
            value={personalOther}
            onChange={(e) => onPersonalOtherChange(e.target.value)}
            placeholder="Any other details you want the SDR to know (family, background, etc.)"
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );
}
