"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import { EmailList } from "@/components/email/email-list";
import { EmailThread } from "@/components/email/email-thread";
import { useEmailFilters } from "@/hooks/use-email-filters";
import { useEmailRealtime } from "@/hooks/use-email-realtime";

type Email = Database["public"]["Tables"]["emails"]["Row"];
type EmailAttachment = Database["public"]["Tables"]["email_attachments"]["Row"];

interface EmailClientProps {
  initialEmails: Email[];
  initialUnreadCount: number;
  agentId: string;
}

export function EmailClient({
  initialEmails,
  initialUnreadCount,
  agentId,
}: EmailClientProps) {
  const supabase = createClient();
  const [emails, setEmails] = useState<Email[]>(initialEmails);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Email[] | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [threadAttachments, setThreadAttachments] = useState<Map<string, EmailAttachment[]>>(
    new Map()
  );
  const [isLoadingThread, setIsLoadingThread] = useState(false);

  const { directionFilter, setDirectionFilter } = useEmailFilters();

  // Handle email insert from realtime
  const handleEmailInsert = useCallback((newEmail: Email) => {
    setEmails((prev) => [newEmail, ...prev]);
  }, []);

  // Handle email update from realtime
  const handleEmailUpdate = useCallback((updatedEmail: Email, oldEmail: Email) => {
    setEmails((prev) => prev.map((e) => (e.id === updatedEmail.id ? updatedEmail : e)));
  }, []);

  // Set up realtime subscription
  const { unreadCount: realtimeUnreadCount, setUnreadCount: setRealtimeUnreadCount } =
    useEmailRealtime(agentId, handleEmailInsert, handleEmailUpdate);

  // Sync unread count
  useEffect(() => {
    setUnreadCount(realtimeUnreadCount);
  }, [realtimeUnreadCount]);

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

        // Store attachments by email ID and fetch signed URLs
        const attachmentsMap = new Map<string, EmailAttachment[]>();
        if (data.attachments?.length > 0) {
          const attachmentsWithUrls = await Promise.all(
            data.attachments.map(async (att: EmailAttachment) => {
              if (att.is_downloaded && att.storage_path) {
                try {
                  const urlRes = await fetch(`/api/attachments/${att.id}`);
                  if (urlRes.ok) {
                    const urlData = await urlRes.json();
                    return { ...att, download_url: urlData.attachment.downloadUrl };
                  }
                } catch (error) {
                  console.error("Error fetching attachment URL:", error);
                }
              }
              return att;
            })
          );
          attachmentsMap.set(email.id, attachmentsWithUrls);
        }
        setThreadAttachments(attachmentsMap);

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
            setRealtimeUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }
      }
    } catch (error) {
      console.error("Error fetching email:", error);
    }

    setIsLoadingThread(false);
  };

  // Thread View
  if (selectedThread || isLoadingThread) {
    return (
      <EmailThread
        thread={selectedThread || []}
        attachments={threadAttachments}
        isLoading={isLoadingThread}
        onBack={() => {
          setSelectedThread(null);
          setSelectedEmail(null);
          setIsLoadingThread(false);
        }}
      />
    );
  }

  // Email List View
  return (
    <EmailList
      emails={emails}
      directionFilter={directionFilter}
      unreadCount={unreadCount}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      onDirectionChange={setDirectionFilter}
      onRefresh={() => fetchEmails()}
      onEmailClick={handleEmailClick}
    />
  );
}
