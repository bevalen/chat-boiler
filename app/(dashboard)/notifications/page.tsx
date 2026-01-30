import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";
import { getNotifications } from "@/lib/db/notifications";
import { NotificationsClient } from "./notifications-client";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please log in to view notifications</div>;
  }

  const agent = await getAgentForUser(supabase, user.id);
  if (!agent) {
    return <div>No agent configured</div>;
  }

  // Fetch notifications
  const { notifications } = await getNotifications(supabase, agent.id, {
    limit: 100,
    unreadOnly: false,
  });

  return <NotificationsClient initialNotifications={notifications} agentId={agent.id} />;
}
