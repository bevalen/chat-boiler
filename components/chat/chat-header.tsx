"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Bot, MessageSquare } from "lucide-react";

interface ChatHeaderProps {
  agentName: string;
  agentTitle: string;
  agentAvatarUrl?: string | null;
  hideSidebar?: boolean;
  onToggleSidebar?: () => void;
}

export function ChatHeader({ agentName, agentTitle, agentAvatarUrl, hideSidebar, onToggleSidebar }: ChatHeaderProps) {
  return (
    <div className="h-14 border-b border-white/5 bg-background/80 backdrop-blur-md px-4 flex items-center gap-3 z-20 shrink-0">
      {!hideSidebar && onToggleSidebar && (
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="shrink-0">
          <MessageSquare className="h-4 w-4" />
        </Button>
      )}
      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
        {agentAvatarUrl ? (
          <Image src={agentAvatarUrl} alt={agentName} width={32} height={32} className="w-full h-full object-cover" />
        ) : (
          <Bot className="w-5 h-5 text-primary" />
        )}
      </div>
      <div className="min-w-0">
        <h2 className="font-semibold text-sm truncate">{agentName}</h2>
        <p className="text-xs text-muted-foreground truncate">{agentTitle}</p>
      </div>
    </div>
  );
}
