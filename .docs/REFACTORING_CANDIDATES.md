# Refactoring Candidates

This document lists all files in the codebase that need refactoring based on size, complexity, and separation of concerns. Files are organized by priority and include specific refactoring recommendations.

**Last Updated:** February 3, 2026

## ✅ Completed Refactorings

### `lib/inngest/functions/process-email.ts` ✅
**Status:** ✅ Complete (Feb 3, 2026)  
**Before:** 875 lines  
**After:** 272 lines (69% reduction)

**Extracted Files:**
- ✅ `lib/inngest/functions/email-context-prompt.ts` (140 lines) - Email context prompt builder
- ✅ `lib/inngest/functions/email-conversation.ts` (98 lines) - Conversation management
- ✅ `lib/tools/email-agent-tools.ts` (306 lines) - Email-specific linking tools

**Improvements:**
- Now uses tool registry pattern (consistent with chat endpoint)
- Clear separation of concerns: prompt building, conversation management, and tool orchestration
- All functionality preserved, no breaking changes
- No linter errors

---

### `components/projects/project-detail.tsx` ✅
**Status:** ✅ Complete (Feb 3, 2026)  
**Before:** 741 lines  
**After:** 372 lines (50% reduction)

**Extracted Hooks:**
- ✅ `hooks/use-project-activity.ts` (81 lines) - Activity fetching and management
- ✅ `hooks/use-project-comments.ts` (57 lines) - Comment creation and updates
- ✅ `hooks/use-create-task.ts` (65 lines) - Task creation logic

**Extracted Sub-Components:**
- ✅ `components/projects/project-detail-header.tsx` (162 lines) - Header with edit controls
- ✅ `components/projects/project-detail-description.tsx` (47 lines) - Description display/editing
- ✅ `components/projects/project-detail-tasks.tsx` (91 lines) - Task list section
- ✅ `components/projects/project-detail-activity.tsx` (154 lines) - Activity sidebar

**Improvements:**
- Clean separation of UI concerns
- Reusable hooks for activity, comments, and task creation
- Each sub-component has a single responsibility
- All functionality preserved, no breaking changes
- No linter errors

---

## Priority 1: Critical Refactoring (Very Large Files)

_No critical refactorings remaining!_

---

## Priority 2: High Priority (Large Components & Complex Logic)

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

- **Total Files Needing Refactoring:** 9 remaining (2 completed ✅)
- **Completed:** 2 files ✅
- **Critical Priority:** 0 files (all complete!)
- **High Priority:** 2 files
- **Medium Priority:** 4 files
- **Lower Priority:** 3 files

**Progress:**
- ✅ Completed: 2 files (~1,600 lines refactored)
- ⏳ Remaining: 9 files
- 🎯 Estimated Remaining Effort: 12-18 hours

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
