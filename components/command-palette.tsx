"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  MessageSquare,
  Mail,
  FolderKanban,
  ListTodo,
  Clock,
  Bell,
  BellRing,
  Settings,
  Activity,
  MessageSquarePlus,
  Lightbulb,
  Bug,
  Plus,
  Loader2,
  FileText,
  User,
  ArrowRight,
} from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useCommandPalette } from "@/hooks/use-command-palette"
import { Badge } from "@/components/ui/badge"

interface SearchResult {
  id: string
  type: "conversation" | "task" | "project" | "feedback" | "message" | "notification" | "lead" | "reminder"
  title: string
  description?: string
  metadata: {
    status?: string
    priority?: string
    date?: string
    channelType?: string
    type?: string
    role?: string
    conversationId?: string
  }
  url: string
  score: number
}

const navigationItems = [
  {
    title: "Chat",
    url: "/",
    icon: MessageSquare,
    keywords: ["home", "chat", "message", "conversation"],
  },
  {
    title: "Email",
    url: "/email",
    icon: Mail,
    keywords: ["email", "inbox", "mail", "sent", "messages"],
  },
  {
    title: "Projects",
    url: "/projects",
    icon: FolderKanban,
    keywords: ["project", "folder", "work"],
  },
  {
    title: "Tasks",
    url: "/tasks",
    icon: ListTodo,
    keywords: ["task", "todo", "checklist"],
  },
  {
    title: "Notifications",
    url: "/notifications",
    icon: BellRing,
    keywords: ["notification", "alert", "bell"],
  },
  {
    title: "Schedules",
    url: "/schedules",
    icon: Clock,
    keywords: ["schedule", "calendar", "cron", "recurring"],
  },
  {
    title: "Reminders",
    url: "/reminders",
    icon: Bell,
    keywords: ["reminder", "alert"],
  },
  {
    title: "Activity",
    url: "/activity",
    icon: Activity,
    keywords: ["activity", "log", "history"],
  },
  {
    title: "Submit Feedback",
    url: "/feedback",
    icon: MessageSquarePlus,
    keywords: ["feedback", "submit"],
  },
  {
    title: "Feature Requests",
    url: "/feedback/features",
    icon: Lightbulb,
    keywords: ["feature", "request", "idea"],
  },
  {
    title: "Bug Reports",
    url: "/feedback/bugs",
    icon: Bug,
    keywords: ["bug", "issue", "error"],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    keywords: ["settings", "preferences", "config"],
  },
]

const quickActions = [
  {
    title: "New Chat",
    description: "Start a new conversation",
    icon: Plus,
    action: "new-chat",
    keywords: ["new", "chat", "conversation", "start", "create"],
  },
  {
    title: "New Bug Report",
    description: "Report an issue",
    icon: Bug,
    action: "new-bug",
    keywords: ["new", "bug", "report", "issue", "create"],
  },
  {
    title: "New Feature Request",
    description: "Suggest a feature",
    icon: Lightbulb,
    action: "new-feature",
    keywords: ["new", "feature", "request", "idea", "suggest", "create"],
  },
]

function getTypeIcon(type: SearchResult["type"]) {
  switch (type) {
    case "conversation":
    case "message":
      return MessageSquare
    case "task":
      return ListTodo
    case "project":
      return FolderKanban
    case "feedback":
      return MessageSquarePlus
    case "notification":
      return BellRing
    case "lead":
      return User
    case "reminder":
      return Bell
    default:
      return FileText
  }
}

function getTypeLabel(type: SearchResult["type"]) {
  switch (type) {
    case "conversation":
      return "Conversation"
    case "message":
      return "Message"
    case "task":
      return "Task"
    case "project":
      return "Project"
    case "feedback":
      return "Feedback"
    case "notification":
      return "Notification"
    case "lead":
      return "Lead"
    case "reminder":
      return "Reminder"
    default:
      return type
  }
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null
  
  const variant = 
    status === "done" || status === "completed" ? "secondary" :
    status === "in_progress" || status === "running" ? "default" :
    status === "high" || status === "critical" ? "destructive" :
    "outline"
  
  return (
    <Badge variant={variant} className="text-[10px] px-1.5 py-0">
      {status.replace(/_/g, " ")}
    </Badge>
  )
}

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette()
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Reset state when closing
  React.useEffect(() => {
    if (!open) {
      setQuery("")
      setSearchResults([])
      setIsSearching(false)
    }
  }, [open])

  // Debounced search - triggers when query is 2+ characters
  React.useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (query.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, limit: 20 }),
        })

        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.results || [])
        } else {
          console.error("Search failed:", response.status)
          setSearchResults([])
        }
      } catch (error) {
        console.error("Search error:", error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [query])

  const handleNavigate = (url: string) => {
    setOpen(false)
    router.push(url)
  }

  const handleAction = (action: string) => {
    setOpen(false)
    switch (action) {
      case "new-chat":
        router.push("/?new=true")
        break
      case "new-bug":
        router.push("/feedback?type=bug_report")
        break
      case "new-feature":
        router.push("/feedback?type=feature_request")
        break
    }
  }

  const handleSearchResultSelect = (result: SearchResult) => {
    setOpen(false)
    router.push(result.url)
  }

  // Group search results by type
  const groupedResults = React.useMemo(() => {
    const groups: Record<string, SearchResult[]> = {}
    for (const result of searchResults) {
      if (!groups[result.type]) {
        groups[result.type] = []
      }
      groups[result.type].push(result)
    }
    return groups
  }, [searchResults])

  const hasSearchResults = searchResults.length > 0
  const showSearchSection = query.length >= 2

  return (
    <CommandDialog 
      open={open} 
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search or navigate to pages and actions"
      showCloseButton={false}
    >
      <CommandInput 
        placeholder="Type a command or search..." 
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : query.length >= 2 ? (
            <span>No results found for &quot;{query}&quot;</span>
          ) : (
            <span>Type to search...</span>
          )}
        </CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Actions">
          {quickActions.map((action) => (
            <CommandItem
              key={action.action}
              value={`${action.title} ${action.keywords.join(" ")}`}
              onSelect={() => handleAction(action.action)}
              className="gap-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <action.icon className="h-5 w-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{action.title}</span>
                <span className="text-xs text-muted-foreground">
                  {action.description}
                </span>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading="Go to">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.url}
              value={`${item.title} ${item.keywords.join(" ")}`}
              onSelect={() => handleNavigate(item.url)}
              className="gap-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <item.icon className="h-5 w-5" />
              </div>
              <span className="font-medium">{item.title}</span>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Database Search Results */}
        {showSearchSection && hasSearchResults && (
          <>
            <CommandSeparator />
            {/* Grouped results - each type gets its own CommandGroup */}
            {Object.entries(groupedResults).map(([type, results]) => (
              <CommandGroup key={type} heading={getTypeLabel(type as SearchResult["type"]) + "s"}>
                {results.map((result) => {
                  const Icon = getTypeIcon(result.type)
                  return (
                    <CommandItem
                      key={`${result.type}-${result.id}`}
                      value={`search-${result.type}-${result.id}-${result.title}`}
                      onSelect={() => handleSearchResultSelect(result)}
                      className="gap-3"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                        <span className="font-medium truncate">{result.title}</span>
                        {result.description && (
                          <span className="text-xs text-muted-foreground truncate">
                            {result.description}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={result.metadata?.status || result.metadata?.priority} />
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </>
        )}
      </CommandList>
      
      <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground bg-muted/30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium">
              <span className="text-xs">↑</span>
            </kbd>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium">
              <span className="text-xs">↓</span>
            </kbd>
            <span>navigate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium">
              ↵
            </kbd>
            <span>select</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium">
            esc
          </kbd>
          <span>close</span>
        </div>
      </div>
    </CommandDialog>
  )
}
