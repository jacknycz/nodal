import { z } from 'zod'

export const nodeDataSchema = z.object({
  label: z.string().min(1, 'Label is required').max(100, 'Label too long'),
  content: z.string().optional(),
  type: z.enum(['default', 'input', 'output']).default('default'),
  expanded: z.boolean().default(false),
  aiGenerated: z.boolean().default(false),
})

export const nodeSchema = z.object({
  id: z.string().uuid(),
  type: z.string().default('default'),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: nodeDataSchema,
})

export type NodeData = z.infer<typeof nodeDataSchema>
export type NodalNode = z.infer<typeof nodeSchema>

export function validateNodeData(data: unknown): NodeData {
  return nodeDataSchema.parse(data)
}

export function validateNodalNode(node: unknown): NodalNode {
  return nodeSchema.parse(node)
} 