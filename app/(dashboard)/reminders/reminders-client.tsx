"use client";

import { useState } from "react";
import {
  Bell,
  Plus,
  Clock,
  Trash2,
  MoreHorizontal,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type ScheduledJob = {
  id: string;
  agent_id: string;
  job_type: "reminder" | "follow_up" | "recurring" | "one_time";
  title: string;
  description: string | null;
  schedule_type: "once" | "cron";
  run_at: string | null;
  next_run_at: string | null;
  status: "active" | "paused" | "completed" | "cancelled";
  created_at: string | null;
};

interface RemindersClientProps {
  initialReminders: ScheduledJob[];
  agentId: string;
}

export function RemindersClient({
  initialReminders,
  agentId,
}: RemindersClientProps) {
  const [reminders, setReminders] = useState<ScheduledJob[]>(initialReminders);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [reminderToDelete, setReminderToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newReminder, setNewReminder] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
  });

  const handleCreate = async () => {
    if (!newReminder.title.trim() || !newReminder.date) return;
    setIsLoading(true);

    const datetime = newReminder.time
      ? `${newReminder.date}T${newReminder.time}`
      : `${newReminder.date}T09:00`;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("scheduled_jobs")
      .insert({
        agent_id: agentId,
        job_type: "reminder",
        title: newReminder.title,
        description: newReminder.description || null,
        schedule_type: "once",
        run_at: datetime,
        next_run_at: datetime,
        timezone: "America/New_York",
        action_type: "notify",
        action_payload: {},
        cancel_conditions: {},
        status: "active",
      })
      .select()
      .single();

    if (!error && data) {
      setReminders([data as ScheduledJob, ...reminders]);
      setNewReminder({ title: "", description: "", date: "", time: "" });
      setIsCreateOpen(false);
    }
    setIsLoading(false);
  };

  const handleComplete = async (id: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("scheduled_jobs")
      .update({ status: "completed" })
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      setReminders(
        reminders.map((r) => (r.id === id ? (data as ScheduledJob) : r))
      );
    }
  };

  const handleDismiss = async (id: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("scheduled_jobs")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      setReminders(
        reminders.map((r) => (r.id === id ? (data as ScheduledJob) : r))
      );
    }
  };

  const handleDeleteClick = (id: string) => {
    setReminderToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!reminderToDelete) return;
    setIsLoading(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("scheduled_jobs")
      .delete()
      .eq("id", reminderToDelete);

    if (!error) {
      setReminders(reminders.filter((r) => r.id !== reminderToDelete));
      setReminderToDelete(null);
      setIsDeleteDialogOpen(false);
    }
    setIsLoading(false);
  };

  const activeReminders = reminders.filter((r) => r.status === "active");
  const pastReminders = reminders.filter((r) => r.status !== "active");

  const formatDateTime = (datetime: string | null) => {
    if (!datetime) return "No date set";
    const date = new Date(datetime);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    if (isToday) return `Today at ${timeStr}`;
    if (isTomorrow) return `Tomorrow at ${timeStr}`;
    return `${date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} at ${timeStr}`;
  };

  const isOverdue = (datetime: string | null) => {
    if (!datetime) return false;
    return new Date(datetime) < new Date();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Reminders</h1>
          <p className="text-muted-foreground">
            {activeReminders.length} upcoming reminders
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Reminder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Reminder</DialogTitle>
              <DialogDescription>
                Set a reminder for a specific date and time.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newReminder.title}
                  onChange={(e) =>
                    setNewReminder({ ...newReminder, title: e.target.value })
                  }
                  placeholder="What do you want to be reminded about?"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Notes (optional)</Label>
                <Textarea
                  id="description"
                  value={newReminder.description}
                  onChange={(e) =>
                    setNewReminder({
                      ...newReminder,
                      description: e.target.value,
                    })
                  }
                  placeholder="Additional details"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newReminder.date}
                    onChange={(e) =>
                      setNewReminder({ ...newReminder, date: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={newReminder.time}
                    onChange={(e) =>
                      setNewReminder({ ...newReminder, time: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Reminder"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {activeReminders.length === 0 && pastReminders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No reminders</h3>
            <p className="text-muted-foreground text-sm mb-4 text-center">
              Create a reminder or ask Milo to remind you about something.
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Reminder
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active reminders */}
          {activeReminders.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">
                Upcoming
              </h2>
              <div className="space-y-2">
                {activeReminders.map((reminder) => (
                  <Card
                    key={reminder.id}
                    className={cn(
                      "group",
                      isOverdue(reminder.next_run_at) && "border-red-500/50"
                    )}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                          isOverdue(reminder.next_run_at)
                            ? "bg-red-500/10"
                            : "bg-chart-1/10"
                        )}
                      >
                        <Bell
                          className={cn(
                            "h-5 w-5",
                            isOverdue(reminder.next_run_at)
                              ? "text-red-500"
                              : "text-chart-1"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{reminder.title}</p>
                        {reminder.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {reminder.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span
                            className={cn(
                              isOverdue(reminder.next_run_at) && "text-red-500"
                            )}
                          >
                            {formatDateTime(reminder.next_run_at)}
                            {isOverdue(reminder.next_run_at) && " (overdue)"}
                          </span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleComplete(reminder.id)}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Mark Complete
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDismiss(reminder.id)}
                          >
                            Dismiss
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteClick(reminder.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Past reminders */}
          {pastReminders.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">
                Past
              </h2>
              <div className="space-y-2">
                {pastReminders.map((reminder) => (
                  <Card key={reminder.id} className="group opacity-60">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Bell className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium line-through">
                          {reminder.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {reminder.status}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteClick(reminder.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete reminder?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              reminder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isLoading}
            >
              {isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
