"use client"

import React from 'react'
import Modal from './ui/Modal'
import TextArea from './ui/TextArea'
import Button from './ui/Button'
import Checkbox from './ui/Checkbox'
import { useChatNodeGen2 } from '../features/ai/useChatNodeGen2'
import { useAIPlacement } from '../features/board/usePlacement'
import { useReactFlow, type Node, type Edge } from '@xyflow/react'
import { useBoardStore } from '../features/board/boardSlice'

interface AINodeGeneratorProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (nodeData: { label: string; content?: string }) => void
  initialContext?: { topic?: string; description?: string }
  parentNodeId?: string
}

type PendingPoint = { title: string; content: string; selected: boolean }

export default function AINodeGenerator({
  isOpen,
  onClose,
  onGenerate,
  initialContext,
  parentNodeId,
}: AINodeGeneratorProps) {
  const { generateFromTopic } = useChatNodeGen2()
  const { placeGeneratedNodes } = useAIPlacement()
  const { setNodes, setEdges } = useReactFlow()
  // Board awareness
  const storeNodes = useBoardStore((s) => s.nodes)
  const selectedNodeIds = useBoardStore((s) => s.selectedNodeIds)
  const selectedNodes = (storeNodes || []).filter((n: any) => selectedNodeIds.includes(n.id))
  const parentNode = React.useMemo(() => {
    if (parentNodeId) {
      return (storeNodes || []).find((n: any) => n.id === parentNodeId)
    }
    return selectedNodes[0]
  }, [parentNodeId, storeNodes, selectedNodes])

  const [prompt, setPrompt] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [step, setStep] = React.useState<0 | 1>(0)
  const [generated, setGenerated] = React.useState<PendingPoint[]>([])

  // Pre-populate prompt with context when modal opens
  React.useEffect(() => {
    if (isOpen && initialContext) {
      const contextPrompt = [
        initialContext.topic && `Topic: ${initialContext.topic}`,
        initialContext.description && `Description: ${initialContext.description}`,
        'Generate starter nodes for this board:'
      ].filter(Boolean).join('\n\n')
      setPrompt(contextPrompt)
    }
    if (isOpen) {
      setStep(0)
      setGenerated([])
      setIsLoading(false)
      setError(null)
    }
  }, [isOpen, initialContext])

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setIsLoading(true)
    setError(null)
    try {
      // Include parent/selected node context so "this" refers to that node
      const baseTopic = prompt.trim()
      let topicForAI = baseTopic
      const sel = parentNode || selectedNodes[0]
      if (sel) {
        const selTitle = sel?.data?.title || 'topic'
        const rawSel = sel?.data?.content || sel?.data?.extractedText || (sel?.data as any)?.extracted_text || ''
        const selContent = rawSel ? String(rawSel) : ''
        topicForAI = baseTopic || selTitle
        if (selContent) {
          topicForAI = `${topicForAI}\n\nContext from selected node:\n${selContent}`
        }
      }
      const points = await generateFromTopic(topicForAI, 6, storeNodes as any)
      const pending = (points || []).slice(0, 10).map(p => ({
        title: p.title || '',
        content: p.content || '',
        selected: true,
      }))
      setGenerated(pending)
      setStep(1)
    } catch (e: any) {
      setError('Failed to generate ideas. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSelected = async () => {
    const selected = generated.filter(g => g.selected)
    if (selected.length === 0) {
      onClose()
      return
    }
    try {
      const nodesToPlace = selected.map(p => ({ title: p.title, content: p.content || '' }))
      const result = await placeGeneratedNodes(nodesToPlace, parentNode?.id)

      if (result && result.success && result.placements.length > 0) {
        const newNodes: Node[] = result.placements.map(p => ({
          id: p.node.id,
          type: (p.node as any).type || 'default',
          position: p.position,
          data: { ...(p.node as any).data },
        }))
        setNodes((nds: any) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))

        if (result.connections && result.connections.length > 0) {
          const newEdges: Edge[] = result.connections.map(c => ({
            id: c.edge.id,
            source: typeof c.edge.source === 'string' ? c.edge.source : (c.edge.source as any)?.id,
            target: typeof c.edge.target === 'string' ? c.edge.target : (c.edge.target as any)?.id,
            type: (c.edge as any).type || 'floating',
          }))
          setEdges((eds: any) => (Array.isArray(eds) ? [...eds, ...newEdges] : [...newEdges]))
        }
      } else {
        // Fallback: call onGenerate per node if placement failed
        for (const p of selected) {
          onGenerate({ label: p.title || '(untitled)', content: p.content || '' })
        }
      }
    } catch {
      // Fallback on error as well
      for (const p of selected) {
        onGenerate({ label: p.title || '(untitled)', content: p.content || '' })
      }
    } finally {
      onClose()
    }
  }

  const handleClose = () => {
    setPrompt('')
    setGenerated([])
    setStep(0)
    setIsLoading(false)
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="AI Node Generator"
      description={step === 0 ? 'Describe what you want to generate, or refine the prefilled context.' : 'Review and confirm the nodes to create.'}
      currentStep={step}
      totalSteps={2}
    >
      {step === 0 && (
        <div className="space-y-3">
          {parentNode && (
            <div className="rounded-md border border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-900/40 text-sm">
              <div className="text-gray-700 dark:text-gray-200 font-medium">Parent node:</div>
              <div className="text-gray-900 dark:text-gray-100">{parentNode?.data?.title || '(untitled)'}</div>
            </div>
          )}
          <TextArea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the topic or paste bullets to expand..."
            rows={4}
            fullWidth
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleGenerate} loading={isLoading} disabled={!prompt.trim() || isLoading}>
              Generate
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col">
          <div className="max-h-64 overflow-auto mt-2 space-y-2">
            {generated.length === 0 && (
              <p className="text-sm text-gray-500">No ideas generated.</p>
            )}
            {generated.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 border border-gray-200 dark:border-gray-700 rounded px-2 py-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={p.selected}
                    onChange={(checked) => {
                      setGenerated(prev => prev.map((g, i) => i === idx ? { ...g, selected: !!checked } : g))
                    }}
                    label={p.title || '(untitled)'}
                    labelTextClassName="text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between gap-2 mt-4">
            <Button variant="secondaryGhost" onClick={() => setStep(0)}>Back</Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleCreateSelected}>
                Create {generated.filter(g => g.selected).length} {generated.filter(g => g.selected).length === 1 ? 'node' : 'nodes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}