"use client";

import { useState, useEffect } from "react";
import { Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ActivityLogEntry, ActivityType, ActivitySource } from "@/lib/db/activity-log";
import { ActivityStats } from "@/components/activity/activity-stats";
import { ActivityFilters } from "@/components/activity/activity-filters";
import { ActivityList } from "@/components/activity/activity-list";
import { useActivityStats, type ActivityStats as ActivityStatsType } from "@/hooks/use-activity-stats";

interface ActivityClientProps {
  initialActivities: ActivityLogEntry[];
  initialTotal: number;
  initialStats: ActivityStatsType | null;
  agentId: string;
}

export function ActivityClient({
  initialActivities,
  initialTotal,
  initialStats,
  agentId,
}: ActivityClientProps) {
  const supabase = createClient();
  const [activities, setActivities] = useState<ActivityLogEntry[]>(initialActivities);
  const [total, setTotal] = useState(initialTotal);
  const [typeFilter, setTypeFilter] = useState<ActivityType | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<ActivitySource | "all">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Calculate stats from current activities
  const calculatedStats = useActivityStats(activities);
  const stats = initialStats || calculatedStats;

  // Set up realtime subscription for new activities
  useEffect(() => {
    const channel = supabase
      .channel(`activity-log:${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_log",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          const newActivity: ActivityLogEntry = {
            id: payload.new.id,
            agentId: payload.new.agent_id,
            activityType: payload.new.activity_type,
            source: payload.new.source,
            title: payload.new.title,
            description: payload.new.description,
            metadata: payload.new.metadata || {},
            conversationId: payload.new.conversation_id,
            taskId: payload.new.task_id,
            projectId: payload.new.project_id,
            jobId: payload.new.job_id,
            status: payload.new.status,
            durationMs: payload.new.duration_ms,
            createdAt: payload.new.created_at,
          };
          setActivities((prev) => [newActivity, ...prev]);
          setTotal((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId, supabase]);

  const fetchActivities = async (reset = false) => {
    setIsLoading(true);
    const newOffset = reset ? 0 : offset;

    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(newOffset));
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      params.set("stats", "true");

      const response = await fetch(`/api/activity?${params.toString()}`);
      const data = await response.json();

      if (reset) {
        setActivities(data.activities);
        setOffset(0);
      } else {
        setActivities((prev) => [...prev, ...data.activities]);
      }
      setTotal(data.total);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchActivities(true);
    setIsRefreshing(false);
  };

  const handleLoadMore = async () => {
    setOffset((prev) => prev + limit);
    await fetchActivities(false);
  };

  // Reset and refetch when filters change
  useEffect(() => {
    fetchActivities(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, sourceFilter]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Activity Log
          </h1>
          <p className="text-muted-foreground">{total} activities tracked</p>
        </div>
        <ActivityFilters
          typeFilter={typeFilter}
          sourceFilter={sourceFilter}
          onTypeFilterChange={setTypeFilter}
          onSourceFilterChange={setSourceFilter}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* Stats Cards */}
      {stats && <ActivityStats stats={stats} />}

      {/* Activity List */}
      <ActivityList
        activities={activities}
        total={total}
        isLoading={isLoading}
        onLoadMore={handleLoadMore}
      />
    </div>
  );
}
