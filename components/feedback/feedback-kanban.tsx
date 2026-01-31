"use client";

import { useState, useCallback } from "react";
import { FeedbackItem } from "@/lib/db/feedback";
import { FeedbackStatus, FeedbackPriority, FeedbackType } from "@/lib/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FeedbackDetail } from "./feedback-detail";
import {
  Lightbulb,
  Bug,
  AlertCircle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Clock,
  Eye,
  Calendar,
  CheckCircle2,
  XCircle,
  CircleDashed,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackKanbanProps {
  items: Record<FeedbackStatus, FeedbackItem[]>;
  type: FeedbackType;
  onItemClick?: (item: FeedbackItem) => void;
}

const statusConfig: Record<FeedbackStatus, { label: string; icon: React.ElementType; color: string }> = {
  new: { label: "New", icon: CircleDashed, color: "text-muted-foreground" },
  under_review: { label: "Under Review", icon: Eye, color: "text-blue-500" },
  planned: { label: "Planned", icon: Calendar, color: "text-purple-500" },
  in_progress: { label: "In Progress", icon: Clock, color: "text-yellow-500" },
  done: { label: "Done", icon: CheckCircle2, color: "text-green-500" },
  wont_fix: { label: "Won't Fix", icon: XCircle, color: "text-red-500" },
};

const priorityConfig: Record<FeedbackPriority, { label: string; icon: React.ElementType; color: string }> = {
  critical: { label: "Critical", icon: AlertCircle, color: "text-red-500 bg-red-500/10" },
  high: { label: "High", icon: ArrowUp, color: "text-orange-500 bg-orange-500/10" },
  medium: { label: "Medium", icon: ArrowRight, color: "text-yellow-500 bg-yellow-500/10" },
  low: { label: "Low", icon: ArrowDown, color: "text-blue-500 bg-blue-500/10" },
};

function FeedbackCard({
  item,
  type,
  onClick,
}: {
  item: FeedbackItem;
  type: FeedbackType;
  onClick?: () => void;
}) {
  const priority = item.priority || "medium";
  const priorityInfo = priorityConfig[priority];
  const PriorityIcon = priorityInfo.icon;
  const TypeIcon = type === "feature_request" ? Lightbulb : Bug;

  return (
    <Card
      className="cursor-pointer hover:bg-muted/50 transition-colors border-border/50"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              type === "feature_request" ? "bg-purple-500/10" : "bg-red-500/10"
            )}
          >
            <TypeIcon
              className={cn(
                "h-4 w-4",
                type === "feature_request" ? "text-purple-500" : "text-red-500"
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm leading-tight line-clamp-2">{item.title}</h4>
            {item.problem && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.problem}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={cn("text-xs px-1.5 py-0", priorityInfo.color)}>
                <PriorityIcon className="h-3 w-3 mr-1" />
                {priorityInfo.label}
              </Badge>
              {item.source === "agent_error" && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 text-orange-500 bg-orange-500/10">
                  Auto
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanColumn({
  status,
  items,
  type,
  onItemClick,
}: {
  status: FeedbackStatus;
  items: FeedbackItem[];
  type: FeedbackType;
  onItemClick?: (item: FeedbackItem) => void;
}) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className="flex flex-col min-w-[300px] max-w-[300px] bg-muted/30 rounded-xl border border-border/50">
      <div className="flex items-center gap-2 p-4 border-b border-border/50">
        <StatusIcon className={cn("h-4 w-4", config.color)} />
        <h3 className="font-semibold text-sm">{config.label}</h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {items.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No items</p>
          ) : (
            items.map((item) => (
              <FeedbackCard
                key={item.id}
                item={item}
                type={type}
                onClick={() => onItemClick?.(item)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function FeedbackKanban({ items, type, onItemClick }: FeedbackKanbanProps) {
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Only show relevant statuses (skip wont_fix for initial view)
  const displayStatuses: FeedbackStatus[] = ["new", "under_review", "planned", "in_progress", "done"];

  const handleItemClick = useCallback((item: FeedbackItem) => {
    setSelectedItem(item);
    setDetailOpen(true);
    onItemClick?.(item);
  }, [onItemClick]);

  const handleUpdate = useCallback((updatedItem: FeedbackItem) => {
    // The page would need to refresh to show the updated item in the correct column
    // For now, we'll just update the selected item
    setSelectedItem(updatedItem);
  }, []);

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
        {displayStatuses.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            items={items[status] || []}
            type={type}
            onItemClick={handleItemClick}
          />
        ))}
      </div>
      <FeedbackDetail
        feedback={selectedItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdate={handleUpdate}
      />
    </>
  );
}
