/**
 * Email utility functions for formatting and processing
 */

import type { Database } from "@/lib/types/database";

type Email = Database["public"]["Tables"]["emails"]["Row"];

/**
 * Format time - show time if today, otherwise date
 */
export function formatEmailTime(dateString: string | null): string {
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
}

/**
 * Format full date for thread view
 */
export function formatEmailFullDate(dateString: string | null): string {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Get preview text from email
 */
export function getEmailPreview(email: Email): string {
  const text = email.text_body || email.html_body?.replace(/<[^>]*>/g, "") || "";
  return text.replace(/\s+/g, " ").trim().substring(0, 80);
}

/**
 * Clean HTML content - strip excessive signature styling
 */
export function cleanEmailHtml(html: string): string {
  if (typeof window === "undefined") return html;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;

  // Limit large images in signatures
  wrapper.querySelectorAll("img").forEach((img) => {
    const width = img.getAttribute("width");
    const style = img.getAttribute("style") || "";

    if (width && parseInt(width) > 200) {
      img.setAttribute("width", "150");
      img.removeAttribute("height");
    }

    img.setAttribute("style", style + "; max-width: 150px; height: auto;");
  });

  return wrapper.innerHTML;
}

/**
 * Group emails by thread (show latest per thread)
 */
export function groupEmailsByThread(emails: Email[]): Email[] {
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
    threadEmails.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    latestEmails.push(threadEmails[0]);
  });

  // Sort by date
  return latestEmails.sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
}

/**
 * Get participant names for thread
 */
export function getThreadParticipants(emails: Email[], threadId: string): string {
  const threadEmails = emails.filter((e) => (e.thread_id || e.id) === threadId);
  const participants = new Set<string>();

  threadEmails.forEach((email) => {
    if (email.direction === "inbound") {
      participants.add(
        email.from_name?.split(" ")[0] || email.from_address?.split("@")[0] || "Unknown"
      );
    }
  });

  const hasOutbound = threadEmails.some((e) => e.direction === "outbound");
  if (hasOutbound) {
    participants.add("Maia");
  }

  return Array.from(participants).join(", ");
}

/**
 * Get thread count
 */
export function getThreadCount(emails: Email[], threadId: string): number {
  return emails.filter((e) => (e.thread_id || e.id) === threadId).length;
}

/**
 * Check if thread has unread emails
 */
export function hasUnreadInThread(emails: Email[], threadId: string): boolean {
  return emails.some(
    (e) => (e.thread_id || e.id) === threadId && !e.is_read && e.direction === "inbound"
  );
}
