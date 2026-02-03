/**
 * Hook for managing project comments
 */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ActivityItem } from "./use-project-activity";

export function useProjectComments(
  projectId: string,
  setActivityItems: React.Dispatch<React.SetStateAction<ActivityItem[]>>,
  scrollAreaRef: React.RefObject<HTMLDivElement | null>
) {
  const [newComment, setNewComment] = useState("");

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    const supabase = createClient();

    const { data, error } = await supabase
      .from("comments")
      .insert({
        project_id: projectId,
        content: newComment,
        author_type: "user",
        comment_type: "note",
      })
      .select()
      .single();

    if (!error && data) {
      setActivityItems((prev) => [
        ...prev,
        {
          type: "comment",
          id: data.id,
          content: data.content,
          author_type: data.author_type,
          created_at: data.created_at,
        },
      ]);
      setNewComment("");
      setTimeout(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop =
            scrollAreaRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  return {
    newComment,
    setNewComment,
    handleAddComment,
  };
}
