import { ChatInterface } from "@/components/chat/chat-interface";
import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const supabase = await createClient();
  
  // Skip auth if Supabase is not configured (boilerplate mode)
  if (!supabase) {
    return (
      <div className="h-[calc(100vh-57px)]">
        <ChatInterface
          agent={undefined}
          agentId={undefined}
          user={undefined}
        />
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let agent = null;
  let userProfile = null;
  
  if (user) {
    agent = await getAgentForUser(supabase, user.id);
    
    // Get user profile for avatar
    const { data: profile } = await supabase
      .from("users")
      .select("name, avatar_url")
      .eq("id", user.id)
      .single();
    
    userProfile = profile;
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
        agentId={agent?.id}
        user={
          userProfile
            ? {
                name: userProfile.name,
                avatarUrl: userProfile.avatar_url,
              }
            : undefined
        }
      />
    </div>
  );
}
