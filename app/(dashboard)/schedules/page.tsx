import { Clock, CalendarClock, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// For MVP, these are hard-coded. In the future, they would come from pg_cron
const schedules = [
  {
    id: "daily-brief",
    name: "Daily Brief",
    description: "Morning summary of calendar, projects, and tasks",
    schedule: "0 13 * * *",
    scheduleHuman: "Every day at 8:00 AM EST",
    status: "active",
    lastRun: null,
    nextRun: "Tomorrow 8:00 AM",
  },
];

export default function SchedulesPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Schedules</h1>
          <p className="text-muted-foreground">
            Automated tasks that run on a schedule
          </p>
        </div>
      </div>

      {/* Info banner */}
      <Card className="mb-6 bg-muted/50">
        <CardContent className="flex items-center gap-3 p-4">
          <Info className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Schedules are automated tasks powered by pg_cron. In the future, Milo
            will be able to create custom schedules based on your requests.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {schedules.map((schedule) => (
          <Card key={schedule.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-1/20">
                    <CalendarClock className="h-5 w-5 text-chart-1" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{schedule.name}</CardTitle>
                    <CardDescription>{schedule.description}</CardDescription>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    schedule.status === "active"
                      ? "bg-green-500/10 text-green-500 border-green-500/20"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {schedule.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Schedule:</span>
                  <p className="font-medium">{schedule.scheduleHuman}</p>
                  <code className="text-xs text-muted-foreground">
                    {schedule.schedule}
                  </code>
                </div>
                <div>
                  <span className="text-muted-foreground">Next run:</span>
                  <p className="font-medium">{schedule.nextRun || "Not scheduled"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Coming soon card */}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">More schedules coming soon</h3>
            <p className="text-muted-foreground text-sm text-center max-w-md">
              Ask Milo to create custom schedules like &ldquo;Remind me to check emails
              every afternoon&rdquo; or &ldquo;Send a weekly project summary every Friday.&rdquo;
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
