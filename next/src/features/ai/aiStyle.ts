export const AI_STYLE_OPTIONS = [
  { value: 'balanced', label: 'Balanced (default)' },
  { value: 'precise', label: 'Precise & Careful' },
  { value: 'creative', label: 'Creative & Exploratory' },
  { value: 'critical', label: 'Challenging / Critical' },
] as const

export type AIStyleKey = (typeof AI_STYLE_OPTIONS)[number]['value']

export function getAIStyleSystemDirective(style: AIStyleKey | null | undefined): string {
  const s = (style || 'balanced') as AIStyleKey
  switch (s) {
    case 'precise':
      return [
        'Style: Precise & Careful.',
        '- Be cautious and accurate.',
        '- Prefer structured output (bullets/steps).',
        '- Clearly label assumptions and uncertainty.',
      ].join('\n')
    case 'creative':
      return [
        'Style: Creative & Exploratory.',
        '- Generate multiple ideas and angles.',
        '- Encourage divergent thinking and novel connections.',
        '- Keep it actionable, but don’t be afraid to be imaginative.',
      ].join('\n')
    case 'critical':
      return [
        'Style: Challenging / Critical.',
        '- Provide counterpoints and stress-test the idea.',
        '- Call out risks, gaps, and alternatives.',
        '- Be direct but constructive.',
      ].join('\n')
    case 'balanced':
    default:
      return [
        'Style: Balanced.',
        '- Be practical and helpful.',
        '- Keep it concise unless the user asks for depth.',
      ].join('\n')
  }
}

