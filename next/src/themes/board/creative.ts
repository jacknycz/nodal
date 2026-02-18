import type { BoardThemeDefinition } from './index'

// Creative — richer gradients, motion-friendly backgrounds (static for now)
export const creativeTheme: BoardThemeDefinition = {
  respectDarkMode: false,
  background: 'linear-gradient(135deg, #0ea5e9 0%, #a78bfa 45%, #fb7185 100%)',
  nodeColor: 'rgba(255,255,255,0.88)',
  nodeBorderRadius: '24px',
  nodeTitleColor: '#111827',
  nodeContentColor: '#374151',
  headlineColor: '#ffffff',
  edgeColor: 'rgba(255,255,255,0.85)',
  edgeHighlightColor: '#ffffff',
  edgeHighlightPulseColor: '#fbbf24', // amber-400
  edgeArrowColor: '#f59e0b', // amber-500
}

