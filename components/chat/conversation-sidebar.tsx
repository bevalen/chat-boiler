"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, ChevronLeft, Pencil, Check, X, Trash2 } from "lucide-react";

interface Conversation {
  id: string;
  title: string | null;
  channelType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ConversationSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  loading: boolean;
  showSidebar: boolean;
  onToggleSidebar: () => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onUpdateTitle: (id: string, title: string) => void;
  onDeleteConversation: (conv: Conversation) => void;
}

export function ConversationSidebar({
  conversations,
  currentConversationId,
  loading,
  showSidebar,
  onToggleSidebar,
  onSelectConversation,
  onNewConversation,
  onUpdateTitle,
  onDeleteConversation,
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");

  const filteredConversations = searchQuery.trim()
    ? conversations.filter((conv) =>
        (conv.title || "New conversation").toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : conversations;

  const startEditingTitle = (conv: Conversation) => {
    setEditingTitleId(conv.id);
    setEditingTitleValue(conv.title || "");
  };

  const cancelEditingTitle = () => {
    setEditingTitleId(null);
    setEditingTitleValue("");
  };

  const saveTitle = () => {
    if (editingTitleId && editingTitleValue.trim()) {
      onUpdateTitle(editingTitleId, editingTitleValue.trim());
      setEditingTitleId(null);
      setEditingTitleValue("");
    }
  };

  return (
    <div
      className={`absolute md:relative z-30 h-full bg-background/95 backdrop-blur-md border-r border-white/5 transition-all duration-300 ${
        showSidebar ? "w-80 opacity-100" : "w-0 opacity-0 md:w-0"
      } overflow-hidden`}
    >
      <div className="w-80 h-full flex flex-col">
        <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 shrink-0">
          <h3 className="font-semibold">Conversations</h3>
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="md:hidden">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-2 space-y-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full h-9 pl-8 text-sm"
            />
          </div>
          <Button onClick={onNewConversation} className="w-full justify-start gap-2" variant="outline">
            <Plus className="h-4 w-4" />
            New conversation
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0 px-2">
          {loading ? (
            <div className="space-y-1 py-2">
              {[85, 70, 95, 60, 75].map((width, i) => (
                <div key={i} className="px-3 py-2">
                  <Skeleton className="h-4" style={{ width: `${width}%` }} />
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {searchQuery.trim() ? "No conversations match your search" : "No conversations yet"}
            </div>
          ) : (
            <div className="space-y-1 py-2">
              {filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group w-full text-left px-2 py-2 rounded-lg text-sm transition-colors ${
                    currentConversationId === conv.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-secondary/50 text-muted-foreground"
                  }`}
                >
                  {editingTitleId === conv.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editingTitleValue}
                        onChange={(e) => setEditingTitleValue(e.target.value)}
                        className="h-7 text-sm px-2"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveTitle();
                          if (e.key === "Escape") cancelEditingTitle();
                        }}
                      />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveTitle}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEditingTitle}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0 w-full">
                      <button
                        onClick={() => onSelectConversation(conv.id)}
                        className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer text-left overflow-hidden"
                      >
                        <span className="truncate flex-1 min-w-0">{conv.title || "New conversation"}</span>
                      </button>
                      <div className="flex items-center shrink-0 gap-1 flex-nowrap ml-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingTitle(conv);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(conv);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
