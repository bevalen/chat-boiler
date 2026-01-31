"use client";

import { useState, useEffect } from "react";
import { FeedbackItem, updateFeedback } from "@/lib/db/feedback";
import { FeedbackStatus, FeedbackPriority, CommentType } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Lightbulb,
  Bug,
  AlertCircle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Clock,
  Send,
  Loader2,
  MessageSquare,
  User,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  task_id: string | null;
  project_id: string | null;
  feedback_id: string | null;
  author_type: "user" | "agent" | "system";
  author_id: string | null;
  content: string;
  comment_type: CommentType | null;
  created_at: string | null;
}

interface FeedbackDetailProps {
  feedback: FeedbackItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (feedback: FeedbackItem) => void;
}

const statusOptions: { value: FeedbackStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "under_review", label: "Under Review" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "wont_fix", label: "Won't Fix" },
];

const priorityOptions: { value: FeedbackPriority; label: string; icon: React.ElementType; color: string }[] = [
  { value: "critical", label: "Critical", icon: AlertCircle, color: "text-red-500" },
  { value: "high", label: "High", icon: ArrowUp, color: "text-orange-500" },
  { value: "medium", label: "Medium", icon: ArrowRight, color: "text-yellow-500" },
  { value: "low", label: "Low", icon: ArrowDown, color: "text-blue-500" },
];

export function FeedbackDetail({ feedback, open, onOpenChange, onUpdate }: FeedbackDetailProps) {
  const [status, setStatus] = useState<FeedbackStatus>("new");
  const [priority, setPriority] = useState<FeedbackPriority>("medium");
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const supabase = createClient();

  // Load initial values and comments when feedback changes
  useEffect(() => {
    if (feedback) {
      setStatus(feedback.status || "new");
      setPriority(feedback.priority || "medium");
      loadComments();
    }
  }, [feedback?.id]);

  const loadComments = async () => {
    if (!feedback) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("feedback_id", feedback.id)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setComments(data);
      }
    } catch (err) {
      console.error("Error loading comments:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: FeedbackStatus) => {
    if (!feedback) return;
    setStatus(newStatus);
    
    const { feedback: updated } = await updateFeedback(supabase, feedback.id, { status: newStatus });
    if (updated && onUpdate) {
      onUpdate(updated);
    }
  };

  const handlePriorityChange = async (newPriority: FeedbackPriority) => {
    if (!feedback) return;
    setPriority(newPriority);
    
    const { feedback: updated } = await updateFeedback(supabase, feedback.id, { priority: newPriority });
    if (updated && onUpdate) {
      onUpdate(updated);
    }
  };

  const handleSubmitComment = async () => {
    if (!feedback || !newComment.trim()) return;
    setSubmittingComment(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("comments")
        .insert({
          feedback_id: feedback.id,
          author_type: "user",
          author_id: user.id,
          content: newComment.trim(),
          comment_type: "note",
        });

      if (!error) {
        setNewComment("");
        await loadComments();
      }
    } catch (err) {
      console.error("Error submitting comment:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  if (!feedback) return null;

  const TypeIcon = feedback.type === "feature_request" ? Lightbulb : Bug;
  const typeColor = feedback.type === "feature_request" ? "text-purple-500" : "text-red-500";
  const typeBgColor = feedback.type === "feature_request" ? "bg-purple-500/10" : "bg-red-500/10";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", typeBgColor)}>
              <TypeIcon className={cn("h-5 w-5", typeColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg leading-tight">{feedback.title}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {feedback.type === "feature_request" ? "Feature Request" : "Bug Report"}
                </Badge>
                {feedback.source === "agent_error" && (
                  <Badge variant="outline" className="text-xs text-orange-500 bg-orange-500/10">
                    Auto-reported
                  </Badge>
                )}
                {feedback.createdAt && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(feedback.createdAt), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Status and Priority */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
              <Select value={status} onValueChange={(v) => handleStatusChange(v as FeedbackStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Priority</label>
              <Select value={priority} onValueChange={(v) => handlePriorityChange(v as FeedbackPriority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.icon className={cn("h-3 w-3", opt.color)} />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Problem Description */}
          {feedback.problem && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Problem</label>
              <p className="text-sm bg-muted/50 rounded-lg p-3">{feedback.problem}</p>
            </div>
          )}

          {/* Proposed Solution */}
          {feedback.proposedSolution && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Proposed Solution</label>
              <p className="text-sm bg-muted/50 rounded-lg p-3">{feedback.proposedSolution}</p>
            </div>
          )}

          {/* Context (for auto-reported bugs) */}
          {feedback.context && Object.keys(feedback.context).length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Context</label>
              <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(feedback.context, null, 2)}
              </pre>
            </div>
          )}

          <Separator />

          {/* Comments Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Comments ({comments.length})</span>
            </div>

            <ScrollArea className="flex-1 -mx-1 px-1">
              <div className="space-y-3 pb-2">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No comments yet. Add context or notes below.
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                          comment.author_type === "agent"
                            ? "bg-primary/10"
                            : comment.author_type === "system"
                            ? "bg-muted"
                            : "bg-muted"
                        )}
                      >
                        {comment.author_type === "agent" ? (
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <User className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium capitalize">{comment.author_type}</span>
                          {comment.created_at && (
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                        <p className="text-sm">{comment.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Add Comment */}
            <div className="flex gap-2 pt-3 border-t">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="min-h-[44px] max-h-[100px] resize-none"
                disabled={submittingComment}
                rows={1}
              />
              <Button
                size="icon"
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submittingComment}
              >
                {submittingComment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
