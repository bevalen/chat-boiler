/**
 * Email list view component
 */

import { useState } from "react";
import { Inbox, Send, RefreshCw, MailOpen, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/types/database";
import { formatEmailTime, getEmailPreview, groupEmailsByThread, getThreadParticipants, getThreadCount, hasUnreadInThread } from "@/lib/email/email-utils";
import type { DirectionFilter } from "@/hooks/use-email-filters";

type Email = Database["public"]["Tables"]["emails"]["Row"];

interface EmailListProps {
  emails: Email[];
  directionFilter: DirectionFilter;
  unreadCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  onDirectionChange: (direction: DirectionFilter) => void;
  onRefresh: () => void;
  onEmailClick: (email: Email) => void;
}

// Loading skeleton for email list
function EmailListSkeleton() {
  return (
    <div className="divide-y rounded-lg overflow-hidden border sm:border-0">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-3 sm:py-2">
          <Skeleton className="h-4 w-4 rounded shrink-0 hidden sm:block" />
          <div className="flex-1 min-w-0 flex flex-col gap-1 sm:hidden">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 flex-1 max-w-[150px]" />
              <Skeleton className="h-4 w-14 shrink-0" />
            </div>
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="hidden sm:flex sm:items-center sm:gap-3 sm:flex-1 sm:min-w-0">
            <Skeleton className="h-4 w-44 shrink-0" />
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 flex-1 max-w-[200px]" />
            </div>
            <Skeleton className="h-4 w-14 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmailList({
  emails,
  directionFilter,
  unreadCount,
  isLoading,
  isRefreshing,
  onDirectionChange,
  onRefresh,
  onEmailClick,
}: EmailListProps) {
  const threadGroups = groupEmailsByThread(emails);
  const filteredEmails = threadGroups.filter((email) => {
    const threadId = email.thread_id || email.id;
    const threadEmails = emails.filter((e) => (e.thread_id || e.id) === threadId);
    return threadEmails.some((e) => e.direction === directionFilter);
  });

  return (
    <div className="flex flex-col h-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 border-b">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1">
          <Button
            variant={directionFilter === "inbound" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => onDirectionChange("inbound")}
          >
            <Inbox className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Inbox</span>
            {unreadCount > 0 && (
              <span className="ml-1 sm:ml-1.5 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full">
                {unreadCount}
              </span>
            )}
          </Button>
          <Button
            variant={directionFilter === "outbound" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => onDirectionChange("outbound")}
          >
            <Send className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Sent</span>
          </Button>
        </div>

        {/* Keyboard hint */}
        <span className="text-[10px] text-muted-foreground hidden sm:flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">Tab</kbd>
          to switch
        </span>

        <div className="flex-1" />

        {/* Refresh */}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      {/* Email List */}
      <ScrollArea className="flex-1">
        <div className="p-2 sm:p-0">
          {isLoading ? (
            <EmailListSkeleton />
          ) : filteredEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MailOpen className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">
                {directionFilter === "inbound" ? "No emails in inbox" : "No sent emails"}
              </p>
            </div>
          ) : (
            <div className="divide-y rounded-lg overflow-hidden border sm:border-0">
              {filteredEmails.map((email) => {
                const threadId = email.thread_id || email.id;
                const threadCount = getThreadCount(emails, threadId);
                const participants = getThreadParticipants(emails, threadId);
                const isUnread = hasUnreadInThread(emails, threadId);

                return (
                  <div
                    key={email.id}
                    className={cn(
                      "flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-3 sm:py-2 cursor-pointer transition-colors hover:bg-muted/50 max-w-full overflow-hidden",
                      isUnread && "bg-muted/30"
                    )}
                    onClick={() => onEmailClick(email)}
                  >
                    {/* Checkbox - hidden on mobile */}
                    <Checkbox
                      className="shrink-0 opacity-0 group-hover:opacity-100 hidden sm:block"
                      onClick={(e) => e.stopPropagation()}
                    />

                    {/* Mobile: Stack layout */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1 sm:hidden max-w-full">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {email.processed_by_agent && (
                            <Bot
                              className="h-3.5 w-3.5 shrink-0 text-primary"
                              aria-label="Processed by Maia"
                            />
                          )}
                          <span className={cn("text-sm truncate", isUnread && "font-semibold")}>
                            {participants}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "text-xs shrink-0",
                            isUnread ? "font-medium text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {formatEmailTime(email.created_at)}
                        </span>
                      </div>
                      <span className={cn("text-sm truncate", isUnread ? "font-medium" : "text-foreground")}>
                        {email.subject || "(No subject)"}
                      </span>
                    </div>

                    {/* Desktop: Horizontal layout */}
                    <div className="hidden sm:flex sm:items-center sm:gap-3 sm:flex-1 sm:min-w-0">
                      {/* Sender/Participants */}
                      <div className="w-44 shrink-0 flex items-center gap-1.5 min-w-0">
                        {email.processed_by_agent && (
                          <Bot
                            className="h-3.5 w-3.5 shrink-0 text-primary"
                            aria-label="Processed by Maia"
                          />
                        )}
                        <div className="truncate">
                          <span className={cn("text-sm", isUnread && "font-semibold")}>
                            {participants}
                          </span>
                          {threadCount > 1 && (
                            <span className="ml-1 text-xs text-muted-foreground">{threadCount}</span>
                          )}
                        </div>
                      </div>

                      {/* Subject and Preview */}
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className={cn("text-sm truncate", isUnread ? "font-medium" : "text-foreground")}>
                          {email.subject || "(No subject)"}
                        </span>
                        <span className="text-sm text-muted-foreground truncate">
                          — {getEmailPreview(email)}
                        </span>
                      </div>

                      {/* Date */}
                      <span
                        className={cn(
                          "text-xs shrink-0",
                          isUnread ? "font-medium text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {formatEmailTime(email.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
