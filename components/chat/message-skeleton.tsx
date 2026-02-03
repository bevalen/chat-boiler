import { Skeleton } from "@/components/ui/skeleton";

export function MessageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-4 justify-start">
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <div className="space-y-2 flex-1 max-w-[70%]">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="flex gap-4 justify-end">
        <div className="space-y-2 flex-1 max-w-[60%]">
          <Skeleton className="h-4 w-full ml-auto" />
          <Skeleton className="h-4 w-2/3 ml-auto" />
        </div>
      </div>
      <div className="flex gap-4 justify-start">
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <div className="space-y-2 flex-1 max-w-[70%]">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}
