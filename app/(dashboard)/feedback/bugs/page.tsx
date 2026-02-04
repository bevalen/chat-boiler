import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";
import { getFeedbackByStatus } from "@/lib/db/feedback";
import { FeedbackKanban } from "@/components/feedback/feedback-kanban";
import { Bug } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function BugReportsPage() {
  const supabase = await createClient();
  
  // Skip auth if Supabase is not configured (boilerplate mode)
  if (!supabase) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-border/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                <Bug className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Bug Reports</h1>
                <p className="text-sm text-muted-foreground">0 reports total</p>
              </div>
            </div>
            <Button asChild variant="destructive">
              <Link href="/feedback">Report Bug</Link>
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0 p-6 overflow-hidden">
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 mb-4">
              <Bug className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No bug reports</h2>
            <p className="text-muted-foreground max-w-md mb-4">
              Configure Supabase to enable bug report tracking.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Please log in to view bug reports.</p>
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

  const { byStatus, error } = await getFeedbackByStatus(supabase, agent.id, "bug_report");

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500">Error loading bug reports: {error}</p>
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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
              <Bug className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Bug Reports</h1>
              <p className="text-sm text-muted-foreground">
                {totalCount} {totalCount === 1 ? "report" : "reports"} total
              </p>
            </div>
          </div>
          <Button asChild variant="destructive">
            <Link href="/feedback">Report Bug</Link>
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 min-h-0 p-6 overflow-hidden">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 mb-4">
              <Bug className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No bug reports</h2>
            <p className="text-muted-foreground max-w-md mb-4">
              Found a bug? Report it here and we&apos;ll track it to resolution.
            </p>
            <Button asChild variant="destructive">
              <Link href="/feedback">Report a Bug</Link>
            </Button>
          </div>
        ) : (
          <FeedbackKanban items={byStatus} type="bug_report" />
        )}
      </div>
    </div>
  );
}
