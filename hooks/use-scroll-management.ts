import { useRef, useCallback, useEffect } from "react";
import { UIMessage } from "@ai-sdk/react";

export function useScrollManagement(messages: UIMessage[], status: string) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sticky scroll refs - allow user to scroll up during streaming without being forced back down
  const isUserScrollingRef = useRef(false); // true = user has scrolled up, don't auto-scroll
  const lastScrollTopRef = useRef(0);
  const isAutoScrollingRef = useRef(false); // prevent scroll handler from detecting our own scrolls

  // Track scroll position to implement "sticky scroll" - only auto-scroll if user hasn't scrolled up
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Ignore scroll events triggered by our own auto-scrolling
    if (isAutoScrollingRef.current) {
      return;
    }

    const currentScrollTop = target.scrollTop;
    const maxScrollTop = target.scrollHeight - target.clientHeight;
    const threshold = 50; // threshold for "at bottom" detection
    const isAtBottom = maxScrollTop - currentScrollTop <= threshold;

    // Detect user scroll direction: if they scrolled UP, disable auto-scroll
    if (currentScrollTop < lastScrollTopRef.current && !isAtBottom) {
      isUserScrollingRef.current = true;
    }

    // If user scrolled to bottom, re-enable auto-scroll
    if (isAtBottom) {
      isUserScrollingRef.current = false;
    }

    lastScrollTopRef.current = currentScrollTop;
  }, []);

  // Scroll to bottom helper - uses instant scroll during streaming to avoid animation conflicts
  const scrollToBottom = useCallback(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;

    isAutoScrollingRef.current = true;

    // Use instant scroll (no animation) - much smoother during rapid updates
    viewport.scrollTop = viewport.scrollHeight;

    // Reset the flag after a frame to allow user scroll detection
    requestAnimationFrame(() => {
      isAutoScrollingRef.current = false;
      lastScrollTopRef.current = viewport.scrollTop;
    });
  }, []);

  // Auto-scroll to bottom only when user hasn't scrolled up (sticky scroll behavior)
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      scrollToBottom();
    }
  }, [messages, status, scrollToBottom]);

  // Reset user scrolling when a new message is sent (user wants to see the response)
  const resetScrollOnSend = useCallback(() => {
    isUserScrollingRef.current = false;
    scrollToBottom();
  }, [scrollToBottom]);

  return {
    scrollRef,
    handleScroll,
    scrollToBottom,
    resetScrollOnSend,
  };
}
