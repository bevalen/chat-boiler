"use client";

import { RefObject } from "react";
import Image from "next/image";

const DEFAULT_AGENT_AVATAR = "/logos/profile-icon.png";

interface SuggestedPrompt {
  title: string;
  prompt: string;
}

interface WelcomeScreenProps {
  agentName: string;
  agentTitle: string;
  agentAvatarUrl?: string | null;
  welcomeMessage?: {
    title: string;
    subtitle: string;
  };
  suggestedPrompts?: SuggestedPrompt[];
  onSuggestedPrompt: (prompt: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

const DEFAULT_SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    title: "Check Schedule",
    prompt: "What's on my schedule today?",
  },
  {
    title: "New Project",
    prompt: "Create a new project for Q1 Marketing",
  },
];

export function WelcomeScreen({
  agentName,
  agentTitle,
  agentAvatarUrl,
  welcomeMessage,
  suggestedPrompts = DEFAULT_SUGGESTED_PROMPTS,
  onSuggestedPrompt,
  textareaRef,
}: WelcomeScreenProps) {

  const avatarUrl = agentAvatarUrl || DEFAULT_AGENT_AVATAR;

  return (
    <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-6 opacity-0 animate-fade-in-up [animation-delay:200ms] fill-mode-forwards">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/10 overflow-hidden">
        <Image src={avatarUrl} alt={agentName} width={80} height={80} className="w-full h-full object-cover" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          {welcomeMessage?.title || "How can I help you today?"}
        </h2>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          {welcomeMessage?.subtitle ||
            `I'm ${agentName}, your ${agentTitle}. I can help with tasks, scheduling, and project management.`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mt-8">
        {suggestedPrompts.map((item, index) => (
          <button
            key={index}
            className="text-sm bg-secondary/50 hover:bg-secondary/80 border border-white/5 rounded-xl p-4 text-left transition-colors cursor-pointer"
            onClick={() => {
              onSuggestedPrompt(item.prompt);
              textareaRef.current?.focus();
            }}
          >
            <span className="font-medium block mb-1">{item.title}</span>
            <span className="text-muted-foreground text-xs">&quot;{item.prompt}&quot;</span>
          </button>
        ))}
      </div>
    </div>
  );
}
