"use client"

import React from 'react'
import Modal from './ui/Modal'
import TextInput from './ui/TextInput'
import TextArea from './ui/TextArea'
import Button from './ui/Button'
import Checkbox from './ui/Checkbox'
import Toggle from './ui/Toggle'
import { useChatNodeGen2 } from '../features/ai/useChatNodeGen2'
import { useBoardStore } from '../features/board/boardSlice'
import { Pencil, Robot, Upload, Video, LinkSimple, ImageSquare, Files } from '@phosphor-icons/react'
import { useUserRole } from '../features/auth/roles'
import Tag from './ui/Tag'
// import Image from 'next/image'
import { getOpenAIService } from '../features/ai/aiService'
import { useAIPlacement } from '../features/board/usePlacement'
import { useReactFlow, type Node, type Edge } from '@xyflow/react'

interface AddNodesModalProps {
  open: boolean
  onClose: () => void
  parentNodeTitle?: string
  parentNodeContent?: string
  parentNodeId?: string
  initialAIContext?: { topic?: string; description?: string }
  onManualSubmit: (payload: { titles: string[]; description?: string; generateDescription?: boolean }) => void
  onAIConfirm: (items: { title: string; content?: string }[]) => void
  onVideoSubmit?: (url: string) => void
  onLinkSubmit?: (url: string) => void
  onUploadSubmit?: (file: File) => void
  hideVideoTab?: boolean
}

type PendingPoint = { title: string; content: string; selected: boolean }

export default function AddNodesModal({
  open,
  onClose,
  parentNodeTitle,
  parentNodeContent,
  parentNodeId,
  initialAIContext,
  onManualSubmit,
  onAIConfirm,
  onVideoSubmit,
  onLinkSubmit,
  onUploadSubmit,
  hideVideoTab,
}: AddNodesModalProps) {
  const [tab, setTab] = React.useState<'basic' | 'ai' | 'images' | 'videos' | 'docs' | 'link'>('basic')

  // Manual state
  const [titleInput, setTitleInput] = React.useState('')
  const [titles, setTitles] = React.useState<string[]>([])
  const [description, setDescription] = React.useState('')
  const [generateDescription, setGenerateDescription] = React.useState(false)
  const titleRef = React.useRef<HTMLInputElement | null>(null)

  // AI state
  const { generateFromTopic } = useChatNodeGen2()
  const [prompt, setPrompt] = React.useState('')
  const [generated, setGenerated] = React.useState<PendingPoint[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const nodes = useBoardStore((s) => s.nodes || [])
  const topic = useBoardStore((s) => s.topic || '')
  const [videoUrl, setVideoUrl] = React.useState('')
  const [imageUrl, setImageUrl] = React.useState('')
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [linkUrl, setLinkUrl] = React.useState('')
  const { placeGeneratedNodes } = useAIPlacement()
  const { setNodes: setFlowNodes, setEdges: setFlowEdges } = useReactFlow()
  const [quickGenerating, setQuickGenerating] = React.useState(false)
  const { isPro, isAdmin } = useUserRole()
  const canUploadVideo = isPro || isAdmin
  const [isVideoDragOver, setIsVideoDragOver] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      console.log('[AddNodesModal] open=true – resetting state and focusing input')
      setTab('basic')
      setTitleInput('')
      setTitles([])
      setDescription('')
      setGenerateDescription(false)
      setVideoUrl('')
      setSelectedFile(null)
      setSelectedFiles([])
      setLinkUrl('')
      setIsDragOver(false)
      setPrompt(initialAIContext ? [
        initialAIContext.topic && `Topic: ${initialAIContext.topic}`,
        initialAIContext.description && `Description: ${initialAIContext.description}`,
        'Generate starter nodes for this board:',
      ].filter(Boolean).join('\n\n') : '')
      setGenerated([])
      requestAnimationFrame(() => titleRef.current?.focus())
    }
  }, [open, initialAIContext])

  // Video tab is always visible; no auto-hide

  const effectiveTitles = React.useMemo(() => {
    const t = titleInput.trim()
    return t ? [...titles, t] : [...titles]
  }, [titles, titleInput])

  const manualCanSubmit = effectiveTitles.length > 0
  const showDescription = titles.length === 0 && !generateDescription

  const addTitle = () => {
    const t = titleInput.trim()
    if (!t) return
    if (!titles.includes(t)) setTitles(prev => [...prev, t])
    setTitleInput('')
  }

  const removeTitle = (t: string) => setTitles(prev => prev.filter(x => x !== t))

  const handleManualSubmit = () => {
    if (!manualCanSubmit) return
    onManualSubmit({
      titles: effectiveTitles,
      description: showDescription ? description.trim() : undefined,
      generateDescription: !!generateDescription,
    })
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setIsLoading(true)
    try {
      const trimmedContent = parentNodeContent ? String(parentNodeContent).slice(0, 4000) : ''
      const topicForAI = parentNodeTitle
        ? `Parent topic: ${parentNodeTitle}\n${trimmedContent ? `Parent content: ${trimmedContent}\n` : ''}Instruction: ${prompt.trim()}`
        : prompt.trim()
      const points = await generateFromTopic(topicForAI, 6, nodes as any)
      const pending = (points || []).slice(0, 10).map(p => ({
        title: p.title || '',
        content: p.content || '',
        selected: true,
      }))
      setGenerated(pending)
      setTab('ai')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSelected = () => {
    const items = generated.filter(g => g.selected).map(g => ({ title: g.title, content: g.content }))
    onAIConfirm(items)
  }

  const handleQuickGenerate = async () => {
    const attachParentId = parentNodeId || (useBoardStore.getState().selectedNodeIds?.[0] ?? undefined)
    if (!attachParentId) return
    setQuickGenerating(true)
    try {
      const ai = getOpenAIService()
      if (!ai) return
      const trimmedContent = parentNodeContent ? String(parentNodeContent).slice(0, 4000) : ''
      const promptParts = [
        topic && `Board topic: ${topic}`,
        parentNodeTitle && `Selected node: ${parentNodeTitle}`,
        trimmedContent && `Context: ${trimmedContent}`,
        'Generate 4-6 concise related nodes (JSON only): { "nodes": [ { "title": "...", "content": "..." } ] }'
      ].filter(Boolean)
      const prompt = promptParts.join('\n\n')
      const sys = 'You generate contextually relevant child ideas. Return strict JSON only.'
      const res = await ai.generate({ prompt, systemPrompt: sys, temperature: 0.8 })
      const raw = (res.content || '').trim()
      const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i)
      let parsed: any = null
      try { parsed = JSON.parse(fenced ? fenced[1] : raw) } catch { }
      const items = Array.isArray(parsed?.nodes) ? parsed.nodes : []
      if (items.length === 0) return
      const nodesToPlace = items.map((p: any) => ({ title: String(p.title || p.label || ''), content: String(p.content || ''), parentId: attachParentId }))
      const result = await placeGeneratedNodes(nodesToPlace, attachParentId, { preferredDirection: 'down', minDistance: 40 } as any)
      if (result && result.success && result.placements.length > 0) {
        const newNodes: Node[] = result.placements.map(p => ({ id: p.node.id, type: (p.node as any).type || 'default', position: p.position, data: { ...(p.node as any).data } }))
        setFlowNodes((nds: any) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))
        if (result.connections && result.connections.length > 0) {
          const newEdges: Edge[] = result.connections.map(c => ({ id: c.edge.id, source: typeof c.edge.source === 'string' ? c.edge.source : (c.edge.source as any)?.id, target: typeof c.edge.target === 'string' ? c.edge.target : (c.edge.target as any)?.id, type: (c.edge as any).type || 'floating' }))
          setFlowEdges((eds: any) => (Array.isArray(eds) ? [...eds, ...newEdges] : [...newEdges]))
        }
        onClose()
      }
    } finally {
      setQuickGenerating(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      // title="Add Node(s)"
      // description={tab === 'manual' ? 'Manually add one or more nodes.' : 'Describe and generate nodes with AI.'}
      className="max-w-xl"
      actions={tab === 'basic' ? (
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleManualSubmit} disabled={!manualCanSubmit}>Add</Button>
        </>
      ) : tab === 'ai' ? (
        generated.length > 0 ? (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleCreateSelected} disabled={generated.filter(g => g.selected).length === 0}>Create</Button>
          </>
        ) : undefined
      ) : (tab === 'images' || tab === 'videos' || tab === 'docs') ? (
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={async () => {
            if (tab === 'videos' && videoUrl.trim() && onVideoSubmit) {
              onVideoSubmit(videoUrl.trim()); return
            }
            if (tab === 'images' && imageUrl.trim()) {
              try {
                const url = imageUrl.trim()
                let meta: any = {}
                try {
                  const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
                  if (res.ok) meta = await res.json()
                } catch { }
                const title = (meta?.title as string) || 'Image'
                const description = (meta?.description as string) || ''
                const parent = parentNodeId ? (nodes as any[]).find(n => n.id === parentNodeId) : null
                const baseX = parent?.position?.x ?? 400
                const baseY = (parent?.position?.y ?? 300) + 360
                const newId = `image-${Date.now()}`
                const newNode: Node = {
                  id: newId,
                  type: 'image' as any,
                  position: { x: baseX, y: baseY },
                  data: { title, content: description, previewUrl: url, type: 'image', status: 'ready' } as any,
                }
                setFlowNodes((nds: any) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
                if (parentNodeId) {
                  const newEdge: Edge = { id: `edge-${Date.now()}`, source: parentNodeId, target: newId, type: 'floating' as any }
                  setFlowEdges((eds: any) => (Array.isArray(eds) ? [...eds, newEdge] : [newEdge]))
                }
                onClose()
                return
              } catch { }
            }
            if (tab === 'videos') {
              if (onUploadSubmit && selectedFile) onUploadSubmit(selectedFile)
            } else if (onUploadSubmit && selectedFiles.length > 0) {
              selectedFiles.forEach(f => onUploadSubmit(f))
            }
          }} disabled={!((tab === 'videos' ? (selectedFile || videoUrl.trim()) : (selectedFiles.length > 0 || (tab === 'images' && imageUrl.trim()))))}>Create</Button>
        </>
      ) : tab === 'link' ? (
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (onLinkSubmit && linkUrl.trim()) onLinkSubmit(linkUrl.trim()) }} disabled={!linkUrl.trim()}>Create</Button>
        </>
      ) : undefined}
    >
      {parentNodeTitle && (
        <div className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-900/40 text-sm mb-3">
          <span className="text-gray-700 dark:text-gray-200 font-medium">Adding nodes connected to:</span>
          <Tag variant="primary">{parentNodeTitle}</Tag>
        </div>
      )}
      <div className={`grid grid-cols-6 gap-3 mb-3`}>
        <button
          className={`w-full px-1 py-3 cursor-pointer rounded-md text-sm flex flex-col items-center justify-center gap-2 ${tab === 'basic' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'}`}
          onClick={() => setTab('basic')}
        >
          <Pencil size={32} weight="duotone" />
          Basic
        </button>

        <button
          className={`w-full px-1 py-3 cursor-pointer rounded-md text-sm flex flex-col items-center justify-center gap-2 ${tab === 'ai' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'}`}
          onClick={() => setTab('ai')}
        >
          {/* <Image src="/nodal-nobot.svg" alt="AI" width={32} height={32} unoptimized /> */}
          <Robot size={32} weight="duotone" />
          AI
        </button>

        <button
          className={`w-full px-1 py-3 cursor-pointer rounded-md text-sm flex flex-col items-center justify-center gap-2 ${tab === 'images' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'}`}
          onClick={() => setTab('images')}
        >
          <ImageSquare size={32} weight="duotone" />
          Images
        </button>

        <button
          className={`w-full px-1 py-3 cursor-pointer rounded-md text-sm flex flex-col items-center justify-center gap-2 ${tab === 'videos' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'}`}
          onClick={() => setTab('videos')}
        >
          <Video size={32} weight="duotone" />
          Videos
        </button>

        <button
          className={`w-full px-1 py-3 cursor-pointer rounded-md text-sm flex flex-col items-center justify-center gap-2 ${tab === 'docs' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'}`}
          onClick={() => setTab('docs')}
        >
          <Files size={32} weight="duotone" />
          Docs
        </button>

        <button
          className={`w-full px-1 py-3 cursor-pointer rounded-md text-sm flex flex-col items-center justify-center gap-2 ${tab === 'link' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'}`}
          onClick={() => setTab('link')}
        >
          <LinkSimple size={32} weight="duotone" />
          Links
        </button>


      </div>

      {tab === 'basic' && (
        <div className="space-y-4 py-2">
          <div>
            <TextInput
              label={titles.length > 0 ? 'Add another title' : 'Title'}
              value={titleInput}
              onChange={(e) => setTitleInput((e.target as HTMLInputElement).value)}
              ref={titleRef}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTitle()
                }
              }}
              placeholder={titles.length > 0 ? 'Type and press Enter to add' : 'e.g., Research Topic, Idea, Task...'}
              description="Hit enter to create multiple nodes."
              fullWidth
            />
            {titles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {titles.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-xs">
                    {t}
                    <button onClick={() => removeTitle(t)} className="ml-1 text-gray-500 hover:text-gray-800 dark:hover:text-white" aria-label={`Remove ${t}`}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {titles.length === 0 && !generateDescription && (
            <div>
              <TextArea
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
                placeholder="Add details, notes, or context for this node..."
                rows={3}
                fullWidth
                description="Hidden when adding multiple nodes."
              />
            </div>
          )}

          <div className="flex items-start">
            <Checkbox
              checked={generateDescription}
              onChange={(checked) => setGenerateDescription(!!checked)}
              disabled={description.trim().length > 0}
              label="Generate AI Description"
              description="Hide the field and let AI write a short description."
            />
          </div>
        </div>
      )}

      {tab === 'ai' && (
        <div className="space-y-3 py-2">
          {generated.length === 0 ? (
            <>
              {parentNodeId && (
                <>
                  <div className="flex justify-center">
                    <Button onClick={handleQuickGenerate} loading={quickGenerating} disabled={quickGenerating || prompt.trim().length > 0}>Quick AI Generate</Button>
                  </div>
                  <div className="my-2 flex items-center gap-2 text-xs text-gray-500">
                    <span className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                    <span>OR</span>
                    <span className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                  </div>
                </>
              )}
              <TextArea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the topic or paste bullets to expand..."
                label="Description - tell us what nodes you want to generate..."
                rows={4}
                fullWidth
                description="This is the name of your node and how it appears on the board."
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={handleGenerate} loading={isLoading} disabled={!prompt.trim() || isLoading}>Generate Nodes</Button>
              </div>
            </>
          ) : (
            <div className="max-h-64 overflow-auto space-y-2">
              {generated.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 border border-gray-200 dark:border-gray-700 rounded px-2 py-1">
                  <Checkbox
                    checked={p.selected}
                    onChange={(checked) => setGenerated(prev => prev.map((g, i) => i === idx ? { ...g, selected: !!checked } : g))}
                    label={p.title || '(untitled)'}
                    labelTextClassName="text-sm"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {tab === 'videos' && (
        <div className="space-y-4 py-2">
          <TextInput
            label="Video URL"
            value={videoUrl}
            onChange={(e) => setVideoUrl((e.target as HTMLInputElement).value)}
            placeholder="https://www.youtube.com/watch?v=..."
            fullWidth
          />
          <div
            className={`border-2 border-dashed rounded-md p-6 text-center ${canUploadVideo ? (isVideoDragOver ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-900/10' : 'border-gray-300 dark:border-gray-700') : 'border-gray-300/60 dark:border-gray-700/60 opacity-60'}`}
            onDragOver={(e) => { if (!canUploadVideo) return; e.preventDefault(); setIsVideoDragOver(true) }}
            onDragLeave={() => setIsVideoDragOver(false)}
            onDrop={(e) => {
              if (!canUploadVideo) { return }
              e.preventDefault(); setIsVideoDragOver(false)
              const f = e.dataTransfer.files && e.dataTransfer.files[0]
              if (!f) return
              if (f.type !== 'video/mp4' && !/\.mp4$/i.test(f.name)) { alert('Only MP4 videos are supported.'); return }
              if (f.size > 200 * 1024 * 1024) { alert('Video exceeds the 200MB limit. Please choose a smaller file.'); return }
              setSelectedFile(f)
            }}
          >
            <div className="text-sm text-gray-700 dark:text-gray-200">Drag & drop an MP4 here</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">or</div>
            <div className="mt-3">
              <label className={`inline-block px-3 py-1.5 rounded-md border ${canUploadVideo ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 cursor-pointer' : 'bg-gray-100/60 dark:bg-gray-800/60 border-gray-300/60 dark:border-gray-700/60 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
                onClick={(e) => { if (!canUploadVideo) { e.preventDefault() } }}
              >
                <input
                  type="file"
                  className="hidden"
                  accept="video/mp4"
                  onChange={(e) => {
                    const f = (e.target as HTMLInputElement).files?.[0]
                    if (!f) return
                    if (!canUploadVideo) { alert('Uploading videos is a Pro feature. Upgrade to upload videos.'); (e.target as HTMLInputElement).value = ''; return }
                    if (f.type !== 'video/mp4') { alert('Only MP4 videos are supported.'); (e.target as HTMLInputElement).value = ''; return }
                    if (f.size > 200 * 1024 * 1024) { alert('Video exceeds the 200MB limit. Please choose a smaller file.'); (e.target as HTMLInputElement).value = ''; return }
                    setSelectedFile(f)
                  }}
                  disabled={!canUploadVideo}
                />
                <span className="text-sm">Choose MP4</span>
              </label>
            </div>
            {!canUploadVideo && (
              <div className="mt-2"><Tag variant="beta">Pro Feature</Tag></div>
            )}
            {selectedFile && (
              <div className="mt-3 text-xs text-gray-600 dark:text-gray-300">Selected: {selectedFile.name}</div>
            )}
          </div>
        </div>
      )}
      {tab === 'link' && (
        <div className="space-y-4 py-2">
          <TextInput
            label="Link URL"
            value={linkUrl}
            onChange={(e) => setLinkUrl((e.target as HTMLInputElement).value)}
            placeholder="https://example.com/article"
            fullWidth
          />
          <div className="text-xs text-gray-500 dark:text-gray-400">We'll fetch the title, image, and description if available.</div>
        </div>
      )}
      {(tab === 'images' || tab === 'docs') && (
        <div className="space-y-4 py-2">
          {tab === 'images' && (
            <TextInput
              label="Image URL"
              value={imageUrl}
              onChange={(e) => setImageUrl((e.target as HTMLInputElement).value)}
              placeholder="https://example.com/image.jpg"
              fullWidth
            />
          )}
          <div
            className={`border-2 border-dashed rounded-md p-6 text-center ${isDragOver ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-900/10' : 'border-gray-300 dark:border-gray-700'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const list = e.dataTransfer.files
              if (!list || list.length === 0) return
              const files = Array.from(list)
              const filtered = files.filter(f => tab === 'images' ? f.type.startsWith('image/') : (f.type.includes('pdf') || f.type.includes('word') || f.type.includes('text') || /\.(pdf|doc|docx|txt|md|markdown|csv|json)$/i.test(f.name)))
              if (filtered.length === 0) return
              setSelectedFiles(prev => [...prev, ...filtered])
            }}
          >
            <div className="text-sm text-gray-700 dark:text-gray-200">Drag & drop a {tab === 'images' ? 'image' : 'document'} here</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">or</div>
            <div className="mt-3">
              <label className="inline-block px-3 py-1.5 rounded-md border bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(e) => {
                    const list = (e.target as HTMLInputElement).files
                    if (!list) { setSelectedFiles([]); return }
                    const files = Array.from(list)
                    const filtered = files.filter(f => tab === 'images' ? f.type.startsWith('image/') : (f.type.includes('pdf') || f.type.includes('word') || f.type.includes('text') || /\.(pdf|doc|docx|txt|md|markdown|csv|json)$/i.test(f.name)))
                    if (filtered.length === 0) { (e.target as HTMLInputElement).value = ''; return }
                    setSelectedFiles(prev => [...prev, ...filtered])
                      ; (e.target as HTMLInputElement).value = ''
                  }}
                  accept={tab === 'images' ? 'image/*' : '.pdf,.doc,.docx,.txt,.md,.markdown,.csv,.json,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,application/json'}
                />
                <span className="text-sm">Choose file</span>
              </label>
            </div>
            {selectedFiles.length > 0 && (
              <div className="mt-3 text-xs text-gray-600 dark:text-gray-300">Selected: {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}</div>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">We’ll create a {tab === 'images' ? 'Image' : 'Document'} node based on the file.</div>
        </div>
      )}
    </Modal>
  )
}


