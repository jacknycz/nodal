import type { BoardThemeDefinition } from './index'

// Sci-fi — make it feel like a spaceship console (static background for now)
export const scifiTheme: BoardThemeDefinition = {
  respectDarkMode: false,
  background: 'radial-gradient(1200px circle at 20% 10%, rgba(34,211,238,0.18) 0%, rgba(11,18,32,0) 45%), linear-gradient(135deg, #050816 0%, #0b1220 55%, #090a12 100%)',
  nodeColor: 'rgba(2, 6, 23, 0.86)', // near-slate-950
  nodeBorderRadius: '6px',
  nodeTitleColor: '#67e8f9', // cyan-200
  nodeContentColor: '#a5b4fc', // indigo-200
  headlineColor: '#67e8f9',
  edgeColor: '#22d3ee', // cyan-400
  edgeHighlightColor: '#67e8f9', // cyan-200
  edgeHighlightPulseColor: '#a78bfa', // violet-400
  edgeArrowColor: '#c4b5fd', // violet-300
}

