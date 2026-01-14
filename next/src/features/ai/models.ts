export const MODELS = [
  { value: 'gpt-4o', label: 'Smart (Fast)' },
  { value: 'gpt-4o-mini', label: 'Quick Draft' },
  { value: 'gpt-5-mini', label: 'Deep Thinker' },
  { value: 'gpt-5', label: 'Research Mode' },
] as const

export type ModelId = (typeof MODELS)[number]['value']

export default MODELS


