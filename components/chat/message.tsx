"use client";

import { type MiloUIMessage } from "@/lib/agents/milo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  ListTodo,
  FolderKanban,
  Mail,
  Calendar,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface MessageProps {
  message: MiloUIMessage;
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 py-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar className={cn("h-8 w-8", isUser ? "bg-primary" : "bg-chart-1")}>
        <AvatarFallback className="text-xs font-medium">
          {isUser ? "BV" : "M"}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "flex flex-col gap-2 max-w-[80%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <span className="text-xs text-muted-foreground">
          {isUser ? "You" : "Milo"}
        </span>

        {message.parts.map((part, index) => {
          switch (part.type) {
            case "text":
              return (
                <Card
                  key={index}
                  className={cn(
                    "max-w-full",
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-card"
                  )}
                >
                  <CardContent className="p-3">
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{part.text}</ReactMarkdown>
                    </div>
                  </CardContent>
                </Card>
              );

            case "tool-createProject":
            case "tool-listProjects":
            case "tool-updateProject":
              return (
                <ToolCard
                  key={index}
                  icon={<FolderKanban className="h-4 w-4" />}
                  label="Project"
                  state={part.state}
                />
              );

            case "tool-createTask":
            case "tool-listTasks":
            case "tool-updateTask":
              return (
                <ToolCard
                  key={index}
                  icon={<ListTodo className="h-4 w-4" />}
                  label="Task"
                  state={part.state}
                />
              );

            case "tool-completeTask":
              return (
                <ToolCard
                  key={index}
                  icon={<CheckCircle className="h-4 w-4" />}
                  label="Complete Task"
                  state={part.state}
                />
              );

            case "tool-checkEmail":
            case "tool-sendEmail":
              return (
                <ToolCard
                  key={index}
                  icon={<Mail className="h-4 w-4" />}
                  label="Email"
                  state={part.state}
                />
              );

            case "tool-checkCalendar":
              return (
                <ToolCard
                  key={index}
                  icon={<Calendar className="h-4 w-4" />}
                  label="Calendar"
                  state={part.state}
                />
              );

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}

interface ToolCardProps {
  icon: React.ReactNode;
  label: string;
  state: string;
}

function ToolCard({ icon, label, state }: ToolCardProps) {
  const isLoading = state !== "output-available";
  const isSuccess = state === "output-available";

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
        "bg-muted/50 border border-border",
        isLoading && "animate-pulse"
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <span className={isSuccess ? "text-green-500" : "text-muted-foreground"}>
          {icon}
        </span>
      )}
      <span className="text-muted-foreground">
        {isLoading ? `Checking ${label.toLowerCase()}...` : label}
      </span>
      {isSuccess && (
        <CheckCircle className="h-3 w-3 text-green-500" />
      )}
    </div>
  );
}
