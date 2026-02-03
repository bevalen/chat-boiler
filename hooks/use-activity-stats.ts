/**
 * Hook for calculating activity statistics
 */

import { useMemo } from "react";
import type { ActivityLogEntry } from "@/lib/db/activity-log";

export interface ActivityStats {
  totalActivities: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  errorCount: number;
}

export function useActivityStats(activities: ActivityLogEntry[]): ActivityStats {
  return useMemo(() => {
    const stats: ActivityStats = {
      totalActivities: activities.length,
      byType: {},
      bySource: {},
      errorCount: 0,
    };

    activities.forEach((activity) => {
      // Count by type
      stats.byType[activity.activityType] = (stats.byType[activity.activityType] || 0) + 1;

      // Count by source
      stats.bySource[activity.source] = (stats.bySource[activity.source] || 0) + 1;

      // Count errors
      if (activity.status === "failed" || activity.activityType === "error") {
        stats.errorCount++;
      }
    });

    return stats;
  }, [activities]);
}
