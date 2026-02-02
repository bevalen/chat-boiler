"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Clock,
  Mail,
  MailOpen,
  Search,
  Brain,
  ListTodo,
  FolderKanban,
  Bell,
  MessageSquare,
  Webhook,
  AlertCircle,
  Settings,
  Filter,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ActivityLogEntry, ActivityType, ActivitySource } from "@/lib/db/activity-log";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface ActivityStats {
  totalActivities: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  errorCount: number;
}

interface ActivityClientProps {
  initialActivities: ActivityLogEntry[];
  initialTotal: number;
  initialStats: ActivityStats | null;
  agentId: string;
}

const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
  tool_call: <Settings className="h-4 w-4" />,
  cron_execution: <Clock className="h-4 w-4" />,
  email_sent: <Mail className="h-4 w-4" />,
  email_received: <MailOpen className="h-4 w-4" />,
  email_processed: <MailOpen className="h-4 w-4" />,
  research: <Search className="h-4 w-4" />,
  memory_saved: <Brain className="h-4 w-4" />,
  task_created: <ListTodo className="h-4 w-4" />,
  task_updated: <ListTodo className="h-4 w-4" />,
  project_created: <FolderKanban className="h-4 w-4" />,
  project_updated: <FolderKanban className="h-4 w-4" />,
  reminder_created: <Bell className="h-4 w-4" />,
  job_scheduled: <Clock className="h-4 w-4" />,
  notification_sent: <Bell className="h-4 w-4" />,
  webhook_triggered: <Webhook className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
  system: <Settings className="h-4 w-4" />,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  tool_call: "text-blue-500",
  cron_execution: "text-purple-500",
  email_sent: "text-green-500",
  email_received: "text-green-500",
  email_processed: "text-emerald-500",
  research: "text-amber-500",
  memory_saved: "text-pink-500",
  task_created: "text-orange-500",
  task_updated: "text-orange-500",
  project_created: "text-violet-500",
  project_updated: "text-violet-500",
  reminder_created: "text-blue-500",
  job_scheduled: "text-cyan-500",
  notification_sent: "text-indigo-500",
  webhook_triggered: "text-teal-500",
  error: "text-red-500",
  system: "text-gray-500",
};

const SOURCE_LABELS: Record<ActivitySource, string> = {
  chat: "Chat",
  cron: "Scheduled",
  webhook: "Webhook",
  email: "Email",
  system: "System",
};

const SOURCE_COLORS: Record<ActivitySource, string> = {
  chat: "bg-blue-500/10 text-blue-500",
  cron: "bg-purple-500/10 text-purple-500",
  webhook: "bg-teal-500/10 text-teal-500",
  email: "bg-green-500/10 text-green-500",
  system: "bg-gray-500/10 text-gray-500",
};

export function ActivityClient({
  initialActivities,
  initialTotal,
  initialStats,
  agentId,
}: ActivityClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [activities, setActivities] = useState<ActivityLogEntry[]>(initialActivities);
  const [total, setTotal] = useState(initialTotal);
  const [stats, setStats] = useState<ActivityStats | null>(initialStats);
  const [typeFilter, setTypeFilter] = useState<ActivityType | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<ActivitySource | "all">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(0);
  const limit = 50;

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
      if (data.stats) setStats(data.stats);
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

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return null;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case "failed":
        return <XCircle className="h-3 w-3 text-red-500" />;
      case "started":
        return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const handleActivityClick = (activity: ActivityLogEntry) => {
    if (activity.conversationId) {
      router.push(`/?conversation=${activity.conversationId}`);
    } else if (activity.taskId) {
      router.push("/tasks");
    } else if (activity.projectId) {
      router.push(`/projects/${activity.projectId}`);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Activity Log
          </h1>
          <p className="text-muted-foreground">
            {total} activities tracked
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Type Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                {typeFilter === "all" ? "All Types" : typeFilter.replace("_", " ")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
              <DropdownMenuCheckboxItem
                checked={typeFilter === "all"}
                onCheckedChange={() => setTypeFilter("all")}
              >
                All Types
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {(Object.keys(ACTIVITY_ICONS) as ActivityType[]).map((type) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={typeFilter === type}
                  onCheckedChange={() => setTypeFilter(type)}
                >
                  <span className={cn("mr-2", ACTIVITY_COLORS[type])}>
                    {ACTIVITY_ICONS[type]}
                  </span>
                  {type.replace(/_/g, " ")}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Source Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                {sourceFilter === "all" ? "All Sources" : SOURCE_LABELS[sourceFilter]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={sourceFilter === "all"}
                onCheckedChange={() => setSourceFilter("all")}
              >
                All Sources
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {(Object.keys(SOURCE_LABELS) as ActivitySource[]).map((source) => (
                <DropdownMenuCheckboxItem
                  key={source}
                  checked={sourceFilter === source}
                  onCheckedChange={() => setSourceFilter(source)}
                >
                  {SOURCE_LABELS[source]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Last 7 Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalActivities}</div>
              <p className="text-xs text-muted-foreground">activities</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tool Calls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byType.tool_call || 0}</div>
              <p className="text-xs text-muted-foreground">executions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Scheduled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.bySource.cron || 0}</div>
              <p className="text-xs text-muted-foreground">from cron jobs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Errors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", stats.errorCount > 0 && "text-red-500")}>
                {stats.errorCount}
              </div>
              <p className="text-xs text-muted-foreground">failures</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Activity List */}
      {activities.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No activity yet</h3>
            <p className="text-muted-foreground text-sm text-center">
              Agent actions, tool calls, and scheduled jobs will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => (
            <Collapsible
              key={activity.id}
              open={expandedIds.has(activity.id)}
              onOpenChange={() => toggleExpanded(activity.id)}
            >
              <Card className={cn(
                "transition-colors",
                activity.status === "failed" && "border-red-500/30",
                (activity.conversationId || activity.taskId || activity.projectId) && "cursor-pointer hover:bg-muted/50"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted",
                      ACTIVITY_COLORS[activity.activityType]
                    )}>
                      {ACTIVITY_ICONS[activity.activityType]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span 
                              className={cn(
                                "font-medium",
                                (activity.conversationId || activity.taskId || activity.projectId) && "hover:underline"
                              )}
                              onClick={() => handleActivityClick(activity)}
                            >
                              {activity.title}
                            </span>
                            <Badge 
                              variant="secondary" 
                              className={cn("text-xs", SOURCE_COLORS[activity.source])}
                            >
                              {SOURCE_LABELS[activity.source]}
                            </Badge>
                            {getStatusIcon(activity.status)}
                            {activity.durationMs && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Timer className="h-3 w-3" />
                                {formatDuration(activity.durationMs)}
                              </span>
                            )}
                          </div>
                          {activity.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                              {activity.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(activity.createdAt)}
                          </span>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              {expandedIds.has(activity.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                    </div>
                  </div>

                  <CollapsibleContent>
                    {Object.keys(activity.metadata).length > 0 && (
                      <div className="mt-4 ml-12 p-3 bg-muted rounded-md">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Details</p>
                        <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all">
                          {JSON.stringify(activity.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="mt-3 ml-12 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>ID: {activity.id.slice(0, 8)}...</span>
                      <span>{new Date(activity.createdAt).toLocaleString()}</span>
                      {activity.conversationId && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => router.push(`/?conversation=${activity.conversationId}`)}
                        >
                          View Conversation
                        </Button>
                      )}
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          ))}

          {/* Load More */}
          {activities.length < total && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  `Load More (${total - activities.length} remaining)`
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
