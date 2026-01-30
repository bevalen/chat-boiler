"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

export function ChatInterface() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Re-focus input when response is complete
  useEffect(() => {
    if (status === "ready" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [status]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status === "ready") {
      sendMessage({ text: input.trim() });
      setInput("");
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/50 relative">
      {/* Background Glow (Very Subtle) */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-[120px] opacity-20" />

      {/* Messages area */}
      <ScrollArea className="flex-1 px-4 z-10" ref={scrollRef}>
        <div className="max-w-3xl mx-auto py-8 space-y-8">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6 opacity-0 animate-fade-in-up [animation-delay:200ms] fill-mode-forwards">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/10">
                <Bot className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">How can I help you today?</h2>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">
                  I'm Milo, your AI Executive Assistant. I can help with tasks, scheduling, and project management.
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mt-8">
                <button className="text-sm bg-secondary/50 hover:bg-secondary/80 border border-white/5 rounded-xl p-4 text-left transition-colors" onClick={() => {
                  setInput("What's on my schedule today?");
                  textareaRef.current?.focus();
                }}>
                  <span className="font-medium block mb-1">Check Schedule</span>
                  <span className="text-muted-foreground text-xs">"What's on my schedule today?"</span>
                </button>
                <button className="text-sm bg-secondary/50 hover:bg-secondary/80 border border-white/5 rounded-xl p-4 text-left transition-colors" onClick={() => {
                  setInput("Create a new project for Q1 Marketing");
                  textareaRef.current?.focus();
                }}>
                  <span className="font-medium block mb-1">New Project</span>
                  <span className="text-muted-foreground text-xs">"Create a new project..."</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  
                  <div
                    className={`relative max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-secondary/50 border border-white/5 rounded-tl-sm"
                    }`}
                  >
                    {message.parts.map((part, index) => {
                      if (part.type === "text") {
                        return message.role === "user" ? (
                          <p key={index} className="whitespace-pre-wrap">{part.text}</p>
                        ) : (
                          <div key={index} className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10">
                            <ReactMarkdown>{part.text}</ReactMarkdown>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>

                  {message.role === "user" && (
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-1">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {status === "submitted" && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div className="bg-secondary/50 border border-white/5 rounded-2xl rounded-tl-sm px-5 py-4">
                    <TypingDots />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-white/5 bg-background/80 backdrop-blur-md p-4 z-20">
        <div className="max-w-3xl mx-auto relative">
          <form onSubmit={handleSubmit} className="relative rounded-2xl bg-secondary/50 border border-white/10 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Milo anything..."
              className="min-h-[56px] max-h-[200px] w-full bg-transparent border-0 focus-visible:ring-0 resize-none py-4 pl-4 pr-14 text-base placeholder:text-muted-foreground/50"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || status !== "ready"}
              className="absolute right-2 bottom-2 h-10 w-10 rounded-xl transition-all hover:scale-105 active:scale-95"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground/40 text-center mt-3 uppercase tracking-wider font-medium">
            MAIA Internal System • Confidential
          </p>
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 h-full">
      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" />
    </div>
  );
}
