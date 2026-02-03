import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function TaskDialogSkeleton() {
  return (
    <div className="flex flex-col h-[85vh] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between bg-background shrink-0">
        <div className="flex items-center gap-3 flex-1">
          <Skeleton className="h-6 w-32" />
          <Separator orientation="vertical" className="h-4" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Column: Task Details */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-8 space-y-8">
            {/* Title */}
            <Skeleton className="h-10 w-full" />

            {/* Properties Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-4 bg-muted/20 rounded-lg border">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="space-y-3">
              <Skeleton className="h-5 w-24" />
              <div className="space-y-2 p-4 bg-muted/10 rounded-lg min-h-[200px]">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Activity */}
        <div className="w-[380px] border-l bg-muted/10 flex flex-col shrink-0">
          <div className="p-4 border-b bg-background/50 backdrop-blur-sm flex items-center justify-between shrink-0">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-8" />
          </div>
          <div className="flex-1 p-4 space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
