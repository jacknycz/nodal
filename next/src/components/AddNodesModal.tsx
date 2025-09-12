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
import { Pencil, Robot, Upload, Video } from '@phosphor-icons/react'
import Image from 'next/image'

interface AddNodesModalProps {
  open: boolean
  onClose: () => void
  parentNodeTitle?: string
  parentNodeContent?: string
  initialAIContext?: { topic?: string; description?: string }
  onManualSubmit: (payload: { titles: string[]; description?: string; generateDescription?: boolean }) => void
  onAIConfirm: (items: { title: string; content?: string }[]) => void
  onVideoSubmit?: (url: string) => void
  onUploadSubmit?: (file: File) => void
  hideVideoTab?: boolean
}

type PendingPoint = { title: string; content: string; selected: boolean }

export default function AddNodesModal({
  open,
  onClose,
  parentNodeTitle,
  parentNodeContent,
  initialAIContext,
  onManualSubmit,
  onAIConfirm,
  onVideoSubmit,
  onUploadSubmit,
  hideVideoTab,
}: AddNodesModalProps) {
  const [tab, setTab] = React.useState<'manual' | 'ai' | 'video' | 'upload'>('manual')

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
  const [videoUrl, setVideoUrl] = React.useState('')
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [isDragOver, setIsDragOver] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setTab('manual')
      setTitleInput('')
      setTitles([])
      setDescription('')
      setGenerateDescription(false)
      setVideoUrl('')
      setSelectedFile(null)
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

  // If video tab is hidden but currently selected, switch to manual
  React.useEffect(() => {
    if (hideVideoTab && tab === 'video') {
      setTab('manual')
    }
  }, [hideVideoTab, tab])

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
      generateDescription: generateDescription && effectiveTitles.length === 1,
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      // title="Add Node(s)"
      // description={tab === 'manual' ? 'Manually add one or more nodes.' : 'Describe and generate nodes with AI.'}
      className="max-w-xl"
      actions={tab === 'manual' ? (
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleManualSubmit} disabled={!manualCanSubmit}>Add</Button>
        </>
      ) : tab === 'ai' ? (
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreateSelected} disabled={generated.filter(g => g.selected).length === 0}>Create</Button>
        </>
      ) : tab === 'video' ? (
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (onVideoSubmit && videoUrl.trim()) onVideoSubmit(videoUrl.trim()) }} disabled={!videoUrl.trim()}>Create</Button>
        </>
      ) : (
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (onUploadSubmit && selectedFile) onUploadSubmit(selectedFile) }} disabled={!selectedFile}>Create</Button>
        </>
      )}
    >
      <div className={`grid ${hideVideoTab ? 'grid-cols-3' : 'grid-cols-4'} gap-3 mb-3`}>
        <button
          className={`w-full px-1 py-3 cursor-pointer rounded-md text-sm flex flex-col items-center justify-center gap-2 ${tab === 'manual' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'}`}
          onClick={() => setTab('manual')}
        >
          <Pencil size={32} weight="duotone" />
          Manual
        </button>

        <button
          className={`w-full px-1 py-3 cursor-pointer rounded-md text-sm flex flex-col items-center justify-center gap-2 ${tab === 'ai' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'}`}
          onClick={() => setTab('ai')}
        >
         {/* <Image src="/nodal-nobot.svg" alt="AI" width={32} height={32} unoptimized /> */}
         <Robot size={32} weight="duotone" />
          AI Generate
        </button>

        {!hideVideoTab && (
          <button
            className={`w-full px-1 py-3 cursor-pointer rounded-md text-sm flex flex-col items-center justify-center gap-2 ${tab === 'video' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'}`}
            onClick={() => setTab('video')}
          >
            <Video size={32} weight="duotone" />
            Video
          </button>
        )}

        <button
          className={`w-full px-1 py-3 cursor-pointer rounded-md text-sm flex flex-col items-center justify-center gap-2 ${tab === 'upload' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'}`}
          onClick={() => setTab('upload')}
        >
          <Upload size={32} weight="duotone" />
          Upload
        </button>
      </div>

      {tab === 'manual' && (
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

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">Generate AI Description</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Hide the field and let AI write a short description.</div>
            </div>
            <Toggle checked={generateDescription} onChange={(val) => setGenerateDescription(!!val)} disabled={description.trim().length > 0} aria-label="Generate AI Description" />
          </div>
        </div>
      )}

      {tab === 'ai' && (
        <div className="space-y-3 py-2">
          {parentNodeTitle && (
            <div className="rounded-md border border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-900/40 text-sm">
              <div className="text-gray-700 dark:text-gray-200 font-medium">Selected node:</div>
              <div className="text-gray-900 dark:text-gray-100">{parentNodeTitle}</div>
            </div>
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
            <Button onClick={handleGenerate} loading={isLoading} disabled={!prompt.trim() || isLoading}>Generate</Button>
          </div>

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
        </div>
      )}
      {tab === 'video' && !hideVideoTab && (
        <div className="space-y-4 py-2">
          <TextInput
            label="YouTube URL"
            value={videoUrl}
            onChange={(e) => setVideoUrl((e.target as HTMLInputElement).value)}
            placeholder="https://www.youtube.com/watch?v=..."
            fullWidth
          />
          <div className="text-xs text-gray-500 dark:text-gray-400">We'll fetch the title and thumbnail automatically.</div>
        </div>
      )}
      {tab === 'upload' && (
        <div className="space-y-4 py-2">
          <div
            className={`border-2 border-dashed rounded-md p-6 text-center ${isDragOver ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-900/10' : 'border-gray-300 dark:border-gray-700'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files && e.dataTransfer.files[0]
              if (file) setSelectedFile(file)
            }}
          >
            <div className="text-sm text-gray-700 dark:text-gray-200">Drag & drop a file here</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">or</div>
            <div className="mt-3">
              <label className="inline-block px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = (e.target as HTMLInputElement).files?.[0] || null
                    setSelectedFile(f)
                  }}
                  accept="image/*,.pdf,.doc,.docx,.txt,.md,.markdown,.csv,.json"
                />
                <span className="text-sm">Choose file</span>
              </label>
            </div>
            {selectedFile && (
              <div className="mt-3 text-xs text-gray-600 dark:text-gray-300">Selected: {selectedFile.name}</div>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">We’ll create an Image or Document node based on the file type.</div>
        </div>
      )}
    </Modal>
  )
}


