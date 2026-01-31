import { ChatInterface } from "@/components/chat/chat-interface";
import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";

export default async function FeedbackPage() {
  const supabase = await createClient();
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
                title: "Product Manager",
                avatarUrl: agent.avatarUrl,
              }
            : undefined
        }
        user={
          userProfile
            ? {
                name: userProfile.name,
                avatarUrl: userProfile.avatar_url,
              }
            : undefined
        }
        apiEndpoint="/api/feedback/chat"
        hideSidebar={true}
        storageKey={null}
        welcomeMessage={{
          title: "Submit Feedback",
          subtitle: "Tell me about a feature you'd like to see or a bug you've encountered, and I'll gather the details to create a proper report.",
        }}
      />
    </div>
  );
}
