export const MODELS = [
  // UI/UX: Users pick "modes" (not providers/models). Values remain model ids internally.
  { value: 'gpt-4o', label: 'Smart' },
  { value: 'gpt-4o-mini', label: 'Quick' },
  { value: 'gpt-5-mini', label: 'Deep' },
  { value: 'gpt-5', label: 'Research' },
] as const

export type ModelId = (typeof MODELS)[number]['value']

export default MODELS


