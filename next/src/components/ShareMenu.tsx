'use client'

import React from 'react'
import { Share2, Link2, MessageSquare } from 'lucide-react'
import Menu from './ui/Menu'

interface ShareMenuProps {
  onShareBoard: () => void
  onCopyLink: () => void
  onShowFeedback: () => void
  className?: string
}

export default function ShareMenu({
  onShareBoard,
  onCopyLink,
  onShowFeedback,
  className = ''
}: ShareMenuProps) {
  return (
    <Menu
      trigger={
        <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <Share2 className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </button>
      }
      items={[
        {
          label: 'Share Board',
          icon: Share2,
          onClick: onShareBoard
        },
        {
          label: 'Copy Link',
          icon: Link2,
          onClick: onCopyLink
        },
        { divider: true },
        {
          label: 'Feedback',
          icon: MessageSquare,
          onClick: onShowFeedback
        }
      ]}
      className={className}
      align="left"
    />
  )
}