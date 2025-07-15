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

---

## Core Concepts & Mental Model
- **Board** — The main canvas. A Board contains Nodes.
- **Node** — The atomic unit of content on a Board.
- **Board Room** — The dashboard where users manage saved Boards and Board Templates.
- **Board Members** — Collaborative users in multi-user sessions.

---

## AI Integration Philosophy for Nodal App itself
- AI should feel like a **helpful collaborator**, not a takeover agent.
- Prioritize **context-aware suggestions** — AI responses should respect the user’s Board state.
- Avoid hallucinated content — ground suggestions in user-provided data.
- Maintain tone consistent with the app’s friendly, creative vibe. We want knowledgeable, expert level peer and collaborator.
- AI features are powered by user-provided API keys or future OAuth integration.

---

## Design Principles
- **Motion Matters** — Use animation deliberately (Framer Motion for UI)
- **Keep It Light** — Avoid UI clutter; prioritize clarity
- **Composable** — Components should be small, reusable, and easy to extend
- **Themeable** — Pres Start theming via Tailwind presets

---

## Known Constraints / Decisions
- XYFlow is used in place of React Flow for better flexibility with edges and nodes.
- Zustand is preferred over Redux for simplicity.
- Strict adherence to TypeScript’s strictest settings.
- Tailwind v4+ is being adopted — some legacy styles from Pres Start v3 remain.

---

## When You're Helping Me:
- Write idiomatic, modern React + TypeScript code
- Keep code readable, maintainable, and clearly organized by feature/slice
- Favor functional, atomic components over monoliths
- Respect UX decisions and motion patterns — avoid overcomplicated interactions
- Suggest AI features that feel natural within a brainstorming/mindmapping flow
- If unsure, ask for clarification before assuming app behavior

---

## Bonus — Things I Like Seeing in PRs:
- Thoughtful comments explaining *why* a decision was made
- Clean, consistent formatting (Prettier + ESLint)
- Avoidance of premature abstractions
- Minimal, meaningful animations
- Light use of Framer Motion for subtle transitions

---

*This file is here to help AI agents, copilots, or teammates get aligned before contributing to Nodal. When in doubt, ask Jack.*