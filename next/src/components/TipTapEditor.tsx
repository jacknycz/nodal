'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Strike from '@tiptap/extension-strike'
import CodeBlock from '@tiptap/extension-code-block'
import Blockquote from '@tiptap/extension-blockquote'
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  GripVertical
} from 'lucide-react'
import IconButton from './ui/IconButton'

interface TipTapEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  className?: string
}

export default function TipTapEditor({ content, onChange, placeholder = 'Start writing...', className = '' }: TipTapEditorProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [editorHeight, setEditorHeight] = useState(200)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable extensions that we're adding separately
        codeBlock: false,
        blockquote: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 hover:text-blue-800 underline',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      Strike,
      CodeBlock.configure({
        HTMLAttributes: {
          class: 'bg-gray-100 dark:bg-gray-800 rounded p-2 font-mono text-sm',
        },
      }),
      Blockquote.configure({
        HTMLAttributes: {
          class: 'border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic',
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
      },
    },
    immediatelyRender: false,
  })

  // Handle resize functionality
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return
      
      const container = resizeRef.current
      const containerRect = container.getBoundingClientRect()
      const newHeight = e.clientY - containerRect.top
      
      console.log('Mouse move:', {
        clientY: e.clientY,
        containerTop: containerRect.top,
        newHeight,
        currentHeight: editorHeight
      })
      
      // Set min and max constraints
      const minHeight = 120
      const maxHeight = Math.min(50 * window.innerHeight / 100, 400) // 50vh or 400px, whichever is smaller
      
      if (newHeight >= minHeight && newHeight <= maxHeight) {
        console.log('Setting new height:', newHeight)
        setEditorHeight(newHeight)
      }
    }

    const handleMouseUp = () => {
      console.log('Mouse up - stopping resize')
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, editorHeight])

  const handleResizeStart = (e: React.MouseEvent) => {
    console.log('Resize start triggered!')
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
  }

  if (!editor || !isMounted) {
    return (
      <div className={`border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden ${className}`}>
        <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
          {/* Placeholder toolbar */}
        </div>
        <div className="p-3 bg-white dark:bg-gray-800 min-h-[120px] flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400">Loading editor...</div>
        </div>
      </div>
    )
  }

  const addLink = () => {
    const url = window.prompt('Enter URL')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  const addImage = () => {
    const url = window.prompt('Enter image URL')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  return (
    <div className={`border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden flex flex-col ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
        <IconButton
          variant={editor.isActive('bold') ? 'primary' : 'default'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          <Bold size={14} />
        </IconButton>
        
        <IconButton
          variant={editor.isActive('italic') ? 'primary' : 'default'}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          <Italic size={14} />
        </IconButton>
        
        <IconButton
          variant={editor.isActive('underline') ? 'primary' : 'default'}
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Underline"
        >
          <UnderlineIcon size={14} />
        </IconButton>
        
        <IconButton
          variant={editor.isActive('strike') ? 'primary' : 'default'}
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          aria-label="Strikethrough"
        >
          <Strikethrough size={14} />
        </IconButton>
        
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        
        <IconButton
          variant={editor.isActive('bulletList') ? 'primary' : 'default'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
        >
          <List size={14} />
        </IconButton>
        
        <IconButton
          variant={editor.isActive('orderedList') ? 'primary' : 'default'}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Numbered list"
        >
          <ListOrdered size={14} />
        </IconButton>
        
        <IconButton
          variant={editor.isActive('blockquote') ? 'primary' : 'default'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          aria-label="Quote"
        >
          <Quote size={14} />
        </IconButton>
        
        <IconButton
          variant={editor.isActive('codeBlock') ? 'primary' : 'default'}
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          aria-label="Code block"
        >
          <Code size={14} />
        </IconButton>
        
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        
        <IconButton
          variant={editor.isActive({ textAlign: 'left' }) ? 'primary' : 'default'}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          aria-label="Align left"
        >
          <AlignLeft size={14} />
        </IconButton>
        
        <IconButton
          variant={editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          aria-label="Align center"
        >
          <AlignCenter size={14} />
        </IconButton>
        
        <IconButton
          variant={editor.isActive({ textAlign: 'right' }) ? 'primary' : 'default'}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          aria-label="Align right"
        >
          <AlignRight size={14} />
        </IconButton>
        
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        
        <IconButton
          variant="default"
          size="sm"
          onClick={addLink}
          aria-label="Add link"
        >
          <LinkIcon size={14} />
        </IconButton>
        
        <IconButton
          variant="default"
          size="sm"
          onClick={addImage}
          aria-label="Add image"
        >
          <ImageIcon size={14} />
        </IconButton>
      </div>
      
      {/* Editor content with resize handle */}
      <div 
        ref={resizeRef}
        className="relative bg-white dark:bg-gray-800"
        style={{ height: `${editorHeight}px` }}
      >
        <div className="p-3 h-full overflow-y-auto">
          <EditorContent editor={editor} className="h-full" />
        </div>
        
        {/* Resize handle */}
        <div
          className="absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center z-10 border-t border-gray-200 dark:border-gray-600"
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        >
          <GripVertical size={14} className="text-gray-500 dark:text-gray-400" />
        </div>
      </div>
    </div>
  )
} 