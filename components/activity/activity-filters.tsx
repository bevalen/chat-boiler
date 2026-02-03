/**
 * Activity filters component
 */

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Filter, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityType, ActivitySource } from "@/lib/db/activity-log";
import { ACTIVITY_ICONS, ACTIVITY_COLORS, SOURCE_LABELS } from "@/lib/activity/activity-constants";

interface ActivityFiltersProps {
  typeFilter: ActivityType | "all";
  sourceFilter: ActivitySource | "all";
  onTypeFilterChange: (type: ActivityType | "all") => void;
  onSourceFilterChange: (source: ActivitySource | "all") => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function ActivityFilters({
  typeFilter,
  sourceFilter,
  onTypeFilterChange,
  onSourceFilterChange,
  onRefresh,
  isRefreshing,
}: ActivityFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Type Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            {typeFilter === "all" ? "All Types" : typeFilter.replace("_", " ")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
          <DropdownMenuCheckboxItem
            checked={typeFilter === "all"}
            onCheckedChange={() => onTypeFilterChange("all")}
          >
            All Types
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {(Object.keys(ACTIVITY_ICONS) as ActivityType[]).map((type) => (
            <DropdownMenuCheckboxItem
              key={type}
              checked={typeFilter === type}
              onCheckedChange={() => onTypeFilterChange(type)}
            >
              <span className={cn("mr-2", ACTIVITY_COLORS[type])}>{ACTIVITY_ICONS[type]}</span>
              {type.replace(/_/g, " ")}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Source Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            {sourceFilter === "all" ? "All Sources" : SOURCE_LABELS[sourceFilter]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuCheckboxItem
            checked={sourceFilter === "all"}
            onCheckedChange={() => onSourceFilterChange("all")}
          >
            All Sources
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {(Object.keys(SOURCE_LABELS) as ActivitySource[]).map((source) => (
            <DropdownMenuCheckboxItem
              key={source}
              checked={sourceFilter === source}
              onCheckedChange={() => onSourceFilterChange(source)}
            >
              {SOURCE_LABELS[source]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Refresh */}
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
        <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
      </Button>
    </div>
  );
}
