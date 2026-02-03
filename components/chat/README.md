# Chat Interface Components

This directory contains the refactored chat interface, broken down into smaller, maintainable components.

## Main Component

- **chat-interface.tsx** (441 lines, down from 1560 lines!)
  - Main orchestration component that brings everything together
  - Handles state management and business logic
  - Uses custom hooks for conversation, scroll, and realtime updates

## UI Components

### Layout Components
- **chat-header.tsx** - Chat header with agent info and sidebar toggle
- **conversation-sidebar.tsx** - Sidebar showing conversation list with search
- **message-input.tsx** - Message input area with send/stop buttons

### Message Components
- **message-bubble.tsx** - Individual message display with edit/copy functionality
- **message-skeleton.tsx** - Loading skeleton for conversations
- **welcome-screen.tsx** - Initial welcome screen with suggested prompts
- **typing-dots.tsx** - Animated typing indicator
- **live-tool-indicator.tsx** - Shows active tool execution during streaming

### Utility Components
- **markdown-components.tsx** - Custom React Markdown components for enhanced rendering

## Custom Hooks

### /hooks/use-conversation.ts
- Manages conversation state and operations
- Functions: `loadConversations`, `loadConversation`, `generateTitle`, `updateTitle`, `deleteConversation`
- Handles conversation ID persistence in localStorage and URL

### /hooks/use-scroll-management.ts
- Implements "sticky scroll" behavior
- Auto-scrolls to bottom only when user hasn't manually scrolled up
- Handles smooth scrolling during message streaming

### /hooks/use-realtime-updates.ts
- Manages Supabase realtime subscriptions
- Listens for new conversations and messages
- Handles deduplication of incoming messages

## Benefits of Refactoring

1. **Maintainability**: Each component has a single responsibility
2. **Reusability**: Components can be used in other contexts
3. **Testability**: Smaller components are easier to test
4. **Readability**: Code is easier to understand and navigate
5. **Performance**: Better code splitting and memoization opportunities

## File Size Comparison

- **Before**: 1 file × 1560 lines = 1560 lines
- **After**: 10 components + 3 hooks = ~1400 lines (spread across 13 files)
- **Main file**: Reduced from 1560 to 441 lines (72% reduction!)

## Component Dependencies

```
chat-interface.tsx
├── UI Components
│   ├── chat-header.tsx
│   ├── conversation-sidebar.tsx
│   ├── message-input.tsx
│   ├── message-bubble.tsx
│   │   └── markdown-components.tsx
│   ├── welcome-screen.tsx
│   ├── message-skeleton.tsx
│   ├── typing-dots.tsx
│   └── live-tool-indicator.tsx
└── Custom Hooks
    ├── use-conversation.ts
    ├── use-scroll-management.ts
    └── use-realtime-updates.ts
```
