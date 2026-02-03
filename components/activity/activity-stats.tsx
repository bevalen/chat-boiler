/**
 * Activity stats cards component
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ActivityStats } from "@/hooks/use-activity-stats";

interface ActivityStatsProps {
  stats: ActivityStats;
}

export function ActivityStats({ stats }: ActivityStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalActivities}</div>
          <p className="text-xs text-muted-foreground">activities</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Tool Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.byType.tool_call || 0}</div>
          <p className="text-xs text-muted-foreground">executions</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Scheduled</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.bySource.cron || 0}</div>
          <p className="text-xs text-muted-foreground">from cron jobs</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Errors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("text-2xl font-bold", stats.errorCount > 0 && "text-red-500")}>
            {stats.errorCount}
          </div>
          <p className="text-xs text-muted-foreground">failures</p>
        </CardContent>
      </Card>
    </div>
  );
}
