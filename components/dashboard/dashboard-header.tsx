"use client";

import { useRouter, usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { PenSquare } from "lucide-react";

interface DashboardHeaderProps {
  agentId: string | null;
}

const STORAGE_KEY = "chat_active_conversation_id";

export function DashboardHeader({ agentId }: DashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Only show new chat button on the main chat page
  const showNewChatButton = pathname === "/" || pathname === "/feedback";

  const handleNewChat = () => {
    // Clear the stored conversation ID to start fresh
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    // Navigate to chat page (or reload if already there)
    if (pathname === "/") {
      // Force reload to reset the chat state
      window.location.href = "/";
    } else {
      router.push("/");
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex-1" />
      {showNewChatButton && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNewChat}
          className="md:hidden h-8 w-8"
          aria-label="New chat"
        >
          <PenSquare className="h-4 w-4" />
        </Button>
      )}
      <NotificationCenter agentId={agentId} />
    </header>
  );
}
