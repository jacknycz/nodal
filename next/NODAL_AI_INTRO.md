# Nodal (Next.js) — AI & Architecture Guide

---

## Overview

**Nodal** is a collaborative mindmapping and brainstorming app, now built on a modern Next.js stack. The app enables users to visually map ideas, leverage AI for creative expansion, and enjoy a robust, cloud-synced experience with automatic thumbnail generation. This document is the canonical reference for the Next.js version of Nodal—**the old Vite/CRA codebase is deprecated and should not be referenced for new work.**

---

## Project Goals

- 🚀 Deliver a seamless, real-time visual mindmapping experience on the web
- 🤖 Integrate AI for brainstorming, node generation, and context-aware suggestions
- 🧑‍💻 Prioritize maintainable, scalable, and idiomatic Next.js + React code
- ☁️ Use Supabase for authentication, board storage, document uploads, and thumbnail storage
- 🎨 Ensure delightful, accessible, and themeable UI/UX
- 🔄 Real-time collaboration and cloud synchronization
- 📱 Responsive design that works across all devices
- 🖼️ Automatic thumbnail generation for board previews

---

## Key Tech Stack

- **Next.js** (App Router, SSR, API routes)
- **TypeScript** (strict mode, no `any`)
- **Zustand** (atomic, composable state slices)
- **XYFlow** (graph visualization, successor to React Flow)
- **Tailwind CSS** (utility-first, themeable design)
- **Supabase** (auth, database, file storage, thumbnail storage)
- **Framer Motion** (UI animation)
- **OpenAI API** (AI features, user-provided keys)
- **Lucide React** (icon library)
- **Date-fns** (date manipulation)
- **Canvas API** (client-side thumbnail generation)

---

## Core Concepts

- **Board**: The main canvas, containing nodes and edges.
- **Node**: The atomic unit of content (idea, document, etc.).
- **Board Room**: The dashboard for managing boards with thumbnail previews.
- **Board Brief**: The object describing a new board's intent, topic, and AI setup.
- **Single Source of Truth**: All board data and logic now live in `next/src/features/board/`.
- **Focus Tree**: Hierarchical organization system for nodes and ideas.
- **AI Context**: Persistent memory system for AI conversations and suggestions.
- **Thumbnail System**: Automatic generation and storage of board previews using Canvas API and Supabase storage.

---

## Modern Board Creation Flow

- **Single Board, Single ID**: Every board is created with a unique UUID (generated up front in the modal).
- **No Double-Save Bugs**: The board ID is passed through all creation and save logic, and all updates use this ID. No more duplicate boards or race conditions.
- **Robust State Handling**: Board ID is managed via `useRef` to avoid React state setter issues and module cache bugs.
- **AI-Assisted or Blank**: Users can start with a blank board or let AI generate starter nodes, but the board ID and storage logic are unified.
- **Pre-Session Chat**: Users can refine their board intent through AI conversation before creation.
- **Automatic Thumbnails**: Board thumbnails are generated and saved automatically when boards are saved.

---

## AI Integration Patterns

- **AI Context System**: Provided via React context (`aiContext.tsx`), available throughout the app.
- **Node AI**: AI-powered node generation, content suggestions, and brainstorming.
- **Document Processing**: Uploaded files are processed for text extraction and vectorization for AI context.
- **Pre-Session Chat**: Users can interact with AI before board creation to refine their goals.
- **Multi-Turn Memory**: AI maintains context across conversation turns using a message buffer.
- **Context-Aware Suggestions**: AI provides relevant suggestions based on current board state and user history.
- **Batch Operations**: AI can perform multiple operations across nodes simultaneously.

---

## State Management Architecture

- **Zustand Slices**: Atomic, composable state management with clear separation of concerns
- **Board Store**: Centralized board state with optimistic updates and conflict resolution
- **AI Store**: Manages AI context, settings, and conversation state
- **Focus Store**: Handles hierarchical focus tree and navigation state
- **Theme Store**: Manages dark/light mode and UI preferences

---

## File Structure & Organization

```
next/src/
├── app/                    # Next.js App Router pages and API routes
├── components/             # Reusable UI components
├── features/              # Feature-based organization
│   ├── ai/               # AI integration and context
│   ├── auth/             # Authentication and Supabase client
│   ├── board/            # Board management and XYFlow integration
│   ├── focus/            # Focus tree and navigation
│   ├── nodes/            # Node types and rendering
│   └── storage/          # Supabase storage and data persistence
├── hooks/                # Custom React hooks
├── contexts/             # React contexts (theme, etc.)
└── utils/                # Utility functions
```

---

## Thumbnail System Architecture

- **Client-Side Generation**: Uses Canvas API to create board previews without server-side rendering
- **Automatic Triggers**: Thumbnails are generated when boards transition from 'saving' to 'saved' state
- **Supabase Storage**: Thumbnails stored in dedicated `thumbnails` bucket with simplified RLS policies
- **BoardRoom Integration**: Thumbnails display in BoardRoom with loading states and error handling
- **Canvas Rendering**: Simplified board representation with title, node count, and visual node layout
- **Fallback Handling**: Clean UI when thumbnails are unavailable (no placeholder text)

---

## UI/UX Improvements

- **Clean Avatar Menu**: Removed unused import/export functionality for streamlined user experience
- **Centered Tips**: Drag & drop tips positioned bottom-center for better visibility
- **Responsive Design**: All components work seamlessly across desktop and mobile devices
- **Theme Consistency**: Dark/light mode support throughout all components
- **Loading States**: Proper feedback during thumbnail generation and board operations

---

## Debugging & Lessons Learned

- **Module Resolution**: All imports must reference the canonical Next.js codebase (`next/src/features/board/`). No legacy Vite/CRA code should be imported or referenced.
- **State Setters**: Avoid naming collisions and shadowing with React state setters. Prefer `useRef` for IDs that must never be functions.
- **Console Logging**: Use targeted debug logs when tracking down state or module bugs, but remove all logs before production.
- **Clean Imports**: Always use relative imports that resolve within the Next.js app structure. Avoid deep or ambiguous paths.
- **Supabase Storage**: Simplified RLS policies (`true` for both INSERT and SELECT) work reliably for thumbnail storage.
- **Canvas API**: Prefer Canvas API over html2canvas for client-side image generation to avoid CSS parsing issues.
- **Error Handling**: Graceful fallbacks when thumbnails fail to load or generate.

---

## Best Practices for Next.js Nodal

- **Atomic Components**: Keep components small, focused, and reusable.
- **Strict Typing**: Use TypeScript everywhere, with strictest settings.
- **Error Boundaries**: Handle errors gracefully, especially in async AI and storage flows.
- **Accessibility**: All interactive elements must be keyboard-accessible and theme-aware.
- **Cloud-First**: All board and document data is stored in Supabase; no local storage or legacy fallback.
- **Thumbnail Optimization**: Use Canvas API for reliable client-side image generation without external dependencies.
- **UI Simplification**: Remove unused features to keep the interface clean and focused.

---

## Recent Improvements

- **Board creation is now bulletproof**: No more double-saves, duplicate IDs, or race conditions.
- **AI setup is context-aware**: The AI receives the full board brief and user intent.
- **Debugging workflow is documented**: If you hit a "not a function" error, check for module cache, import paths, and state setter shadowing.
- **Vite/CRA code is deprecated**: All new work must be in the Next.js app.
- **Thumbnail system is live**: Automatic board preview generation using Canvas API and Supabase storage.
- **Robust storage architecture**: Simplified RLS policies for reliable thumbnail storage.
- **Clean UI**: Removed unused import/export functionality and improved tip positioning.
- **Error resilience**: Graceful handling of thumbnail failures and loading states.

---

## Contributing

- **Read this file before making changes!**
- **Ask questions if you're unsure about the Next.js architecture or AI integration.**
- **Keep the codebase clean, modern, and idiomatic.**
- **Test thumbnail generation when making board-related changes.**
- **Focus on core functionality**: Remove unused features to maintain clean UI.

---

*This document is the living source of truth for the Next.js version of Nodal. If you're working on the app, start here!*
*If you have any actual questions - the maker on this project is Jack (he's writing this) - he's awesome and wants you to ask questions if you have them.*
