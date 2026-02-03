/**
 * Activity constants (icons, colors, labels)
 */

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
} from "lucide-react";
import type { ActivityType, ActivitySource } from "@/lib/db/activity-log";

export const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
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

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
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

export const SOURCE_LABELS: Record<ActivitySource, string> = {
  chat: "Chat",
  cron: "Scheduled",
  webhook: "Webhook",
  email: "Email",
  system: "System",
};

export const SOURCE_COLORS: Record<ActivitySource, string> = {
  chat: "bg-blue-500/10 text-blue-500",
  cron: "bg-purple-500/10 text-purple-500",
  webhook: "bg-teal-500/10 text-teal-500",
  email: "bg-green-500/10 text-green-500",
  system: "bg-gray-500/10 text-gray-500",
};
