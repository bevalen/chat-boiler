"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { NotificationCenter } from "@/components/notifications/notification-center";

interface DashboardHeaderProps {
  agentId: string | null;
}

export function DashboardHeader({ agentId }: DashboardHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex-1" />
      <NotificationCenter agentId={agentId} />
    </header>
  );
}
