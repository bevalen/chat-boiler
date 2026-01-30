import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { getAgentForUser } from "@/lib/db/agents";

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
    <SidebarProvider>
      <AppSidebar
        user={{
          email: user.email || "",
          name: profileResult.data?.name,
        }}
      />
      <SidebarInset>
        <DashboardHeader agentId={agent?.id || null} />
        <main className="flex-1 overflow-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
