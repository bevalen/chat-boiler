/**
 * Project detail activity sidebar component
 */

import { Activity, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ActivityItem } from "@/hooks/use-project-activity";
import type { Assignee } from "@/components/shared/task-dialog";

interface ProjectDetailActivityProps {
  activityItems: ActivityItem[];
  newComment: string;
  onCommentChange: (comment: string) => void;
  onAddComment: () => void;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  agentName: string;
  agentAvatarUrl?: string | null;
  userName: string;
  userAvatarUrl?: string | null;
}

export function ProjectDetailActivity({
  activityItems,
  newComment,
  onCommentChange,
  onAddComment,
  scrollAreaRef,
  agentName,
  agentAvatarUrl,
  userName,
  userAvatarUrl,
}: ProjectDetailActivityProps) {
  return (
    <div className="w-[350px] border-l bg-muted/10 flex flex-col h-full min-h-0">
      <div className="p-4 border-b bg-background/50 backdrop-blur shrink-0">
        <h3 className="font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Project Activity
        </h3>
      </div>

      <ScrollArea className="flex-1 min-h-0 p-4" ref={scrollAreaRef}>
        <div className="space-y-6 pb-4">
          {activityItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No activity recorded yet.
            </div>
          ) : (
            activityItems.map((item, i) => (
              <div key={i} className="flex gap-3">
                <div className="mt-0.5 shrink-0">
                  {item.type === "comment" ? (
                    <Avatar className="h-8 w-8 border">
                      {item.author_type === "agent" && agentAvatarUrl ? (
                        <AvatarImage src={agentAvatarUrl} alt={agentName} />
                      ) : item.author_type === "user" && userAvatarUrl ? (
                        <AvatarImage src={userAvatarUrl} alt={userName} />
                      ) : null}
                      <AvatarFallback
                        className={cn(
                          "text-xs",
                          item.author_type === "agent"
                            ? "bg-purple-100 text-purple-600"
                            : "bg-blue-100 text-blue-600"
                        )}
                      >
                        {item.author_type === "agent"
                          ? agentName.charAt(0).toUpperCase()
                          : userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center border">
                      <Activity className="h-4 w-4 text-slate-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {item.type === "comment"
                        ? item.author_type === "user"
                          ? userName
                          : agentName
                        : item.source || "System"}
                    </span>
                    <span>•</span>
                    <span>
                      {formatDistanceToNow(new Date(item.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>

                  {item.type === "comment" ? (
                    <div className="text-sm bg-background border rounded-r-lg rounded-bl-lg p-3 shadow-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-strong:font-semibold">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {item.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      <p>{item.content}</p>
                      {item.description && (
                        <div className="text-xs mt-1 bg-muted/50 p-1.5 rounded text-muted-foreground/80 prose prose-xs dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {item.description}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-4 bg-background border-t shrink-0">
        <div className="relative">
          <Input
            value={newComment}
            onChange={(e) => onCommentChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onAddComment();
              }
            }}
            placeholder="Add a comment..."
            className="pr-10"
          />
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-primary"
            onClick={onAddComment}
            disabled={!newComment.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
