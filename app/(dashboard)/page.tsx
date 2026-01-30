import { ChatInterface } from "@/components/chat/chat-interface";
import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let agent = null;
  if (user) {
    agent = await getAgentForUser(supabase, user.id);
  }

  return (
    <div className="h-[calc(100vh-57px)]">
      <ChatInterface
        agent={
          agent
            ? {
                name: agent.name,
                title: agent.title,
                avatarUrl: agent.avatarUrl,
              }
            : undefined
        }
      />
    </div>
  );
}
