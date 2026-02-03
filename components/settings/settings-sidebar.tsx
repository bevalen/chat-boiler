/**
 * Settings sidebar navigation component
 */

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, User, Bot, Shield, MessageSquare, Sparkles, Radio, Linkedin, Bell } from "lucide-react";

export type SettingsSection =
  | "profile"
  | "identity"
  | "personality"
  | "preferences"
  | "custom-instructions"
  | "notifications"
  | "channels"
  | "linkedin"
  | "security";

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  showSidebar: boolean;
  onClose: () => void;
}

const settingsSections = [
  {
    id: "profile" as SettingsSection,
    label: "Profile",
    icon: <User className="h-4 w-4" />,
    description: "Personal information",
  },
  {
    id: "identity" as SettingsSection,
    label: "AI Identity",
    icon: <Bot className="h-4 w-4" />,
    description: "Assistant appearance",
  },
  {
    id: "personality" as SettingsSection,
    label: "AI Personality",
    icon: <Sparkles className="h-4 w-4" />,
    description: "Traits & style",
  },
  {
    id: "preferences" as SettingsSection,
    label: "Preferences",
    icon: <MessageSquare className="h-4 w-4" />,
    description: "Communication style",
  },
  {
    id: "custom-instructions" as SettingsSection,
    label: "Custom Instructions",
    icon: <Sparkles className="h-4 w-4" />,
    description: "About you",
  },
  {
    id: "notifications" as SettingsSection,
    label: "Notifications",
    icon: <Bell className="h-4 w-4" />,
    description: "Push notifications",
  },
  {
    id: "channels" as SettingsSection,
    label: "Channels",
    icon: <Radio className="h-4 w-4" />,
    description: "Communication channels",
  },
  {
    id: "linkedin" as SettingsSection,
    label: "LinkedIn SDR",
    icon: <Linkedin className="h-4 w-4" />,
    description: "AI sales assistant",
  },
  {
    id: "security" as SettingsSection,
    label: "Security",
    icon: <Shield className="h-4 w-4" />,
    description: "Account security",
  },
];

export function SettingsSidebar({
  activeSection,
  onSectionChange,
  showSidebar,
  onClose,
}: SettingsSidebarProps) {
  return (
    <div
      className={`absolute md:relative z-30 h-full bg-background/95 backdrop-blur-md border-r border-white/5 transition-all duration-300 ${
        showSidebar ? "w-64 opacity-100" : "w-0 opacity-0 md:w-0"
      } overflow-hidden flex flex-col`}
    >
      <div className="w-64 h-full flex flex-col">
        <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 shrink-0">
          <h3 className="font-semibold">Settings</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="md:hidden h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-1 py-2">
            {settingsSections.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  onSectionChange(section.id);
                  if (typeof window !== "undefined" && window.innerWidth < 768) {
                    onClose();
                  }
                }}
                className={`group w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  activeSection === section.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-secondary/50 text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0">{section.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{section.label}</div>
                    <div className="text-xs opacity-60 truncate">{section.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

export { settingsSections };
