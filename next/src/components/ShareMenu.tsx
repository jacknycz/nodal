'use client'

import React from 'react'
import { ShareNetwork, LinkSimple, Chat } from '@phosphor-icons/react'
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
          <ShareNetwork className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </button>
      }
      items={[
        {
          label: 'Share Board',
          icon: ShareNetwork,
          onClick: onShareBoard
        },
        {
          label: 'Copy Link',
          icon: LinkSimple,
          onClick: onCopyLink
        },
        { divider: true, label: '' },
        {
          label: 'Feedback',
          icon: Chat,
          onClick: onShowFeedback
        }
      ]}
      className={className}
      align="left"
    />
  )
}