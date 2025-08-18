'use client'

import { useCallback } from 'react'
import { useAIContext } from './aiContext'
import type { BoardNode } from '../board/boardTypes'

export interface GeneratedPoint {
  title: string
  content: string
}

export function useChatNodeGen2() {
  const ai = useAIContext()

  const generateFromTopic = useCallback(async (topic: string, count: number = 5, existingNodes?: BoardNode[]): Promise<GeneratedPoint[]> => {
    if (!ai.service) return []

    const systemPrompt = `You generate node titles (and optional content) for a visual thinking board.
Return strictly JSON with this shape:
{ "nodes": [ { "title": "...", "content": "..." } ] }
No code fences, no commentary.`

    const response = await ai.generate({
      prompt: `Generate ${count} concise nodes for: ${topic}.`,
      systemPrompt,
      model: ai.selectOptimalModel('generate_related'),
      temperature: 0.8,
      stream: false,
      context: existingNodes ? { board: { nodes: existingNodes, edges: [], selectedNodeId: null, focusedNodeIds: [] } as any } : undefined,
    })

    // Try JSON parse: fenced or inline
    const raw = response.content.trim()
    const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i)
    let parsed: any
    try {
      if (fenced) {
        parsed = JSON.parse(fenced[1])
      } else if (/\{[\s\S]*\}/.test(raw)) {
        const m = raw.match(/\{[\s\S]*\}/)
        parsed = m ? JSON.parse(m[0]) : null
      }
    } catch {
      parsed = null
    }

    let nodes: GeneratedPoint[] = []
    if (parsed && Array.isArray(parsed.nodes)) {
      nodes = parsed.nodes.map((n: any) => ({ title: String(n.title || n.label || '').slice(0, 50), content: String(n.content || '') }))
    }

    // Fallback: extract from bullets
    if (nodes.length === 0) {
      const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
      const items = lines
        .map(l => l.replace(/^\s*(\d+\.|[\-*•])\s+/, ''))
        .filter(l => l && !/^\{|\}|\[|\]/.test(l))
      nodes = items.slice(0, count).map((t, i) => ({ title: t.replace(/["'`]+/g, '').slice(0, 50), content: '' }))
    }

    // Dedupe
    const seen = new Set<string>()
    const unique = nodes.filter(n => {
      const key = n.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })

    return unique.slice(0, count)
  }, [ai])

  return { generateFromTopic }
}


