/**
 * Hook for fetching and managing project activity (comments and activity log)
 */

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export interface ActivityItem {
  type: "comment" | "activity";
  id: string;
  content: string; // or title for activity
  description?: string;
  author_type?: string;
  created_at: string;
  source?: string;
}

export function useProjectActivity(projectId: string) {
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const fetchProjectActivity = async () => {
    const supabase = createClient();

    // Fetch comments
    const { data: comments } = await supabase
      .from("comments")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch activity log
    const { data: activity } = await supabase
      .from("activity_log")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20);

    const items: ActivityItem[] = [
      ...(comments?.map((c: any) => ({
        type: "comment" as const,
        id: c.id,
        content: c.content,
        author_type: c.author_type,
        created_at: c.created_at,
      })) || []),
      ...(activity?.map((a: any) => ({
        type: "activity" as const,
        id: a.id,
        content: a.title,
        description: a.description,
        source: a.source,
        created_at: a.created_at,
      })) || []),
    ].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    setActivityItems(items);

    setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    }, 100);
  };

  useEffect(() => {
    fetchProjectActivity();
  }, [projectId]);

  return {
    activityItems,
    setActivityItems,
    scrollAreaRef,
    refetch: fetchProjectActivity,
  };
}
