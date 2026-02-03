/**
 * Email thread view component
 */

import { useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Paperclip, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/types/database";
import { formatEmailTime, formatEmailFullDate, cleanEmailHtml } from "@/lib/email/email-utils";

type Email = Database["public"]["Tables"]["emails"]["Row"];
type EmailAttachment = Database["public"]["Tables"]["email_attachments"]["Row"];

interface EmailThreadProps {
  thread: Email[];
  attachments: Map<string, EmailAttachment[]>;
  isLoading: boolean;
  onBack: () => void;
}

// Loading skeleton for thread view
function ThreadSkeleton() {
  return (
    <div className="max-w-4xl mx-auto py-4 px-2 sm:px-4 space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i}>
          <div className="flex items-center gap-3 px-2 sm:px-4 py-3 rounded-lg">
            <Skeleton className="h-4 w-4 shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col gap-1 sm:hidden">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 flex-1 max-w-[120px]" />
                <Skeleton className="h-4 w-12 shrink-0" />
              </div>
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="hidden sm:flex sm:items-center sm:gap-3 sm:flex-1 sm:min-w-0">
              <Skeleton className="h-4 w-40 shrink-0" />
              <Skeleton className="h-4 flex-1 max-w-[300px]" />
              <Skeleton className="h-4 w-44 shrink-0" />
            </div>
          </div>
          {i === 2 && (
            <div className="ml-5 sm:ml-11 mr-1 sm:mr-4 mt-2 mb-4 space-y-3 overflow-hidden">
              <div className="space-y-2">
                <div>
                  <Skeleton className="h-3 w-12 mb-1" />
                  <Skeleton className="h-3 w-full max-w-[250px]" />
                </div>
                <div>
                  <Skeleton className="h-3 w-8 mb-1" />
                  <Skeleton className="h-3 w-full max-w-[180px]" />
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-10/12" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          )}
          {i < 2 && <Separator className="my-2" />}
        </div>
      ))}
    </div>
  );
}

export function EmailThread({ thread, attachments, isLoading, onBack }: EmailThreadProps) {
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(
    new Set([thread[thread.length - 1]?.id])
  );

  const toggleEmailExpanded = (emailId: string) => {
    setExpandedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  };

  const threadSubject = thread[0]?.subject || "(No subject)";

  return (
    <div className="flex flex-col h-full overflow-x-hidden">
      {/* Thread Header */}
      <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {isLoading ? (
          <Skeleton className="h-5 flex-1 max-w-64" />
        ) : (
          <h1 className="text-base sm:text-lg font-medium truncate flex-1">{threadSubject}</h1>
        )}
      </div>

      {/* Thread Messages */}
      <ScrollArea className="flex-1 overflow-x-hidden">
        {isLoading ? (
          <ThreadSkeleton />
        ) : (
          <div className="max-w-4xl mx-auto py-4 px-2 sm:px-4 overflow-x-hidden w-full">
            {thread.map((email, index) => {
              const isExpanded = expandedEmails.has(email.id);
              const emailAttachments = attachments.get(email.id) || [];

              return (
                <div key={email.id} className="mb-2 overflow-hidden">
                  {/* Collapsed Email Header */}
                  <div
                    className={cn(
                      "flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-3 rounded-lg cursor-pointer transition-colors overflow-hidden",
                      isExpanded ? "bg-muted/50" : "hover:bg-muted/30"
                    )}
                    onClick={() => toggleEmailExpanded(email.id)}
                  >
                    {/* Expand/Collapse Icon */}
                    <div className="shrink-0 text-muted-foreground">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>

                    {/* Mobile: Stack layout */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1 sm:hidden max-w-full">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {email.processed_by_agent && email.direction === "inbound" && (
                            <Bot
                              className="h-3 w-3 shrink-0 text-primary"
                              aria-label="Processed by Maia"
                            />
                          )}
                          <span
                            className={cn(
                              "text-sm truncate",
                              !email.is_read && email.direction === "inbound" && "font-semibold"
                            )}
                          >
                            {email.direction === "outbound"
                              ? "Maia"
                              : email.from_name || email.from_address?.split("@")[0] || "Unknown"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatEmailTime(
                            email.direction === "inbound" ? email.received_at : email.sent_at
                          )}
                        </span>
                      </div>
                      {!isExpanded && (
                        <span className="text-xs text-muted-foreground truncate">
                          {email.text_body?.substring(0, 50) || email.html_body?.replace(/<[^>]*>/g, "").substring(0, 50) || ""}
                        </span>
                      )}
                      {isExpanded && email.direction === "outbound" && email.to_addresses && email.to_addresses.length > 0 && (
                        <span className="text-xs text-muted-foreground truncate">
                          to {email.to_addresses[0]}
                        </span>
                      )}
                    </div>

                    {/* Desktop: Horizontal layout */}
                    <div className="hidden sm:flex sm:items-center sm:gap-3 sm:flex-1 sm:min-w-0">
                      {/* Sender */}
                      <div className="w-40 shrink-0 flex items-center gap-1.5">
                        {email.processed_by_agent && email.direction === "inbound" && (
                          <Bot
                            className="h-3.5 w-3.5 shrink-0 text-primary"
                            aria-label="Processed by Maia"
                          />
                        )}
                        <span
                          className={cn(
                            "text-sm truncate",
                            !email.is_read && email.direction === "inbound" && "font-semibold"
                          )}
                        >
                          {email.direction === "outbound" ? "Maia" : email.from_name || email.from_address}
                        </span>
                      </div>

                      {/* Preview or To line */}
                      <div className="flex-1 min-w-0">
                        {!isExpanded && (
                          <span className="text-sm text-muted-foreground truncate block">
                            {email.text_body?.substring(0, 80) || email.html_body?.replace(/<[^>]*>/g, "").substring(0, 80) || ""}
                          </span>
                        )}
                        {isExpanded && email.direction === "outbound" && email.to_addresses && email.to_addresses.length > 0 && (
                          <span className="text-sm text-muted-foreground">to {email.to_addresses[0]}</span>
                        )}
                      </div>

                      {/* Date */}
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatEmailFullDate(
                          email.direction === "inbound" ? email.received_at : email.sent_at
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Email Content */}
                  {isExpanded && (
                    <div
                      className="ml-5 sm:ml-11 mr-1 sm:mr-4 mt-2 mb-4 overflow-hidden"
                      style={{ maxWidth: "calc(100% - 1.5rem)" }}
                    >
                      {/* Headers */}
                      <div className="text-xs text-muted-foreground mb-4 space-y-2 overflow-hidden">
                        <div className="overflow-hidden">
                          <span className="font-medium block mb-0.5">From:</span>
                          <span className="text-foreground break-all block overflow-hidden">
                            {email.from_name
                              ? `${email.from_name} <${email.from_address}>`
                              : email.from_address}
                          </span>
                        </div>
                        <div className="overflow-hidden">
                          <span className="font-medium block mb-0.5">To:</span>
                          <span className="text-foreground break-all block overflow-hidden">
                            {email.to_addresses && email.to_addresses.length > 0
                              ? email.to_addresses.join(", ")
                              : "Unknown"}
                          </span>
                        </div>
                        {email.cc_addresses && email.cc_addresses.length > 0 && (
                          <div className="overflow-hidden">
                            <span className="font-medium block mb-0.5">Cc:</span>
                            <span className="text-foreground break-all block overflow-hidden">
                              {email.cc_addresses.join(", ")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Attachments */}
                      {emailAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {emailAttachments.map((att) => (
                            <a
                              key={att.id}
                              href={att.download_url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={att.filename}
                              onClick={(e) => {
                                if (!att.download_url || !att.is_downloaded) {
                                  e.preventDefault();
                                }
                              }}
                              className={`flex items-center gap-1.5 px-2 py-1 text-xs bg-muted rounded max-w-full ${
                                att.is_downloaded && att.download_url
                                  ? "hover:bg-muted/80 cursor-pointer"
                                  : "opacity-50 cursor-not-allowed"
                              }`}
                              title={
                                att.is_downloaded
                                  ? `Download ${att.filename}`
                                  : "Attachment not yet available"
                              }
                            >
                              <Paperclip className="h-3 w-3 shrink-0" />
                              <span className="truncate">{att.filename}</span>
                              {att.size_bytes && (
                                <span className="text-[10px] text-muted-foreground">
                                  ({(att.size_bytes / 1024).toFixed(1)}KB)
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Body */}
                      <div className="text-sm email-body-content overflow-hidden">
                        {email.html_body ? (
                          <div
                            className="overflow-hidden"
                            style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
                            dangerouslySetInnerHTML={{
                              __html:
                                typeof window !== "undefined"
                                  ? cleanEmailHtml(email.html_body)
                                  : email.html_body,
                            }}
                          />
                        ) : (
                          <pre
                            className="whitespace-pre-wrap font-sans overflow-hidden"
                            style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
                          >
                            {email.text_body || "No content"}
                          </pre>
                        )}
                      </div>
                    </div>
                  )}

                  {thread && index < thread.length - 1 && <Separator className="my-2" />}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Styles for email content */}
      <style jsx global>{`
        .email-body-content {
          line-height: 1.5;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          word-break: break-word !important;
          max-width: 100% !important;
          overflow: hidden !important;
        }
        .email-body-content * {
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          word-break: break-word !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        .email-body-content img {
          max-width: 150px !important;
          height: auto !important;
        }
        @media (max-width: 640px) {
          .email-body-content img {
            max-width: 100px !important;
          }
        }
        .email-body-content table {
          max-width: 100% !important;
          width: auto !important;
          font-size: 13px;
          display: block !important;
          overflow-x: auto;
        }
        .email-body-content table img {
          max-width: 120px !important;
        }
        @media (max-width: 640px) {
          .email-body-content table {
            font-size: 11px;
          }
          .email-body-content table img {
            max-width: 80px !important;
          }
        }
        .email-body-content a {
          color: hsl(var(--primary));
          word-break: break-all !important;
          overflow-wrap: break-word !important;
        }
        .email-body-content hr {
          margin: 16px 0;
          border-color: hsl(var(--border));
          opacity: 0.5;
        }
        .email-body-content table[width="100%"],
        .email-body-content table[style*="width: 100%"],
        .email-body-content table[style*="width:100%"] {
          max-width: 400px !important;
          font-size: 12px;
        }
        @media (max-width: 640px) {
          .email-body-content table[width="100%"],
          .email-body-content table[style*="width: 100%"],
          .email-body-content table[style*="width:100%"] {
            max-width: 100% !important;
            font-size: 10px;
          }
        }
        .email-body-content table td {
          padding: 2px 4px !important;
          word-break: break-word !important;
        }
        .email-body-content table br {
          display: none;
        }
        .email-body-content p:empty,
        .email-body-content div:empty {
          display: none;
        }
        .email-body-content p {
          margin: 0 0 8px 0;
          word-break: break-word !important;
        }
        .email-body-content div,
        .email-body-content span {
          word-break: break-word !important;
          overflow-wrap: break-word !important;
        }
      `}</style>
    </div>
  );
}
