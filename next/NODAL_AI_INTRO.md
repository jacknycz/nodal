# Nodal — Developer Guide (Canonical)

This is the **canonical developer guide** for Nodal’s Next.js app. It’s written for human developers and AI coding agents to:

- Understand what Nodal is (product + UX invariants)
- Know **where** code lives
- Make changes safely without breaking core flows (placement, AI, uploads, story mode)

**Scope**: The active codebase is under `next/`. Do not reference legacy Vite/CRA code.

---

## Table of contents

- Quick start (local dev)
- Tech stack snapshot
- Repo map (where things live)
- Board data model + state
- Placement & layout (ELK)
- AI (client + server routing, models)
- Board creation + AI generation routes
- Story mode (events, settings, completion)
- Node types (how to add/change)
- Supabase touchpoints
- Where to change X (common tasks)
- Development guidelines

---

## Quick start (local dev)

### Requirements
- Node.js (project uses Next.js 15 + React 19)
- A Supabase project (Auth + DB + Storage)

### Commands
From `next/`:

```bash
npm install
npm run dev
```

Build (catches prod-only issues):

```bash
npm run build
```

### Minimal environment variables

Required for app auth/data:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

AI routing options:
- Preferred: `AI_GATEWAY_API_KEY` (Vercel AI Gateway; supports provider-prefixed model ids)
- Fallback: `OPENAI_API_KEY` (direct OpenAI)

Optional (used by some generation routes):
- `UNSPLASH_ACCESS_KEY` or `NEXT_PUBLIC_UNSPLASH_ACCESS_KEY`
- `YOUTUBE_API_KEY`

---

## Tech stack snapshot (current)

- **Next.js** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **Zustand** (board/global state)
- **XYFlow** (`@xyflow/react`) (node/edge canvas)
- **ELK** (`elkjs`) (layered/hierarchy layout)
- **Supabase** (auth + database + storage)
- **TipTap** (rich text editing)
- **Phosphor Icons** (primary icon set; TipTap uses `lucide-react` where needed)

---

## Repo map (where things live)

### High-signal directories

- `next/src/features/board/`
  - The board runtime: XYFlow wiring, node/edge orchestration, placement, story mode, keyboard shortcuts.
- `next/src/features/nodes/`
  - Node React components by type (text/media/doc/etc).
- `next/src/features/ai/`
  - Client-side AI service, model metadata, prompt/context shaping.
- `next/app/api/`
  - Server routes (AI proxy, board generation endpoints, document extraction, etc).
- `next/src/components/`
  - Shared UI components + LeftDock + modals.

### “Single source of truth” rule

When you’re unsure where to change behavior:

- **Board/canvas logic** → `next/src/features/board/BoardComponent.tsx`
- **Placement/layout** → `next/src/features/board/placementEngine.ts` and `layoutAlgorithms.ts`
- **Node rendering** → `next/src/features/nodes/*`
- **AI provider routing** → `next/app/api/ai/chat/completions/route.ts`

---

## Board state & data model (practical)

### Board store
Nodal uses Zustand for board state:
- `next/src/features/board/boardSlice.ts`

Key properties you’ll see frequently:
- `nodes: BoardNode[]`
- `edges: BoardEdge[]`
- `selectedNodeIds: string[]` (multi-select)
- `viewport: { x; y; zoom }`
- `connectingSourceId` (connection-mode UX)
- `edgeType` (maps to XYFlow edge type)

### Node data conventions
Most node properties live under `node.data`:
- `data.title` (preferred)
- `data.content` (TipTap HTML)
- type-specific fields (document ids, preview urls, etc.)

When building prompts or summaries, **strip HTML** before using `data.content`.

---

## Placement & layout (ELK + heuristics)

### Entry points

- `next/src/features/board/placementEngine.ts`
  - Orchestrates placement for new nodes and generates edge placements.
- `next/src/features/board/layoutAlgorithms.ts`
  - Contains `calculateElkHierarchyLayout(...)` using ELK’s `layered` algorithm.

### ELK hierarchy layout behavior (current)

`calculateElkHierarchyLayout(...)`:
- Uses ELK layered layout (`elk.algorithm: layered`) with tuned spacing for “tall airy” trees.
- Supports a “focus node” context: when generating under an existing parent, layout is anchored via a synthetic `__focus__` node so the **existing parent does not drift**.
- Offsets the resulting layout to:
  - center the subtree under the focus node, and
  - keep newly generated nodes **below** the parent (direction `DOWN`).

### Connection generation expectations
When creating edges for newly placed nodes:
- Prefer explicit `parentId` relationships first.
- Only fall back to connecting directly to a focus node if a generated node has no parent.

---

## AI architecture (client + server)

### Server: chat completions proxy (gateway-compatible)

Primary route:
- `next/app/api/ai/chat/completions/route.ts`

Routing behavior:
- If `AI_GATEWAY_API_KEY` is set:
  - uses Vercel AI Gateway (`https://ai-gateway.vercel.sh/v1/chat/completions`)
  - supports provider-prefixed model ids (e.g. `anthropic/...`, `xai/...`)
  - legacy model ids (e.g. `gpt-4o-mini`) are normalized to `openai/<id>` for gateway calls
- If not using gateway:
  - uses OpenAI directly (`https://api.openai.com/v1/chat/completions`)
  - accepts `openai/<id>` from the UI and strips the prefix
  - rejects non-openai provider-prefixed ids without gateway

### Client: model list + prompt shaping

High-signal files:
- `next/src/features/ai/models.ts` (model picker list)
- `next/src/features/ai/aiTypes.ts` (model id union + request/response types)
- `next/src/features/ai/aiService.ts` (prompt shaping, board snapshot building)

The client builds a compact “board snapshot” to ground AI responses:
- caps total prompt budget
- strips HTML
- includes selected node hinting when applicable

---

## Board creation + AI generation routes

Common endpoints:
- `next/app/api/boards/generate-starters/route.ts`
- `next/app/api/boards/generate-nodes/route.ts`
- `next/app/api/boards/generate-media-nodes/route.ts`

Notes:
- These routes should be resilient to partially formatted AI output.
- Client code assumes the AI may return non-unique ids; client-side mapping must ensure unique node ids to avoid React key collisions.

`generate-nodes` currently supports a 2-level structure:
- `nodes[]` (level-1 text nodes with ids)
- `children[]` (level-2 nodes referencing `parentId`)

---

## Story mode (how it works today)

### Starter node fields
Story data lives on node `data`:
- `storyStarter: boolean`
- `storyTitle: string`
- `storyCompleted: boolean` (set when the user reaches the end)

### Where story UI lives
- Story status + settings live in `next/src/components/LeftDock.tsx`
- Story runtime orchestration lives in `next/src/features/board/BoardComponent.tsx`
- Story starter badges live in node components under `next/src/features/nodes/*`

### Events (decoupling pattern)
Story flows use global custom events for decoupling:
- `nodal:start-story`
- `nodal:story-paused`
- `nodal:story-update`
- `nodal:story-delete`
- `nodal:open-story-settings`

### End-of-story behavior (important invariant)
When the user hits the final chapter:
- **exit story mode** (no new nodes should be created)
- set `data.storyCompleted = true` on the starter node
- persist final progress in `story_progress`

---

## Node types (how to add/change)

Node components live in `next/src/features/nodes/`.

Common node types:
- `nodalNode.tsx` (default/text)
- `DocumentNode.tsx`
- `ImageNode.tsx`
- `VideoNode.tsx`
- `LinkNode.tsx`
- `SpotifyNode.tsx`
- `TaskNode.tsx`
- `HeadlineNode.tsx`

### Adding a new node type (checklist)
- Create the node component under `next/src/features/nodes/`.
- Register it in the XYFlow nodeTypes mapping in the board runtime.
- Ensure it supports:
  - selection + hover patterns
  - connection handles (if connectable)
  - readOnly mode (when applicable)
- If the node participates in story mode, mirror story starter UI conventions.

---

## Supabase touchpoints (what we rely on)

Common tables referenced in the app:
- `boards`
- `board_members`
- `profiles`
- `story_progress`
- `ai_usage`

Storage:
- Documents/media are stored in Supabase Storage.
- Signed URLs are preferred for private buckets and for reliability.

When adding new persistent flags:
- prefer node `data` fields first (unless query/index needs dictate schema changes)
- if you must add a column: add a migration + safe fallbacks, and don’t assume generated TS types exist yet

---

## “Where do I change X?” (common tasks)

### Change AI provider routing (Gateway vs OpenAI)
- `next/app/api/ai/chat/completions/route.ts`

### Add/change models in the picker
- `next/src/features/ai/models.ts`
- `next/src/features/ai/aiTypes.ts`
- `next/src/features/ai/aiService.ts`

### Tune ELK hierarchy layout
- `next/src/features/board/layoutAlgorithms.ts` (`calculateElkHierarchyLayout`)
- `next/src/features/board/placementEngine.ts`

### Change story settings UX
- `next/src/components/LeftDock.tsx` (modal + actions)
- `next/src/features/board/BoardComponent.tsx` (runtime)
- node badges in `next/src/features/nodes/*`

### Change board persistence
- `next/src/features/storage/supabaseStorage.ts`

---

## Development guidelines (guardrails)

- **Preserve visual continuity**: placement changes must not unexpectedly move an existing parent when generating children.
- **Prefer small changes**: avoid broad refactors unless explicitly requested.
- **Use events for decoupling**: if a modal is owned elsewhere (e.g. LeftDock), dispatch an event; don’t duplicate modal state.
- **Prompt hygiene**: strip HTML before sending node content to AI; keep budgets capped.
- **Local iteration default**: don’t push/deploy unless explicitly requested.
- **Team note**: Jack is almost always working locally, so we don’t need to push every time. 😉

