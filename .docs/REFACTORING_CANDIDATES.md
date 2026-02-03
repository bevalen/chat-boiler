# Refactoring Candidates

This document lists all files in the codebase that need refactoring based on size, complexity, and separation of concerns. Files are organized by priority and include specific refactoring recommendations.

**Last Updated:** February 3, 2026

## Priority 1: Critical Refactoring (Very Large Files)

### `lib/inngest/functions/process-email.ts` (875 lines)
**Status:** 🔴 Critical  
**Issues:**
- Extremely large file handling multiple responsibilities
- Mixes email context gathering, conversation management, agent execution, and tool creation
- Contains inline tool definitions that should be extracted
- Complex prompt building logic mixed with execution logic

**Refactoring Plan:**
- Extract email context prompt building → `lib/inngest/functions/email-context-prompt.ts`
- Extract email agent tools → `lib/tools/email-agent-tools.ts`
- Extract conversation creation logic → `lib/inngest/functions/email-conversation.ts`
- Keep main function focused on orchestration only

**Estimated Effort:** High (4-6 hours)

---

## Priority 2: High Priority (Large Components & Complex Logic)

### `components/projects/project-detail.tsx` (741 lines)
**Status:** 🟠 High Priority  
**Issues:**
- Large component mixing UI rendering, state management, and API calls
- Activity fetching and comment management logic embedded in component
- Task creation dialog logic mixed with project detail logic
- Multiple responsibilities: editing, deleting, task management, activity feed

**Refactoring Plan:**
- Extract activity fetching → `hooks/use-project-activity.ts`
- Extract comment management → `hooks/use-project-comments.ts`
- Extract task creation logic → `hooks/use-create-task.ts`
- Split into sub-components:
  - `project-detail-header.tsx`
  - `project-detail-description.tsx`
  - `project-detail-tasks.tsx`
  - `project-detail-activity.tsx`

**Estimated Effort:** Medium-High (3-4 hours)

### `components/shared/task-dialog.tsx` (709 lines)
**Status:** 🟠 High Priority  
**Issues:**
- Very large dialog component with complex state management
- Timeline/activity fetching mixed with task editing
- Auto-save logic embedded in component
- Multiple concerns: editing, commenting, activity display

**Refactoring Plan:**
- Extract timeline fetching → `hooks/use-task-timeline.ts`
- Extract auto-save logic → `hooks/use-auto-save-task.ts`
- Split into sub-components:
  - `task-dialog-header.tsx`
  - `task-dialog-details.tsx`
  - `task-dialog-activity.tsx`
- Move timeline rendering to separate component

**Estimated Effort:** Medium-High (3-4 hours)

### `components/chat/chat-interface.tsx` (547 lines)
**Status:** 🟠 High Priority  
**Issues:**
- Large component with complex state management
- Conversation management, URL syncing, and message handling all in one file
- Multiple useEffect hooks managing different concerns
- Optimistic message handling mixed with real message handling

**Refactoring Plan:**
- Already has some hooks extracted (`use-conversation`, `use-scroll-management`, `use-realtime-updates`)
- Extract URL synchronization logic → `hooks/use-conversation-url-sync.ts`
- Extract optimistic message handling → `hooks/use-optimistic-messages.ts`
- Extract conversation creation logic → `hooks/use-create-conversation.ts`
- Consider splitting sidebar and main chat area into separate components

**Estimated Effort:** Medium (2-3 hours)

---

## Priority 3: Medium Priority (Large Tool Files)

### `lib/tools/scheduling-tools.ts` (644 lines)
**Status:** 🟡 Medium Priority  
**Issues:**
- Large file with multiple scheduling tools
- Repetitive validation and date formatting logic
- Similar patterns across different tool types

**Refactoring Plan:**
- Extract date/time validation → `lib/tools/utils/scheduling-validation.ts`
- Extract date formatting utilities → `lib/tools/utils/date-formatting.ts`
- Consider splitting into:
  - `reminder-tools.ts` (scheduleReminder)
  - `agent-task-tools.ts` (scheduleAgentTask)
  - `follow-up-tools.ts` (scheduleTaskFollowUp)
  - `job-management-tools.ts` (list, cancel, update)

**Estimated Effort:** Medium (2-3 hours)

### `lib/tools/linkedin-leads.ts` (546 lines)
**Status:** 🟡 Medium Priority  
**Issues:**
- Multiple tools in one file
- Repetitive URL normalization logic
- Logging logic repeated across tools

**Refactoring Plan:**
- Extract URL normalization → `lib/tools/utils/linkedin-url.ts`
- Extract logging helper → `lib/tools/utils/tool-logging.ts`
- Consider splitting into separate files per tool (if tools grow)
- Keep together for now since they're closely related

**Estimated Effort:** Low-Medium (1-2 hours)

### `lib/tools/email-resend.ts` (544 lines)
**Status:** 🟡 Medium Priority  
**Issues:**
- Multiple email tool factories in one file
- Repetitive error handling patterns
- Similar validation logic across tools

**Refactoring Plan:**
- Extract email validation → `lib/tools/utils/email-validation.ts`
- Extract common error handling → `lib/tools/utils/email-error-handling.ts`
- Consider grouping related tools:
  - `email-send-tools.ts` (send, reply, forward)
  - `email-read-tools.ts` (check, getDetails, getThread, markAsRead)

**Estimated Effort:** Medium (2-3 hours)

### `lib/tools/task-tools.ts` (420 lines)
**Status:** 🟡 Medium Priority  
**Issues:**
- Moderate size but could benefit from extraction
- Assignee resolution logic could be reusable
- Embedding generation logic repeated

**Refactoring Plan:**
- Extract assignee resolution → `lib/tools/utils/assignee-resolution.ts`
- Extract embedding generation for tasks → `lib/tools/utils/task-embeddings.ts`
- File is manageable but could be cleaner

**Estimated Effort:** Low-Medium (1-2 hours)

---

## Priority 4: Lower Priority (Moderate Size, Mixed Concerns)

### `lib/email/send-email.ts` (335 lines)
**Status:** 🟢 Lower Priority  
**Issues:**
- Mixes email sending with URL conversion and HTML stripping
- Signature injection logic could be clearer
- Threading logic mixed with sending logic

**Refactoring Plan:**
- Extract URL conversion → `lib/email/utils/url-conversion.ts`
- Extract HTML stripping → `lib/email/utils/html-stripping.ts`
- Extract threading logic → `lib/email/utils/email-threading.ts`
- Keep main send/reply functions focused

**Estimated Effort:** Low-Medium (1-2 hours)

### `app/api/cron/dispatcher/route.ts` (345 lines)
**Status:** 🟢 Lower Priority  
**Issues:**
- API route contains business logic
- Job execution logic embedded in route handler
- Multiple action types handled in one file

**Refactoring Plan:**
- Extract job execution → `lib/cron/job-executor.ts`
- Extract action handlers → `lib/cron/actions/` directory:
  - `notify-action.ts`
  - `webhook-action.ts`
- Keep route handler focused on HTTP concerns only

**Estimated Effort:** Low-Medium (1-2 hours)

### `components/settings/channel-settings.tsx` (263 lines)
**Status:** 🟢 Lower Priority  
**Issues:**
- Moderate size, relatively clean
- Could extract preference management logic
- Email address display logic could be reusable

**Refactoring Plan:**
- Extract preference management → `hooks/use-notification-preferences.ts`
- Extract email address display → `components/settings/agent-email-display.tsx`
- File is manageable but could be cleaner

**Estimated Effort:** Low (1 hour)

---

## Summary Statistics

- **Total Files Needing Refactoring:** 11
- **Critical Priority:** 1 file
- **High Priority:** 3 files
- **Medium Priority:** 4 files
- **Lower Priority:** 3 files

**Estimated Total Effort:** 20-30 hours

---

## Refactoring Guidelines

When refactoring these files, follow the patterns established in `.cursor/commands/refactor-file.md`:

1. **Extract Types & Interfaces** - Keep component-specific types inline, move shared types to `lib/types/`
2. **Extract Constants** - Move to `constants.ts` files
3. **Extract Pure Functions** - Move to utility files with single purpose
4. **Extract Hooks** - One hook per file for complex hooks
5. **Extract Components** - Move sub-components to their own files if reusable
6. **Extract Business Logic** - Move API calls and transformations to service files

### Naming Conventions
- Components: `kebab-case.tsx` (e.g., `task-dialog-header.tsx`)
- Utilities: `kebab-case.ts` (e.g., `email-validation.ts`)
- Hooks: `use-kebab-case.ts` (e.g., `use-project-activity.ts`)
- Types: Inline in component files, or in `lib/types/` for shared types

### File Organization
- Create directories when there are 3+ related files
- Use `index.ts` for barrel exports
- Keep related code close together
- Avoid creating files with fewer than 20 lines

---

## Notes

- Files in `lib/tools/_archive/` are already archived and don't need refactoring
- Some files may have been recently refactored (check git history)
- Prioritize files that are actively being modified
- Consider refactoring incrementally rather than all at once
