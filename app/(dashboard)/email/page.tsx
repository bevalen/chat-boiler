import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";
import { getInboxEmails, getUnreadEmailCount } from "@/lib/db/emails";
import { EmailClient } from "./email-client";

export default async function EmailPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please log in to view emails</div>;
  }

  const agent = await getAgentForUser(supabase, user.id);
  if (!agent) {
    return <div>No agent configured</div>;
  }

  // Fetch initial emails
  const { emails } = await getInboxEmails(supabase, agent.id, {
    limit: 50,
    offset: 0,
    direction: "all",
  });

  // Get unread count
  const { count: unreadCount } = await getUnreadEmailCount(supabase, agent.id);

  return (
    <EmailClient
      initialEmails={emails}
      initialUnreadCount={unreadCount}
      agentId={agent.id}
    />
  );
}
