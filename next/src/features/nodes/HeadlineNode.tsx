"use client"

import React from 'react'

type HeadlineSize = 'sm' | 'md' | 'lg' | 'xl'

export interface HeadlineNodeData {
  title?: string
  titleSize?: HeadlineSize
}

interface HeadlineNodeProps {
  id: string
  data: HeadlineNodeData
  selected?: boolean
}

export default function HeadlineNode({ data }: HeadlineNodeProps) {
  const size: HeadlineSize = (data?.titleSize as HeadlineSize) || 'sm'
  const title = data?.title || 'New headline'

  const sizeClass = size === 'lg' ? 'text-[72px]' : size === 'md' ? 'text-[64px]' : size === 'xl' ? 'text-[96px]' : 'text-[48px]'

  return (
    <div className="pointer-events-auto bg-transparent">
      <div className={`font-bold leading-tight ${sizeClass} text-gray-900 dark:text-white select-text`}>{title}</div>
    </div>
  )
}


