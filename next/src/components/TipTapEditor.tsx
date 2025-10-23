'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
// Strike is included by StarterKit; avoid adding twice to prevent duplicates
import CodeBlock from '@tiptap/extension-code-block'
import Blockquote from '@tiptap/extension-blockquote'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import { Bold, Italic, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Underline as UnderlineIcon, Strikethrough, Code, Quote, Link as LinkIcon, Image as ImageIcon } from 'lucide-react'
import IconButton from './ui/IconButton'
import Loader from './ui/Loader'

interface TipTapEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  className?: string
  onKeyDown?: (e: React.KeyboardEvent) => void
  editorHandleRef?: React.MutableRefObject<{ focus: () => void } | null>
}

export default function TipTapEditor({ 
  content, 
  onChange, 
  placeholder = 'Start writing...', 
  className = '',
  onKeyDown,
  editorHandleRef
}: TipTapEditorProps) {
  const [isMounted, setIsMounted] = useState(false)
  // Removed resizer

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const editor = useEditor({
    extensions: (() => {
      const raw = [
        StarterKit.configure({
          // Disable extensions that we're adding separately
          codeBlock: false,
          blockquote: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          // keep default strike (boolean supported in TipTap v2 types)
          strike: false,
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
        BulletList.configure({
          HTMLAttributes: {
            class: 'list-disc pl-5 my-2',
          },
        }),
        OrderedList.configure({
          HTMLAttributes: {
            class: 'list-decimal pl-5 my-2',
          },
        }),
        ListItem,
      ] as any[]
      const seen = new Set<string>()
      return raw.filter((ext: any) => {
        const name = ext?.name || ''
        if (!name) return true
        if (seen.has(name)) return false
        seen.add(name)
        return true
      })
    })(),
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'tiptap-content prose prose-sm dark:prose-invert max-w-none focus:outline-none h-full min-h-full',
      },
      handleKeyDown: (view, event) => {
        // Call the parent onKeyDown if provided
        if (onKeyDown) {
          onKeyDown(event as any)
        }
        return false // Let TipTap handle the event normally
      },
      handleDOMEvents: {
        // Allow native context menu and prevent it from reaching board/pane handlers
        contextmenu: (_view, event) => {
          event.stopPropagation()
          return false
        },
      },
    },
    immediatelyRender: false,
  })

  // Expose a simple imperative focus handle to parent if requested
  useEffect(() => {
    if (!editorHandleRef) return
    editorHandleRef.current = {
      focus: () => {
        try {
          // Directly focus the editable DOM first, then ensure caret at end
          const anyEditor: any = editor
          if (anyEditor?.view?.dom) {
            anyEditor.view.dom.focus()
          }
          editor?.commands.focus('end')
        } catch {}
      }
    }
    return () => {
      if (editorHandleRef) editorHandleRef.current = null
    }
  }, [editor, editorHandleRef])

  // Resizer removed

  if (!editor || !isMounted) {
    return (
      <div className={`border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden ${className}`}>
        <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
          {/* Placeholder toolbar */}
        </div>
        <div className="p-3 bg-white dark:bg-gray-800 min-h-[120px] flex items-center justify-center">
          <Loader />
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
    <div className={`border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden flex flex-col flex-1 min-h-0 nodrag nopan ${className}`}>
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
      <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white flex-1 min-h-0 flex flex-col">
        <div className="p-3 flex-1 min-h-0 flex overflow-y-auto scrollbar-themed">
          <EditorContent
            editor={editor}
            className="tiptap-content flex-1 min-h-0 h-full focus:outline-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  )
} 