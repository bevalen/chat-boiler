/**
 * Activity item component
 */

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityLogEntry } from "@/lib/db/activity-log";
import { ACTIVITY_ICONS, ACTIVITY_COLORS, SOURCE_LABELS, SOURCE_COLORS } from "@/lib/activity/activity-constants";
import { formatActivityTimeAgo, formatActivityDuration, getActivityStatusIcon, Timer } from "@/lib/activity/activity-utils";

interface ActivityItemProps {
  activity: ActivityLogEntry;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

export function ActivityItem({
  activity,
  isExpanded,
  onToggleExpanded,
}: ActivityItemProps) {
  const router = useRouter();

  const handleClick = () => {
    if (activity.conversationId) {
      router.push(`/?conversation=${activity.conversationId}`);
    } else if (activity.taskId) {
      router.push("/tasks");
    } else if (activity.projectId) {
      router.push(`/projects/${activity.projectId}`);
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpanded}>
      <Card
        className={cn(
          "transition-colors",
          activity.status === "failed" && "border-red-500/30",
          (activity.conversationId || activity.taskId || activity.projectId) &&
            "cursor-pointer hover:bg-muted/50"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted",
                ACTIVITY_COLORS[activity.activityType]
              )}
            >
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
                        (activity.conversationId || activity.taskId || activity.projectId) &&
                          "hover:underline"
                      )}
                      onClick={handleClick}
                    >
                      {activity.title}
                    </span>
                    <Badge variant="secondary" className={cn("text-xs", SOURCE_COLORS[activity.source])}>
                      {SOURCE_LABELS[activity.source]}
                    </Badge>
                    {getActivityStatusIcon(activity.status)}
                    {activity.durationMs && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        {formatActivityDuration(activity.durationMs)}
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
                    {formatActivityTimeAgo(activity.createdAt)}
                  </span>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      {isExpanded ? (
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
  );
}
