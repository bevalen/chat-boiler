import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebarClient } from "@/components/dashboard/app-sidebar-client";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { getAgentForUser } from "@/lib/db/agents";
import { CommandPaletteProvider } from "@/components/command-palette-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile and agent
  const [profileResult, agent] = await Promise.all([
    supabase.from("users").select("name").eq("id", user.id).single(),
    getAgentForUser(supabase, user.id),
  ]);

  return (
    <CommandPaletteProvider>
      <SidebarProvider className="!h-svh !max-h-svh overflow-hidden">
        <AppSidebarClient
          user={{
            email: user.email || "",
            name: profileResult.data?.name,
          }}
          agentId={agent?.id}
        />
        <SidebarInset className="!h-svh !max-h-svh !min-h-0 overflow-hidden">
          <DashboardHeader agentId={agent?.id || null} />
          <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </CommandPaletteProvider>
  );
}
