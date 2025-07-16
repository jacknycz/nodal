# Nodal — AI Context Guide

## Overview
**Nodal** is a collaborative mindmapping app designed for creative brainstorming, note-taking, and idea mapping. It combines a clean, fluid front-end with AI-driven interactions, allowing users to map thoughts visually and enhance them through AI suggestions.  
Built as a React app with a strong design system foundation, Nodal emphasizes speed, clarity, and delightful UX.

---

## Project Goals
- ✅ Deliver a seamless visual mindmapping experience on web
- ✅ Enable AI-powered brainstorming features (idea expansion, reframing, summarization)
- ✅ Keep the experience collaborative — multi-user support is a future goal
- ✅ Prioritize fast, intuitive UI interactions with meaningful micro-interactions and motion
- ✅ Maintain a clean, scalable codebase using modern React patterns

---

## Key Tech Stack & Conventions
- **React** — Functional components with hooks only
- **TypeScript** — Strict mode on, no `any` unless explicitly justified
- **Vite** — Dev/build tooling
- **Zustand** — Global state management (atomic, composable slices)
- **XYFlow** — For node graph visualization (successor to React Flow)
- **Tailwind CSS** — Design system + utility-first styling
- **Pres Start** — Our internal design system (React components + Tailwind + icon set)
- **Supabase** — Authentication, database, and cloud storage

---

## Core Concepts & Mental Model
- **Board** — The main canvas. A Board contains Nodes.
- **Node** — The atomic unit of content on a Board.
- **Board Room** — The dashboard where users manage saved Boards and Board Templates.
- **Board Members** — Collaborative users in multi-user sessions.

---

## Storage & Data Management
- **Supabase Integration** — Cloud storage for boards and documents with RLS policies
- **Board Data Structure** — `SavedBoard` type with nodes, edges, viewport, metadata
- **Storage Migration** — Moved from LocalForage to Supabase for cloud sync
- **File Uploads** — Document processing for AI context (PDFs, text files)
- **Autosave** — Real-time board saving with hash-based change detection
- **Board Metadata** — Name, lastModified, nodeCount, edgeCount for list views

---

## AI Features & Integration
- **AI Context System** — `aiContext.tsx` provides AI services throughout the app
- **Node AI** — AI-powered node generation and content suggestions
- **Document Processing** — Text extraction and vectorization for AI context
- **Board Setup Flow** — AI-guided board creation with topic, goal, audience
- **Pre-session Chat** — AI conversation before board creation
- **Brainstorming** — AI-generated mindmap structures from context
- **Context Analysis** — AI analyzes board state for relevant suggestions
- **Multi-step Actions** — Complex AI operations broken into manageable steps

---

## AI Integration Philosophy for Nodal App itself
- AI should feel like a **helpful collaborator**, not a takeover agent.
- Prioritize **context-aware suggestions** — AI responses should respect the user's Board state.
- Avoid hallucinated content — ground suggestions in user-provided data.
- Maintain tone consistent with the app's friendly, creative vibe. We want knowledgeable, expert level peer and collaborator.
- AI features are powered by user-provided API keys or future OAuth integration.

---

## Design Principles
- **Motion Matters** — Use animation deliberately (Framer Motion for UI)
- **Keep It Light** — Avoid UI clutter; prioritize clarity
- **Composable** — Components should be small, reusable, and easy to extend
- **Themeable** — Pres Start theming via Tailwind presets
- **Glassmorphism** — Semi-transparent elements with backdrop blur for modern look (in dark mode mostly)

---

## Known Constraints / Decisions
- XYFlow is used in place of React Flow for better flexibility with edges and nodes.
- Zustand is preferred over Redux for simplicity.
- Strict adherence to TypeScript's strictest settings.
- Tailwind v4+ is being adopted — some legacy styles from Pres Start v3 remain.
- Canvas-based animations for performance (particle effects, backgrounds)

---

## Authentication & User Management
- **Supabase** — Authentication provider with Google OAuth
- **User Flow** — Login → Board Room → Board Editor
- **User Data** — Google profile (name, email, avatar) integrated throughout UI
- **Session Management** — Automatic auth state detection and routing
- **Auth Utils** — `authUtils.ts` provides user state and auth functions

---

## Navigation & Routing Patterns
- **View State Management** — `currentView` state controls Board Room vs Board Editor
- **Landing Page** — Board Room serves as dashboard/landing page after login
- **Board Room** — Full-page dashboard, not a modal (separate from board editor)
- **Navigation Flow** — Login → Board Room → Board → Board Room (via topbar)
- **Modal Navigation** — Proper escape routes and cancel handling in multi-step flows

---

## Component Architecture
- **Board Room** — `src/components/BoardRoom.tsx` (full-page dashboard)
- **Login Screen** — `src/components/LoginScreen.tsx` (dual sign-in/sign-up with animated background)
- **Avatar Menu** — `src/components/AvatarMenu.tsx` (user menu with Google avatar)
- **Storage Integration** — Board data managed via `src/features/storage/supabaseStorage.ts`
- **Modal System** — Consistent modal patterns (BoardNameModal, BoardSetupModal)
- **Animated Backgrounds** — Canvas-based particle animations for visual appeal

---

## Component-Specific Patterns
- **Modal Management** — Consistent modal patterns (BoardNameModal, BoardSetupModal)
- **Form Validation** — Real-time validation with error states and user feedback
- **Loading States** — Consistent loading indicators and skeleton states
- **Error Boundaries** — Graceful error handling with user-friendly messages
- **Theme Integration** — Dark/light mode support across all components
- **Canvas Animations** — Performance considerations for background effects

---

## Recent UX Improvements
- **Board Room as Hub** — Central dashboard for all board management
- **New Board Flow** — Create → Name → Setup → AI Generation
- **Navigation Patterns** — Seamless transitions between Board Room and Board Editor
- **Cancel Handling** — Proper escape routes from multi-step flows
- **Animated Backgrounds** — Canvas-based particle animations for visual appeal
- **Glassmorphism Effects** — Semi-transparent cards with backdrop blur

---

## Current Implementation Notes
- **Board Room** — Landing page with board management, user welcome, create/open actions
- **Authentication** — Google OAuth with email/password fallback
- **User Experience** — Personalized with Google profile data (name, avatar)
- **Board Management** — Create, open, rename, delete boards with real-time updates
- **Theme Integration** — Full dark/light mode support with Nodal branding
- **Cloud Storage** — Supabase integration for board persistence and sync

---

## Development Patterns
- **State Management** — View state (`boardroom` | `board`) controls app routing
- **Event Handling** — Custom events for board operations (save, export, etc.)
- **Storage** — Supabase-based board storage with metadata
- **Error Handling** — Graceful fallbacks for auth failures and storage errors
- **Component Creation** — New components should follow existing patterns
- **State Updates** — Use Zustand slices for global state, local state for UI
- **Performance** — Lazy loading, memoization, and efficient re-renders

---

## Development Workflow
- **Component Creation** — New components should follow existing patterns
- **State Updates** — Use Zustand slices for global state, local state for UI
- **Event Handling** — Custom events for cross-component communication
- **Type Safety** — Strict TypeScript with proper interfaces and types
- **Performance** — Lazy loading, memoization, and efficient re-renders

---

## Common Gotchas
- **XYFlow Integration** — Node/edge management patterns and event handling
- **Canvas Animations** — Performance considerations for background effects
- **Supabase Queries** — Proper error handling and loading states
- **Theme Switching** — Ensuring all components respond to theme changes
- **Mobile Responsiveness** — Touch interactions and responsive layouts
- **Modal State Management** — Proper cleanup and state reset
- **AI Context Dependencies** — Managing async AI operations and loading states

---

## When You're Helping Me:
- Write idiomatic, modern React + TypeScript code
- Keep code readable, maintainable, and clearly organized by feature/slice
- Favor functional, atomic components over monoliths
- Respect UX decisions and motion patterns — avoid overcomplicated interactions
- Suggest AI features that feel natural within a brainstorming/mindmapping flow
- If unsure, ask for clarification before assuming app behavior
- Consider performance implications of animations and AI operations
- Maintain consistent error handling and loading states

---

## Bonus — Things I Like Seeing in PRs:
- Thoughtful comments explaining *why* a decision was made
- Clean, consistent formatting (Prettier + ESLint)
- Avoidance of premature abstractions
- Minimal, meaningful animations
- Light use of Framer Motion for subtle transitions
- Proper TypeScript types and interfaces
- Consistent error handling patterns

---


*This file is here to help AI agents, copilots, or teammates get aligned before contributing to Nodal. When in doubt, ask Jack.*