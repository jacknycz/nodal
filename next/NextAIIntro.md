# Nodal (Next.js) — AI & Architecture Guide

---

## Overview

**Nodal** is a collaborative mindmapping and brainstorming app, now built on a modern Next.js stack. The app enables users to visually map ideas, leverage AI for creative expansion, and enjoy a robust, cloud-synced experience. This document is the canonical reference for the Next.js version of Nodal—**the old Vite/CRA codebase is deprecated and should not be referenced for new work.**

---

## Project Goals

- 🚀 Deliver a seamless, real-time visual mindmapping experience on the web
- 🤖 Integrate AI for brainstorming, node generation, and context-aware suggestions
- 🧑‍💻 Prioritize maintainable, scalable, and idiomatic Next.js + React code
- ☁️ Use Supabase for authentication, board storage, and document uploads
- 🎨 Ensure delightful, accessible, and themeable UI/UX

---

## Key Tech Stack

- **Next.js** (App Router, SSR, API routes)
- **TypeScript** (strict mode, no `any`)
- **Zustand** (atomic, composable state slices)
- **XYFlow** (graph visualization, successor to React Flow)
- **Tailwind CSS** (utility-first, themeable design)
- **Supabase** (auth, database, file storage)
- **Framer Motion** (UI animation)
- **OpenAI API** (AI features, user-provided keys)

---

## Core Concepts

- **Board**: The main canvas, containing nodes and edges.
- **Node**: The atomic unit of content (idea, document, etc.).
- **Board Room**: The dashboard for managing boards.
- **Board Brief**: The object describing a new board's intent, topic, and AI setup.
- **Single Source of Truth**: All board data and logic now live in `next/src/features/board/`.

---

## Modern Board Creation Flow

- **Single Board, Single ID**: Every board is created with a unique UUID (generated up front in the modal).
- **No Double-Save Bugs**: The board ID is passed through all creation and save logic, and all updates use this ID. No more duplicate boards or race conditions.
- **Robust State Handling**: Board ID is managed via `useRef` to avoid React state setter issues and module cache bugs.
- **AI-Assisted or Blank**: Users can start with a blank board or let AI generate starter nodes, but the board ID and storage logic are unified.

---

## AI Integration Patterns

- **AI Context System**: Provided via React context (`aiContext.tsx`), available throughout the app.
- **Node AI**: AI-powered node generation, content suggestions, and brainstorming.
- **Document Processing**: Uploaded files are processed for text extraction and vectorization for AI context.
- **Pre-Session Chat**: Users can interact with AI before board creation to refine their goals.
- **Multi-Turn Memory**: AI maintains context across conversation turns using a message buffer.

---

## Debugging & Lessons Learned

- **Module Resolution**: All imports must reference the canonical Next.js codebase (`next/src/features/board/`). No legacy Vite/CRA code should be imported or referenced.
- **State Setters**: Avoid naming collisions and shadowing with React state setters. Prefer `useRef` for IDs that must never be functions.
- **Console Logging**: Use targeted debug logs when tracking down state or module bugs, but remove all logs before production.
- **Clean Imports**: Always use relative imports that resolve within the Next.js app structure. Avoid deep or ambiguous paths.

---

## Best Practices for Next.js Nodal

- **Atomic Components**: Keep components small, focused, and reusable.
- **Strict Typing**: Use TypeScript everywhere, with strictest settings.
- **Error Boundaries**: Handle errors gracefully, especially in async AI and storage flows.
- **Accessibility**: All interactive elements must be keyboard-accessible and theme-aware.
- **Cloud-First**: All board and document data is stored in Supabase; no local storage or legacy fallback.

---

## Recent Improvements

- **Board creation is now bulletproof**: No more double-saves, duplicate IDs, or race conditions.
- **AI setup is context-aware**: The AI receives the full board brief and user intent.
- **Debugging workflow is documented**: If you hit a "not a function" error, check for module cache, import paths, and state setter shadowing.
- **Vite/CRA code is deprecated**: All new work must be in the Next.js app.

---

## Contributing

- **Read this file before making changes!**
- **Ask questions if you’re unsure about the Next.js architecture or AI integration.**
- **Keep the codebase clean, modern, and idiomatic.**

---

*This document is the living source of truth for the Next.js version of Nodal. If you’re working on the app, start here!*
*If you have any actual questions - the maker on this project is Jack (he's writing this) - he's awesome and wants you to ask questions if you have them.*
