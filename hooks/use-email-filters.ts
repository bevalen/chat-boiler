/**
 * Hook for email filtering and direction management
 */

import { useState, useEffect } from "react";

export type DirectionFilter = "inbound" | "outbound";

export function useEmailFilters() {
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("inbound");

  // Keyboard shortcut: Tab to toggle between Inbound and Outbound
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        const target = e.target as HTMLElement;
        const isInput =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable;

        if (!isInput) {
          e.preventDefault();
          setDirectionFilter((prev) => (prev === "inbound" ? "outbound" : "inbound"));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    directionFilter,
    setDirectionFilter,
  };
}
