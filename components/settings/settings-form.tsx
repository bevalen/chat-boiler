"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Menu } from "lucide-react";
import { AgentPersonality, UserPreferences } from "@/lib/types/database";
import { SettingsSidebar, settingsSections, type SettingsSection } from "./settings-sidebar";
import { SettingsProfileSection } from "./settings-profile-section";
import { SettingsIdentitySection } from "./settings-identity-section";
import { SettingsPersonalitySection } from "./settings-personality-section";
import { SettingsPreferencesSection } from "./settings-preferences-section";
import { SettingsCustomInstructionsSection } from "./settings-custom-instructions-section";
import { SettingsSecuritySection } from "./settings-security-section";
import { useSettingsSave } from "@/hooks/use-settings-save";

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
    customInstructions: string | null;
  } | null;
}

export function SettingsForm({ user, agent }: SettingsFormProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [showSidebar, setShowSidebar] = useState(false);

  // Auto-open sidebar on desktop
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setShowSidebar(true);
    }
  }, []);

  // User state
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone);

  // Agent state
  const [agentTitle, setAgentTitle] = useState(agent?.title || "AI Assistant");

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
    agent?.userPreferences?.confirm_before_actions ?? false
  );
  const [preferredCommunication, setPreferredCommunication] = useState(
    agent?.userPreferences?.preferred_communication || "straightforward but fun"
  );

  // Custom instructions state
  const [customInstructions, setCustomInstructions] = useState(
    agent?.customInstructions || ""
  );

  const { isSaving, message, setMessage, saveProfile, saveAgent } = useSettingsSave();

  const handleSaveProfile = async () => {
    await saveProfile(user.id, { name, timezone });
  };

  const handleSaveAgent = async () => {
    if (!agent) return;

    const personality: AgentPersonality = {
      traits: personalityTraits.split(",").map((t) => t.trim()).filter(Boolean),
      style: personalityStyle,
      tone: personalityTone,
      background: personalityBackground,
    };

    const userPreferences: UserPreferences = {
      response_style: responseStyle,
      verbosity:
        responseStyle === "concise"
          ? "brief"
          : responseStyle === "detailed"
            ? "verbose"
            : "moderate",
      use_bullet_points: useBulletPoints,
      proactive_suggestions: proactiveSuggestions,
      confirm_before_actions: confirmBeforeActions,
      preferred_communication: preferredCommunication,
    };

    await saveAgent(agent.id, {
      title: agentTitle,
      personality,
      userPreferences,
      customInstructions: customInstructions || null,
    });
  };

  const currentSection = settingsSections.find((s) => s.id === activeSection);

  return (
    <div className="flex h-full bg-background/50 relative overflow-hidden">
      {/* Settings Sidebar */}
      <SettingsSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        showSidebar={showSidebar}
        onClose={() => setShowSidebar(false)}
      />

      {/* Main Settings Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-2xl">
          {/* Section Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSidebar(!showSidebar)}
                className="shrink-0 h-8 w-8"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold">{currentSection?.label}</h1>
            </div>
            <p className="text-muted-foreground ml-11">{currentSection?.description}</p>
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

          {/* Profile Section */}
          {activeSection === "profile" && (
            <SettingsProfileSection
              user={user}
              name={name}
              timezone={timezone}
              onNameChange={setName}
              onTimezoneChange={setTimezone}
              onSave={handleSaveProfile}
              isSaving={isSaving}
            />
          )}

          {/* AI Identity Section */}
          {activeSection === "identity" && agent && (
            <SettingsIdentitySection
              agent={agent}
              agentTitle={agentTitle}
              onTitleChange={setAgentTitle}
              onSave={handleSaveAgent}
              isSaving={isSaving}
            />
          )}

          {/* Personality Section */}
          {activeSection === "personality" && agent && (
            <SettingsPersonalitySection
              personalityTraits={personalityTraits}
              personalityStyle={personalityStyle}
              personalityTone={personalityTone}
              personalityBackground={personalityBackground}
              onTraitsChange={setPersonalityTraits}
              onStyleChange={setPersonalityStyle}
              onToneChange={setPersonalityTone}
              onBackgroundChange={setPersonalityBackground}
              onSave={handleSaveAgent}
              isSaving={isSaving}
            />
          )}

          {/* Preferences Section */}
          {activeSection === "preferences" && agent && (
            <SettingsPreferencesSection
              responseStyle={responseStyle}
              preferredCommunication={preferredCommunication}
              useBulletPoints={useBulletPoints}
              proactiveSuggestions={proactiveSuggestions}
              confirmBeforeActions={confirmBeforeActions}
              onResponseStyleChange={setResponseStyle}
              onPreferredCommunicationChange={setPreferredCommunication}
              onUseBulletPointsChange={setUseBulletPoints}
              onProactiveSuggestionsChange={setProactiveSuggestions}
              onConfirmBeforeActionsChange={setConfirmBeforeActions}
              onSave={handleSaveAgent}
              isSaving={isSaving}
            />
          )}

          {/* Custom Instructions Section */}
          {activeSection === "custom-instructions" && agent && (
            <SettingsCustomInstructionsSection
              customInstructions={customInstructions}
              onInstructionsChange={setCustomInstructions}
              onSave={handleSaveAgent}
              isSaving={isSaving}
              agentId={agent.id}
            />
          )}

          {/* Security Section */}
          {activeSection === "security" && <SettingsSecuritySection />}
        </div>
      </div>
    </div>
  );
}
