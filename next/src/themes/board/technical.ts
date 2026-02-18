import type { BoardThemeDefinition } from './index'

// Technical — grid-forward, subdued palette, diagram vibes
export const technicalTheme: BoardThemeDefinition = {
  respectDarkMode: false,
  background: '#0b1220',
  nodeColor: 'rgba(17, 24, 39, 0.92)', // gray-900-ish
  nodeBorderRadius: '10px',
  nodeTitleColor: '#e5e7eb', // gray-200
  nodeContentColor: '#9ca3af', // gray-400
  headlineColor: '#f9fafb',
  edgeColor: '#94a3b8', // slate-400
  edgeHighlightColor: '#cbd5e1', // slate-300
  edgeHighlightPulseColor: '#22d3ee', // cyan-400
  edgeArrowColor: '#06b6d4', // cyan-500
}

