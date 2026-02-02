"use client";

import { useState, useEffect } from "react";
import {
  Inbox,
  Send,
  ArrowLeft,
  Paperclip,
  MailOpen,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Database } from "@/lib/types/database";

type Email = Database["public"]["Tables"]["emails"]["Row"];
type EmailAttachment = Database["public"]["Tables"]["email_attachments"]["Row"];

type DirectionFilter = "inbound" | "outbound";

interface EmailClientProps {
  initialEmails: Email[];
  initialUnreadCount: number;
  agentId: string;
}

// Loading skeleton for email list - matches actual row layout
function EmailListSkeleton() {
  return (
    <div className="divide-y rounded-lg overflow-hidden border sm:border-0">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-3 sm:py-2">
          {/* Checkbox - hidden on mobile */}
          <Skeleton className="h-4 w-4 rounded shrink-0 hidden sm:block" />
          
          {/* Mobile: Stack layout */}
          <div className="flex-1 min-w-0 flex flex-col gap-1 sm:hidden">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 flex-1 max-w-[150px]" />
              <Skeleton className="h-4 w-14 shrink-0" />
            </div>
            <Skeleton className="h-4 w-32" />
          </div>

          {/* Desktop: Horizontal layout */}
          <div className="hidden sm:flex sm:items-center sm:gap-3 sm:flex-1 sm:min-w-0">
            {/* Sender/Participants - w-44 to match */}
            <Skeleton className="h-4 w-44 shrink-0" />
            {/* Subject and preview */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 flex-1 max-w-[200px]" />
            </div>
            {/* Date */}
            <Skeleton className="h-4 w-14 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Loading skeleton for thread view - matches actual thread layout
function ThreadSkeleton() {
  return (
    <div className="max-w-4xl mx-auto py-4 px-2 sm:px-4 space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i}>
          {/* Email header row */}
          <div className="flex items-center gap-3 px-2 sm:px-4 py-3 rounded-lg">
            {/* Chevron */}
            <Skeleton className="h-4 w-4 shrink-0" />
            
            {/* Mobile: Stack layout */}
            <div className="flex-1 min-w-0 flex flex-col gap-1 sm:hidden">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 flex-1 max-w-[120px]" />
                <Skeleton className="h-4 w-12 shrink-0" />
              </div>
              <Skeleton className="h-3 w-32" />
            </div>

            {/* Desktop: Horizontal layout */}
            <div className="hidden sm:flex sm:items-center sm:gap-3 sm:flex-1 sm:min-w-0">
              {/* Sender - w-40 to match */}
              <Skeleton className="h-4 w-40 shrink-0" />
              {/* Preview */}
              <Skeleton className="h-4 flex-1 max-w-[300px]" />
              {/* Date */}
              <Skeleton className="h-4 w-44 shrink-0" />
            </div>
          </div>
          {/* Expanded content for last item */}
          {i === 2 && (
            <div className="ml-7 sm:ml-11 mr-2 sm:mr-4 mt-2 mb-4 space-y-3">
              {/* Headers */}
              <div className="space-y-1">
                <Skeleton className="h-3 w-full max-w-[280px]" />
                <Skeleton className="h-3 w-full max-w-[220px]" />
              </div>
              {/* Body */}
              <div className="space-y-2 mt-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          )}
          {i < 2 && <Separator className="my-2" />}
        </div>
      ))}
    </div>
  );
}

export function EmailClient({
  initialEmails,
  initialUnreadCount,
  agentId,
}: EmailClientProps) {
  const supabase = createClient();
  const [emails, setEmails] = useState<Email[]>(initialEmails);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("inbound");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Email[] | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [threadAttachments, setThreadAttachments] = useState<Map<string, EmailAttachment[]>>(new Map());
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [isLoadingThread, setIsLoadingThread] = useState(false);

  // Keyboard shortcut: Tab to toggle between Inbox and Sent
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Tab when not in thread view and not in an input
      if (e.key === "Tab" && !selectedThread && !isLoadingThread) {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
        
        if (!isInput) {
          e.preventDefault();
          setDirectionFilter((prev) => prev === "inbound" ? "outbound" : "inbound");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedThread, isLoadingThread]);

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`emails-page:${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "emails",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          const newEmail = payload.new as Email;
          setEmails((prev) => [newEmail, ...prev]);
          if (!newEmail.is_read && newEmail.direction === "inbound") {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "emails",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          const updatedEmail = payload.new as Email;
          const oldEmail = payload.old as Email;
          
          setEmails((prev) =>
            prev.map((e) => (e.id === updatedEmail.id ? updatedEmail : e))
          );
          
          if (oldEmail.is_read !== updatedEmail.is_read && updatedEmail.direction === "inbound") {
            if (updatedEmail.is_read) {
              setUnreadCount((prev) => Math.max(0, prev - 1));
            } else {
              setUnreadCount((prev) => prev + 1);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId, supabase]);

  // Fetch emails
  const fetchEmails = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({
        direction: directionFilter,
        status: "all",
        limit: "100",
        offset: "0",
      });
      
      const res = await fetch(`/api/emails?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails);
      }
    } catch (error) {
      console.error("Error fetching emails:", error);
    }
    setIsRefreshing(false);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchEmails(true);
  }, [directionFilter]);

  // Handle email click - open thread view
  const handleEmailClick = async (email: Email) => {
    setIsLoadingThread(true);
    setSelectedThread(null);
    
    try {
      const res = await fetch(`/api/emails/${email.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedEmail(data.email);
        setSelectedThread(data.thread?.length > 0 ? data.thread : [data.email]);
        
        // Store attachments by email ID
        const attachmentsMap = new Map<string, EmailAttachment[]>();
        if (data.attachments?.length > 0) {
          attachmentsMap.set(email.id, data.attachments);
        }
        setThreadAttachments(attachmentsMap);
        
        // Expand the latest email by default
        const latestEmail = data.thread?.[data.thread.length - 1] || data.email;
        setExpandedEmails(new Set([latestEmail.id]));
        
        // Mark as read
        if (!email.is_read) {
          await fetch(`/api/emails/${email.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_read: true }),
          });
          
          setEmails((prev) =>
            prev.map((e) => (e.id === email.id ? { ...e, is_read: true } : e))
          );
          if (email.direction === "inbound") {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }
      }
    } catch (error) {
      console.error("Error fetching email:", error);
    }
    
    setIsLoadingThread(false);
  };

  // Format time - show time if today, otherwise date
  const formatTime = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    
    const isThisYear = date.getFullYear() === now.getFullYear();
    if (isThisYear) {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
    
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" });
  };

  // Format full date for thread view
  const formatFullDate = (dateString: string | null) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Get preview text
  const getPreview = (email: Email) => {
    const text = email.text_body || email.html_body?.replace(/<[^>]*>/g, "") || "";
    return text.replace(/\s+/g, " ").trim().substring(0, 80);
  };

  // Clean HTML content - strip excessive signature styling
  const cleanEmailHtml = (html: string) => {
    // Create a wrapper to process the HTML
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    
    // Find and simplify signature-like elements
    const signatureSelectors = [
      '[class*="signature"]',
      '[id*="signature"]',
      'table[width="100%"]',
      'table[style*="border-collapse"]',
    ];
    
    // Limit large images in signatures
    wrapper.querySelectorAll("img").forEach((img) => {
      const width = img.getAttribute("width");
      const style = img.getAttribute("style") || "";
      
      // If image is wide, constrain it
      if (width && parseInt(width) > 200) {
        img.setAttribute("width", "150");
        img.removeAttribute("height");
      }
      
      // Add max-width constraint
      img.setAttribute("style", style + "; max-width: 150px; height: auto;");
    });
    
    return wrapper.innerHTML;
  };

  // Group emails by thread for list view (show latest per thread)
  const getThreadGroups = () => {
    const threadMap = new Map<string, Email[]>();
    
    emails.forEach((email) => {
      const threadId = email.thread_id || email.id;
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, []);
      }
      threadMap.get(threadId)!.push(email);
    });
    
    // Return latest email from each thread
    const latestEmails: Email[] = [];
    threadMap.forEach((threadEmails) => {
      threadEmails.sort((a, b) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      latestEmails.push(threadEmails[0]);
    });
    
    // Sort by date
    return latestEmails.sort((a, b) => 
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  };

  // Get participant names for thread
  const getParticipants = (threadId: string) => {
    const threadEmails = emails.filter((e) => (e.thread_id || e.id) === threadId);
    const participants = new Set<string>();
    
    threadEmails.forEach((email) => {
      if (email.direction === "inbound") {
        participants.add(email.from_name?.split(" ")[0] || email.from_address.split("@")[0]);
      }
    });
    
    const hasOutbound = threadEmails.some((e) => e.direction === "outbound");
    if (hasOutbound) {
      participants.add("Maia");
    }
    
    return Array.from(participants).join(", ");
  };

  // Get thread count
  const getThreadCount = (threadId: string) => {
    return emails.filter((e) => (e.thread_id || e.id) === threadId).length;
  };

  // Check if thread has unread
  const hasUnread = (threadId: string) => {
    return emails.some((e) => 
      (e.thread_id || e.id) === threadId && 
      !e.is_read && 
      e.direction === "inbound"
    );
  };

  // Toggle email expansion in thread view
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

  // Filter emails based on direction
  const filteredEmails = getThreadGroups().filter((email) => {
    const threadId = email.thread_id || email.id;
    const threadEmails = emails.filter((e) => (e.thread_id || e.id) === threadId);
    return threadEmails.some((e) => e.direction === directionFilter);
  });

  // Sent count
  const sentCount = emails.filter((e) => e.direction === "outbound").length;

  // Thread View
  if (selectedThread || isLoadingThread) {
    const threadSubject = selectedThread?.[0]?.subject || "(No subject)";
    
    return (
      <div className="flex flex-col h-full overflow-x-hidden">
        {/* Thread Header */}
        <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => {
              setSelectedThread(null);
              setSelectedEmail(null);
              setIsLoadingThread(false);
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {isLoadingThread ? (
            <Skeleton className="h-5 flex-1 max-w-64" />
          ) : (
            <h1 className="text-base sm:text-lg font-medium truncate flex-1">{threadSubject}</h1>
          )}
        </div>

        {/* Thread Messages */}
        <ScrollArea className="flex-1">
          {isLoadingThread ? (
            <ThreadSkeleton />
          ) : (
            <div className="max-w-4xl mx-auto py-4 px-2 sm:px-4 overflow-x-hidden">
              {selectedThread?.map((email, index) => {
                const isExpanded = expandedEmails.has(email.id);
                const attachments = threadAttachments.get(email.id) || [];
                
                return (
                  <div key={email.id} className="mb-2">
                    {/* Collapsed Email Header */}
                    <div
                      className={cn(
                        "flex items-center gap-3 px-2 sm:px-4 py-3 rounded-lg cursor-pointer transition-colors max-w-full overflow-hidden",
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
                          <span className={cn(
                            "text-sm truncate",
                            !email.is_read && email.direction === "inbound" && "font-semibold"
                          )}>
                            {email.direction === "outbound" 
                              ? "Maia" 
                              : email.from_name || email.from_address.split("@")[0]}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatTime(email.direction === "inbound" ? email.received_at : email.sent_at)}
                          </span>
                        </div>
                        {!isExpanded && (
                          <span className="text-xs text-muted-foreground truncate">
                            {getPreview(email)}
                          </span>
                        )}
                        {isExpanded && email.direction === "outbound" && (
                          <span className="text-xs text-muted-foreground truncate">
                            to {email.to_addresses[0]}
                          </span>
                        )}
                      </div>

                      {/* Desktop: Horizontal layout */}
                      <div className="hidden sm:flex sm:items-center sm:gap-3 sm:flex-1 sm:min-w-0">
                        {/* Sender */}
                        <div className="w-40 shrink-0">
                          <span className={cn(
                            "text-sm",
                            !email.is_read && email.direction === "inbound" && "font-semibold"
                          )}>
                            {email.direction === "outbound" 
                              ? "Maia" 
                              : email.from_name || email.from_address}
                          </span>
                        </div>
                        
                        {/* Preview or To line */}
                        <div className="flex-1 min-w-0">
                          {!isExpanded && (
                            <span className="text-sm text-muted-foreground truncate block">
                              {getPreview(email)}
                            </span>
                          )}
                          {isExpanded && email.direction === "outbound" && (
                            <span className="text-sm text-muted-foreground">
                              to {email.to_addresses[0]}
                            </span>
                          )}
                        </div>
                        
                        {/* Date */}
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatFullDate(email.direction === "inbound" ? email.received_at : email.sent_at)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Expanded Email Content */}
                    {isExpanded && (
                      <div className="ml-7 sm:ml-11 mr-2 sm:mr-4 mt-2 mb-4 overflow-x-hidden max-w-full">
                        {/* Headers */}
                        <div className="text-xs text-muted-foreground mb-4 space-y-0.5">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-0 sm:gap-1">
                            <span className="inline-block w-10 shrink-0 font-medium sm:font-normal">From:</span>
                            <span className="text-foreground break-all sm:break-words">
                              {email.from_name ? `${email.from_name} <${email.from_address}>` : email.from_address}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-start gap-0 sm:gap-1">
                            <span className="inline-block w-10 shrink-0 font-medium sm:font-normal">To:</span>
                            <span className="text-foreground break-all sm:break-words">{email.to_addresses.join(", ")}</span>
                          </div>
                          {email.cc_addresses && email.cc_addresses.length > 0 && (
                            <div className="flex flex-col sm:flex-row sm:items-start gap-0 sm:gap-1">
                              <span className="inline-block w-10 shrink-0 font-medium sm:font-normal">Cc:</span>
                              <span className="text-foreground break-all sm:break-words">{email.cc_addresses.join(", ")}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Attachments */}
                        {attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {attachments.map((att) => (
                              <a
                                key={att.id}
                                href={att.download_url || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80 max-w-full"
                              >
                                <Paperclip className="h-3 w-3 shrink-0" />
                                <span className="truncate">{att.filename}</span>
                              </a>
                            ))}
                          </div>
                        )}
                        
                        {/* Body */}
                        <div className="text-sm email-body-content overflow-x-hidden max-w-full">
                          {email.html_body ? (
                            <div
                              className="max-w-full overflow-x-hidden"
                              dangerouslySetInnerHTML={{ 
                                __html: typeof window !== "undefined" 
                                  ? cleanEmailHtml(email.html_body) 
                                  : email.html_body 
                              }}
                            />
                          ) : (
                            <pre className="whitespace-pre-wrap font-sans break-words max-w-full overflow-x-hidden">
                              {email.text_body || "No content"}
                            </pre>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {index < selectedThread.length - 1 && <Separator className="my-2" />}
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
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
            max-width: 100%;
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
            max-width: 100%;
            font-size: 13px;
            display: block;
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
            word-break: break-all;
            overflow-wrap: break-word;
          }
          .email-body-content hr {
            margin: 16px 0;
            border-color: hsl(var(--border));
            opacity: 0.5;
          }
          /* Compact signature styling */
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
            word-break: break-word;
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
            word-break: break-word;
          }
          .email-body-content div,
          .email-body-content span {
            word-break: break-word;
            overflow-wrap: break-word;
          }
          /* Ensure long text wraps properly */
          .email-body-content * {
            max-width: 100%;
            word-wrap: break-word;
          }
        `}</style>
      </div>
    );
  }

  // Email List View
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
            onClick={() => setDirectionFilter("inbound")}
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
            onClick={() => setDirectionFilter("outbound")}
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
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => fetchEmails()}
          disabled={isRefreshing}
        >
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
              const threadCount = getThreadCount(threadId);
              const participants = getParticipants(threadId);
              const isUnread = hasUnread(threadId);
              
              return (
                <div
                  key={email.id}
                  className={cn(
                    "flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-3 sm:py-2 cursor-pointer transition-colors hover:bg-muted/50 max-w-full overflow-hidden",
                    isUnread && "bg-muted/30"
                  )}
                  onClick={() => handleEmailClick(email)}
                >
                  {/* Checkbox - hidden on mobile */}
                  <Checkbox 
                    className="shrink-0 opacity-0 group-hover:opacity-100 hidden sm:block"
                    onClick={(e) => e.stopPropagation()}
                  />
                  
                  {/* Mobile: Stack layout */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1 sm:hidden max-w-full">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "text-sm truncate",
                        isUnread && "font-semibold"
                      )}>
                        {participants}
                      </span>
                      <span className={cn(
                        "text-xs shrink-0",
                        isUnread ? "font-medium text-foreground" : "text-muted-foreground"
                      )}>
                        {formatTime(email.created_at)}
                      </span>
                    </div>
                    <span className={cn(
                      "text-sm truncate",
                      isUnread ? "font-medium" : "text-foreground"
                    )}>
                      {email.subject || "(No subject)"}
                    </span>
                  </div>

                  {/* Desktop: Horizontal layout */}
                  <div className="hidden sm:flex sm:items-center sm:gap-3 sm:flex-1 sm:min-w-0">
                    {/* Sender/Participants */}
                    <div className="w-44 shrink-0 truncate">
                      <span className={cn(
                        "text-sm",
                        isUnread && "font-semibold"
                      )}>
                        {participants}
                      </span>
                      {threadCount > 1 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {threadCount}
                        </span>
                      )}
                    </div>
                    
                    {/* Subject and Preview */}
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className={cn(
                        "text-sm truncate",
                        isUnread ? "font-medium" : "text-foreground"
                      )}>
                        {email.subject || "(No subject)"}
                      </span>
                      <span className="text-sm text-muted-foreground truncate">
                        — {getPreview(email)}
                      </span>
                    </div>
                    
                    {/* Date */}
                    <span className={cn(
                      "text-xs shrink-0",
                      isUnread ? "font-medium text-foreground" : "text-muted-foreground"
                    )}>
                      {formatTime(email.created_at)}
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
