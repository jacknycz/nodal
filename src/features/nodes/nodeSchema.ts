import { z } from 'zod'

export const nodeDataSchema = z.object({
  label: z.string().min(1, 'Label is required').max(100, 'Label too long'),
  content: z.string().optional(),
  type: z.enum(['default', 'input', 'output', 'document']).default('default'),
  expanded: z.boolean().default(false),
  aiGenerated: z.boolean().default(false),
  // Document-specific fields
  documentId: z.string().optional(),
  fileName: z.string().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().optional(),
  uploadedAt: z.number().optional(),
  extractedText: z.string().optional(),
  previewUrl: z.string().optional(),
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

// Document node specific validation
export const documentNodeDataSchema = nodeDataSchema.extend({
  type: z.literal('document'),
  documentId: z.string().min(1, 'Document ID is required'),
  fileName: z.string().min(1, 'File name is required'),
  fileType: z.string().min(1, 'File type is required'),
  fileSize: z.number().positive('File size must be positive'),
  uploadedAt: z.number().positive('Upload timestamp is required'),
})

export type DocumentNodeData = z.infer<typeof documentNodeDataSchema>

export function validateNodeData(data: unknown): NodeData {
  return nodeDataSchema.parse(data)
}

export function validateNodalNode(node: unknown): NodalNode {
  return nodeSchema.parse(node)
}

export function validateDocumentNode(node: unknown): NodalNode & { data: DocumentNodeData } {
  const validatedNode = nodeSchema.parse(node)
  const validatedData = documentNodeDataSchema.parse(validatedNode.data)
  return {
    ...validatedNode,
    data: validatedData
  }
} 