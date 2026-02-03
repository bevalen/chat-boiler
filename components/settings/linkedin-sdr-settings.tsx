"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { SDRConfig } from "@/lib/types/database";
import { LinkedInExtensionManager } from "./linkedin-extension-manager";
import { LinkedInCompanyInfo } from "./linkedin-company-info";
import { LinkedInPersonalBackground } from "./linkedin-personal-background";
import { LinkedInICPConfig } from "./linkedin-icp-config";
import { LinkedInMessageTemplates } from "./linkedin-message-templates";
import { useSdrConfigSave } from "@/hooks/use-sdr-config-save";

interface LinkedInSDRSettingsProps {
  agentId: string;
  initialConfig?: Partial<SDRConfig>;
  onSave?: (config: SDRConfig) => Promise<void>;
}

export function LinkedInSDRSettings({
  agentId,
  initialConfig,
  onSave,
}: LinkedInSDRSettingsProps) {
  // SDR Config state
  const [companyName, setCompanyName] = useState(initialConfig?.companyName || "");
  const [companyDescription, setCompanyDescription] = useState(
    initialConfig?.companyDescription || ""
  );
  const [industries, setIndustries] = useState(initialConfig?.industries || "");
  const [elevatorPitch, setElevatorPitch] = useState(initialConfig?.elevatorPitch || "");
  const [founderStory, setFounderStory] = useState(initialConfig?.founderStory || "");
  const [videoOverviewUrl, setVideoOverviewUrl] = useState(
    initialConfig?.videoOverviewUrl || ""
  );
  const [quickIntroTemplate, setQuickIntroTemplate] = useState(
    initialConfig?.quickIntroTemplate || ""
  );
  const [minimumRevenue, setMinimumRevenue] = useState(
    initialConfig?.minimumRevenue || "$10M+"
  );

  // ICP Arrays
  const [icpCriteria, setIcpCriteria] = useState<string[]>(
    initialConfig?.icpCriteria || [
      "B2B companies in traditional industries",
      "$10M+ revenue",
      "Department heads or executives",
    ]
  );
  const [icpPositiveSignals, setIcpPositiveSignals] = useState<string[]>(
    initialConfig?.icpPositiveSignals || [
      "Owns or runs a B2B company",
      "Leads a department",
      "Mentions bottlenecks or process pain",
    ]
  );
  const [icpNegativeSignals, setIcpNegativeSignals] = useState<string[]>(
    initialConfig?.icpNegativeSignals || [
      "Nonprofit",
      "Job seekers",
      "Tech founders building consumer apps",
    ]
  );
  const [targetTitles, setTargetTitles] = useState<string[]>(
    initialConfig?.targetTitles || ["CEO", "COO", "VP Sales", "VP Operations"]
  );

  // Personal Background
  const [militaryService, setMilitaryService] = useState(
    initialConfig?.personalBackground?.militaryService || ""
  );
  const [education, setEducation] = useState(
    initialConfig?.personalBackground?.education || ""
  );
  const [hometown, setHometown] = useState(initialConfig?.personalBackground?.hometown || "");
  const [interests, setInterests] = useState(initialConfig?.personalBackground?.interests || "");
  const [personalOther, setPersonalOther] = useState(
    initialConfig?.personalBackground?.other || ""
  );

  const { saving, message, saveConfig } = useSdrConfigSave(agentId, onSave);

  const handleSave = async () => {
    const config: SDRConfig = {
      companyName,
      companyDescription,
      industries: industries || undefined,
      elevatorPitch: elevatorPitch || undefined,
      founderStory: founderStory || undefined,
      videoOverviewUrl: videoOverviewUrl || undefined,
      icpCriteria: icpCriteria.length > 0 ? icpCriteria : undefined,
      icpPositiveSignals: icpPositiveSignals.length > 0 ? icpPositiveSignals : undefined,
      icpNegativeSignals: icpNegativeSignals.length > 0 ? icpNegativeSignals : undefined,
      quickIntroTemplate: quickIntroTemplate || undefined,
      minimumRevenue: minimumRevenue || undefined,
      targetTitles: targetTitles.length > 0 ? targetTitles : undefined,
      personalBackground:
        militaryService || education || hometown || interests || personalOther
          ? {
              militaryService: militaryService || undefined,
              education: education || undefined,
              hometown: hometown || undefined,
              interests: interests || undefined,
              other: personalOther || undefined,
            }
          : undefined,
    };

    await saveConfig(config);
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-3 rounded-md text-sm ${
            message.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-500/10 text-green-500"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Extension Status */}
      <LinkedInExtensionManager />

      {/* Company Context */}
      <LinkedInCompanyInfo
        companyName={companyName}
        companyDescription={companyDescription}
        industries={industries}
        elevatorPitch={elevatorPitch}
        founderStory={founderStory}
        videoOverviewUrl={videoOverviewUrl}
        onCompanyNameChange={setCompanyName}
        onCompanyDescriptionChange={setCompanyDescription}
        onIndustriesChange={setIndustries}
        onElevatorPitchChange={setElevatorPitch}
        onFounderStoryChange={setFounderStory}
        onVideoOverviewUrlChange={setVideoOverviewUrl}
      />

      {/* Personal Background */}
      <LinkedInPersonalBackground
        militaryService={militaryService}
        education={education}
        hometown={hometown}
        interests={interests}
        personalOther={personalOther}
        onMilitaryServiceChange={setMilitaryService}
        onEducationChange={setEducation}
        onHometownChange={setHometown}
        onInterestsChange={setInterests}
        onPersonalOtherChange={setPersonalOther}
      />

      {/* ICP Configuration */}
      <LinkedInICPConfig
        icpCriteria={icpCriteria}
        icpPositiveSignals={icpPositiveSignals}
        icpNegativeSignals={icpNegativeSignals}
        targetTitles={targetTitles}
        minimumRevenue={minimumRevenue}
        onCriteriaChange={setIcpCriteria}
        onPositiveSignalsChange={setIcpPositiveSignals}
        onNegativeSignalsChange={setIcpNegativeSignals}
        onTargetTitlesChange={setTargetTitles}
        onMinimumRevenueChange={setMinimumRevenue}
      />

      {/* Message Templates */}
      <LinkedInMessageTemplates
        quickIntroTemplate={quickIntroTemplate}
        onQuickIntroTemplateChange={setQuickIntroTemplate}
      />

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !companyName || !companyDescription}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Save SDR Configuration
        </Button>
      </div>
    </div>
  );
}
