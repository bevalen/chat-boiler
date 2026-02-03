/*
Command: Refactor File For Maintainability

CONTEXT:
This command helps refactor large, unwieldy files into smaller, more maintainable modules following best practices.

INSTRUCTIONS:

1. ANALYZE CURRENT STATE
   - Read the entire file and understand its purpose
   - Identify all imports, exports, types, interfaces, functions, and components
   - Note dependencies between different parts of the code
   - Check for any circular dependency risks

2. IDENTIFY CONCERNS & RESPONSIBILITIES
   - List all distinct responsibilities/concerns in the file
   - Group related functions, types, and logic together
   - Identify shared utilities, constants, and types
   - Note any code that could be reused across the codebase

3. PLAN THE REFACTORING
   - Determine the file structure (new files and their purposes)
   - Follow these naming conventions (matching this codebase):
     * Components: kebab-case (e.g., `chat-interface.tsx`, `task-dialog.tsx`)
     * Utilities: kebab-case (e.g., `email-utils.ts`, `resend-client.ts`)
     * Hooks: kebab-case with `use-` prefix (e.g., `use-conversation.ts`, `use-email.ts`)
     * Types: Usually inline in component files, or in `lib/types/` for shared types
     * Barrel exports: `index.ts` for re-exporting (e.g., `components/shared/index.ts`)
   - Create a directory when there are multiple related files (typically 3+)
   - Keep the original file as the main entry point if it's imported elsewhere
   - Use `_archive/` subdirectory for old versions if needed (e.g., `lib/tools/_archive/`)

4. EXTRACTION STRATEGY
   Apply these refactoring patterns in order:
   
   a) Extract Types & Interfaces
      - Keep component-specific types inline in component files (this codebase pattern)
      - Move truly shared types to `lib/types/` directory (e.g., `lib/types/database.ts`)
      - Export types from barrel exports if needed (e.g., `export type { Task, Project } from "./task-dialog"`)
   
   b) Extract Constants & Configuration
      - Move constants to a `constants.ts` file
      - Group related constants together
   
   c) Extract Pure Functions & Utilities
      - Move helper functions to utility files
      - Each utility file should have a single, clear purpose
      - Use descriptive names (e.g., `validation-utils.ts`, `formatting-utils.ts`)
   
   d) Extract Hooks
      - Move custom hooks to separate files
      - One hook per file for complex hooks
      - Related simple hooks can be grouped
   
   e) Extract Components
      - Move sub-components to their own files if they're reusable
      - Keep small, tightly-coupled components in the same file
      - Create a components subdirectory if needed
   
   f) Extract Business Logic
      - Move API calls, data transformations, and business rules to service/logic files
      - Keep UI concerns separate from business logic
      - For tools that need context (e.g., Supabase client, agentId), use factory functions:
        ```typescript
        export function createProjectTools(context: ProjectToolContext) {
          const { agentId, supabase } = context;
          return { createProject: tool({...}), ... };
        }
        ```
      - For tools that need context (e.g., Supabase client, agentId), use factory functions:
        ```typescript
        export function createProjectTools(context: ProjectToolContext) {
          const { agentId, supabase } = context;
          return { createProject: tool({...}), ... };
        }
        ```

5. MAINTAIN CODE QUALITY
   - Preserve all functionality (no behavior changes)
   - Keep related code close together
   - Avoid creating overly granular files (minimum 20-30 lines per file)
   - Ensure each file has a single, clear responsibility
   - Update imports/exports to maintain the public API
   - Add JSDoc comments to exported functions for clarity

6. FILE ORGANIZATION
   For component refactoring (matching this codebase):
   ```
   components/
     feature-name/
       feature-name.tsx         (main component, kebab-case)
       sub-component.tsx        (sub-components, kebab-case)
       index.ts                 (barrel export, optional)
   ```
   Example: `components/chat/` contains:
   - `chat-interface.tsx` (main)
   - `chat-header.tsx`, `message-bubble.tsx`, etc. (sub-components)
   - Types are inline in component files
   
   For utility/lib refactoring:
   ```
   lib/
     feature-name/
       index.ts                 (barrel exports)
       [concern].ts             (specific utilities, kebab-case)
       _archive/                (old versions, optional)
   ```
   Example: `lib/email/` contains:
   - `index.ts` (barrel exports)
   - `resend-client.ts`, `send-email.ts`, `signature-template.ts`
   - Shared types in `lib/types/` if needed

7. UPDATE IMPORTS
   - Use barrel exports (`index.ts`) to simplify imports when appropriate
   - Update all import paths in dependent files
   - Prefer named exports over default exports (this codebase pattern)
   - Use absolute imports with `@/` prefix (configured in tsconfig.json)
     * Example: `import { TaskDialog } from "@/components/shared/task-dialog"`
   - Use factory functions for tools that need context (e.g., `createProjectTools(context)`)

8. VERIFICATION
   - Check that no functionality is broken
   - Verify all types are properly imported
   - Ensure no circular dependencies were introduced
   - Run linter and fix any issues
   - Confirm the refactored code is more maintainable

9. DOCUMENT CHANGES
   - Add brief comments explaining complex extractions
   - Update any README files if the file structure changed significantly
   - Note any breaking changes in import paths

PRINCIPLES TO FOLLOW:
- Single Responsibility Principle: Each file should do one thing well
- Don't Repeat Yourself (DRY): Extract common patterns
- Keep It Simple (KISS): Don't over-engineer the solution
- Separation of Concerns: UI, logic, and data should be separate
- Locality: Keep related code close together
- Progressive Enhancement: Refactor incrementally, test frequently

WHAT NOT TO DO:
- Don't create files with fewer than 20 lines (too granular)
- Don't break up tightly coupled logic
- Don't change functionality during refactoring
- Don't create circular dependencies
- Don't over-abstract early (wait for patterns to emerge)
- Don't refactor without understanding the code first
- Don't use PascalCase for component filenames (use kebab-case)
- Don't create separate `.types.ts` files for component-specific types (keep inline)
- Don't use relative imports when `@/` absolute imports are available

OUTPUT:
1. Show me the proposed file structure with brief descriptions
2. Create the new files with the extracted code
3. Update the original file
4. Update all import statements in dependent files
5. Run the linter on all modified files
6. Provide a summary of what was refactored and why

*/