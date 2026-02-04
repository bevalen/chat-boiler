"use client";

import { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square, Loader2 } from "lucide-react";

interface MessageInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: () => void;
  isLoading: boolean;
  isCreating: boolean;
  status: string;
  agentName: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export function MessageInput({
  input,
  onInputChange,
  onSubmit,
  onStop,
  isLoading,
  isCreating,
  status,
  agentName,
  textareaRef,
}: MessageInputProps) {
  return (
    <div className="border-t border-white/5 bg-background/80 backdrop-blur-md p-4 z-20 shrink-0">
      <div className="max-w-3xl mx-auto relative">
        <form
          onSubmit={onSubmit}
          className="relative rounded-2xl bg-secondary/50 border border-white/10 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all"
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={`Ask ${agentName} anything...`}
            className="min-h-[56px] max-h-[200px] w-full bg-transparent border-0 focus-visible:ring-0 resize-none py-4 pl-4 pr-14 text-base placeholder:text-muted-foreground/50"
            rows={1}
            onKeyDown={(e) => {
              // On mobile, Enter key should add line break (only Send button sends message)
              // On desktop, Enter sends message, Shift+Enter adds line break
              const isMobile = window.innerWidth < 768;

              if (e.key === "Enter" && !isMobile && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
          />
          {isLoading ? (
            <Button
              type="button"
              size="icon"
              onClick={onStop}
              className="absolute right-2 bottom-2 h-10 w-10 rounded-xl transition-all hover:scale-105 active:scale-95 bg-destructive hover:bg-destructive/90"
              title="Stop generating"
            >
              <Square className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || status !== "ready" || isCreating}
              className="absolute right-2 bottom-2 h-10 w-10 rounded-xl transition-all hover:scale-105 active:scale-95"
            >
              {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          )}
        </form>
        <p className="text-[10px] text-muted-foreground/40 text-center mt-3 uppercase tracking-wider font-medium">
          AI Assistant System • Confidential
        </p>
      </div>
    </div>
  );
}
