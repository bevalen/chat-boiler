import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";
import { getFeedbackByStatus } from "@/lib/db/feedback";
import { FeedbackKanban } from "@/components/feedback/feedback-kanban";
import { Lightbulb } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function FeatureRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Please log in to view feature requests.</p>
      </div>
    );
  }

  const agent = await getAgentForUser(supabase, user.id);

  if (!agent) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No agent configured.</p>
      </div>
    );
  }

  const { byStatus, error } = await getFeedbackByStatus(supabase, agent.id, "feature_request");

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500">Error loading feature requests: {error}</p>
      </div>
    );
  }

  const totalCount = Object.values(byStatus).reduce((acc, items) => acc + items.length, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10 border border-purple-500/20">
              <Lightbulb className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Feature Requests</h1>
              <p className="text-sm text-muted-foreground">
                {totalCount} {totalCount === 1 ? "request" : "requests"} total
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/feedback">Submit Request</Link>
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 min-h-0 p-6 overflow-hidden">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
              <Lightbulb className="h-8 w-8 text-purple-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No feature requests yet</h2>
            <p className="text-muted-foreground max-w-md mb-4">
              Have an idea for improving MAIA? Submit a feature request and we&apos;ll track it here.
            </p>
            <Button asChild>
              <Link href="/feedback">Submit a Feature Request</Link>
            </Button>
          </div>
        ) : (
          <FeedbackKanban items={byStatus} type="feature_request" />
        )}
      </div>
    </div>
  );
}
