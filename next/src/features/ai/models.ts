export const MODELS = [
  { value: 'gpt-4o', label: 'Smart (Fast)' },
  { value: 'gpt-4o-mini', label: 'Quick Draft' },
  { value: 'gpt-5-mini', label: 'Deep Thinker' },
  { value: 'gpt-5', label: 'Research Mode' },
  // Vercel AI Gateway (OpenAI-compatible): provider-prefixed model ids
  { value: 'anthropic/claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'anthropic/claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  { value: 'xai/grok-2', label: 'Grok 2' },
  { value: 'xai/grok-2-mini', label: 'Grok 2 Mini' },
] as const

export type ModelId = (typeof MODELS)[number]['value']

export default MODELS


