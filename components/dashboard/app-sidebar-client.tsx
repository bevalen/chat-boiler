"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { Sidebar } from "@/components/ui/sidebar";

interface AppSidebarClientProps {
  user: {
    email: string;
    name: string | null;
  };
  agentId?: string;
}

export function AppSidebarClient({ user, agentId }: AppSidebarClientProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder sidebar with the same structure to prevent layout shift
    return (
      <Sidebar variant="inset" className="border-r bg-sidebar" aria-hidden="true">
        <div className="flex h-full w-full flex-col" />
      </Sidebar>
    );
  }

  return <AppSidebar user={user} agentId={agentId} />;
}
