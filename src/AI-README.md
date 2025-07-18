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
- **Conversation Buffer** — Last 10 messages maintained for multi-turn context awareness
- **Intent Tracking** — Pending questions (e.g., location requests) tracked and fulfilled
- **Google Places Integration** — Real local business search via `searchPlacesGoogle()` utility
- **Smart Follow-ups** — AI recognizes when users provide missing info and fulfills original requests

---

## Conversational AI Patterns
- **Multi-turn Memory** — AI maintains context across conversation turns using message buffer
- **Intent Fulfillment** — When AI asks for info (location, details), tracks pending intent and fulfills when user provides it
- **Context-Aware Responses** — AI considers board state, selected nodes, and conversation history
- **Real Action Integration** — Conversational requests trigger actual API calls (Google Places, node creation)
- **Fallback Handling** — Graceful degradation when APIs are unavailable (hypothetical examples)
- **Conversation Flow** — Natural progression from questions → clarifications → actions → results

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

## Document AI Flow

Here’s how documents become searchable and useful for AI in Nodal:

1. **Upload**
   - User uploads a document (PDF, text, Word, image, etc.)
   - File is validated for type and size

2. **Extraction**
   - Text is extracted from the document (if possible)
   - Extraction errors are handled and surfaced in the UI

3. **Vectorization**
   - Extracted text is converted to embeddings (vector representations)
   - Embeddings are stored in the app state for semantic search

4. **Node Creation**
   - A Document Node is created on the board
   - Node contains metadata, extracted text, status, and a reference to the document

5. **AI Context**
   - When you chat with the AI, the most recent document nodes (with snippets) are included in the prompt context
   - Node Aware mode and other AI features can reference document content

6. **Search/Reference**
   - You can “search” documents by asking the AI in chat
   - The AI uses the included snippets to answer, summarize, or connect ideas

```mermaid
graph TD;
  A[Upload Document] --> B[Extract Text]
  B --> C[Vectorize (Embeddings)]
  C --> D[Create Document Node]
  D --> E[AI Context (Prompt)]
  E --> F[AI Search/Reference]
```

*For full-document search or advanced retrieval, see future roadmap!*

---

## Recent Implementation Notes & Patterns

### Node Layout & Positioning
- **Mind Map Layout:**
  - Nodal uses a custom fan/radial mind map layout for all node positioning. Nodes are spaced based on their connections, radiating out from the root or parent node. See `layoutMindMap` in `Board.tsx` for the core algorithm. All batch node sets (AI brainstorm, document upload, board import) use this layout for consistency.
- **Single Node Placement:**
  - Single nodes (e.g., manual add) are placed at the viewport center or near the selected node.

### Handle Visibility Pattern
- **UX Pattern:**
  - Node connection handles are hidden by default and only appear on node hover, using Tailwind’s `group-hover` utility. See `NodalNode.tsx` for the implementation.

### AI Node Generation
- **Positioning:**
  - AI-generated nodes use a simple fallback positioning for now, but can be upgraded to use the mind map layout for more contextual placement.

### Refactoring/Tech Debt
- **Legacy Positioning Utilities:**
  - The old `findIntelligentPositions` utility has been fully removed in favor of the new layout. If you see any references to it, they should be cleaned up.

### How to Add New Node Types
- To add a new node type, create a new component in `src/features/nodes/`, register it in `Board.tsx`, and follow the same patterns for handles, hover, and content editing.

### Testing Layout Changes
- After changing layout logic, test with:
  - Large boards (20+ nodes)
  - Deeply nested/branched mind maps
  - Boards with disconnected nodes
  - Document uploads and AI brainstorm flows

### Troubleshooting
- **Handles Always Visible:**
  - If node handles are always visible, ensure the `group` class is on the main node container and not duplicated on children. Handles should use `opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto`.

### AI/Agent Collaboration
- If you’re an AI agent or copilot, always check for existing layout and UX patterns before introducing new ones. Consistency is key!

---

## PDF.js, react-pdf, and Vite Integration: Lessons Learned

### Why this section?
If you are adding or maintaining PDF viewing or text extraction in Nodal, read this first! The PDF.js/react-pdf/Vite ecosystem is full of versioning and worker pitfalls. Here’s what we learned (the hard way):

### Key Lessons
- **PDF.js main and worker versions must match exactly.**
  - If you see errors like `The API version "X" does not match the Worker version "Y"`, your worker file and `pdfjs-dist` version are mismatched.
- **The public worker approach is the most robust for Vite.**
  - Place the correct `pdf.worker.min.js` in your `public/` directory.
  - Set: `pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'` in both your viewer and extraction code.
- **react-pdf and pdfjs-dist versions must be compatible.**
  - As of 2024, `react-pdf@7.x` + `pdfjs-dist@3.x` + React 18 is stable.
  - React 19 is not yet officially supported by react-pdf 7.x/8.x.
- **Blob URLs work, but don’t revoke them until the viewer is done.**
- **If the viewer works in isolation but not in your app, check for prop/lifecycle issues.**
- **If you see a timeout with no errors, it’s almost always a version or worker mismatch.**

### Troubleshooting Checklist
- [ ] Is the worker file in `public/pdf.worker.min.js` the exact same version as your installed `pdfjs-dist`?
- [ ] Are you using `pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'` everywhere?
- [ ] Are you on React 18, not 19+?
- [ ] Is your `react-pdf` version compatible with your `pdfjs-dist` version?
- [ ] Does a minimal viewer (see `TestPDF.tsx`) work with a static file?
- [ ] Are you passing a valid, non-revoked blob URL to the viewer?
- [ ] Are there any errors in the browser console?

### Final Working Setup (2025)
- React 18.3.x
- react-pdf 7.7.x
- pdfjs-dist 3.11.x
- `/public/pdf.worker.min.js` (from the same version as installed pdfjs-dist)
- `pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'`
- Minimal viewer for debugging: see `src/TestPDF.tsx`

### If you get stuck
- Check the version of `pdfjs-dist` in `node_modules` and download the matching worker from unpkg.
- Try a minimal viewer with a static file to isolate the problem.
- If you see a timeout and everything else looks right, it’s almost always a version mismatch.
- If you upgrade React or react-pdf, re-check all of the above.

---

*This section was added after a multi-day debugging marathon. If you’re reading this, you’re already smarter than we were!*

---


*This file is here to help AI agents, copilots, or teammates get aligned before contributing to Nodal. When in doubt, ask Jack.*