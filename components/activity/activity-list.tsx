/**
 * Activity list component
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Loader2 } from "lucide-react";
import type { ActivityLogEntry } from "@/lib/db/activity-log";
import { ActivityItem } from "./activity-item";

interface ActivityListProps {
  activities: ActivityLogEntry[];
  total: number;
  isLoading: boolean;
  onLoadMore: () => void;
}

export function ActivityList({ activities, total, isLoading, onLoadMore }: ActivityListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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

  if (activities.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Activity className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">No activity yet</h3>
          <p className="text-muted-foreground text-sm text-center">
            Agent actions, tool calls, and scheduled jobs will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {activities.map((activity) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            isExpanded={expandedIds.has(activity.id)}
            onToggleExpanded={() => toggleExpanded(activity.id)}
          />
        ))}
      </div>

      {/* Load More */}
      {activities.length < total && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
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
    </>
  );
}
