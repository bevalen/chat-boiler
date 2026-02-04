# Agent Skills for Chat Boiler

This document lists recommended Agent Skills from [skills.sh](https://skills.sh) to install for working with this boilerplate. These skills provide specialized knowledge and best practices for the technologies used.

## What are Agent Skills?

Agent Skills are reusable capabilities for AI coding agents (like Cursor, Claude Code, Windsurf, etc.) that provide procedural knowledge, best practices, and patterns. They help agents understand when and how to use specific technologies effectively.

Install skills with: `npx skills add <owner/repo> --skill <skill-name>`

## Recommended Skills

### Core Skills

**AI SDK (Vercel)**
```bash
npx skills add vercel/ai --skill ai-sdk
```
Provides best practices and patterns for using Vercel AI SDK, including streaming, tool calling, and gateway usage.

**Supabase PostgreSQL Best Practices**
```bash
npx skills add supabase/agent-skills --skill supabase-postgres-best-practices
```
Covers Supabase database patterns, RLS policies, vector operations, and PostgreSQL best practices.

**Next.js Best Practices**
```bash
npx skills add vercel-labs/next-skills --skill next-best-practices
```
Provides Next.js App Router patterns, caching strategies, and best practices for Next.js 15+.

**React Best Practices (Vercel)**
```bash
npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices
```
Covers React patterns, hooks, component design, and React 19 best practices.

### Optional Skills

**Find Skills (Meta)**
```bash
npx skills add vercel-labs/skills --skill find-skills
```
Helps discover and install additional skills from the skills.sh registry.

**Web Design Guidelines**
```bash
npx skills add vercel-labs/agent-skills --skill web-design-guidelines
```
Provides UI/UX best practices and design patterns for web applications.

## Installation

Run the commands above in your terminal. Skills will be available to your AI coding agent (Cursor, Claude Code, etc.) when working on this project.

## Browse More Skills

Visit [skills.sh](https://skills.sh) to discover additional skills for:
- TypeScript patterns
- Testing strategies
- Database design
- API design
- And much more

## Note

These skills are optional but recommended for better AI assistance when developing features or debugging issues in this boilerplate. They help agents understand the specific patterns and best practices used in this codebase.
