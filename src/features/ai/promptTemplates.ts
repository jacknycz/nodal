export const PROMPT_TEMPLATES = {
  expandNode: (label: string, content?: string) => `
Expand on the concept: "${label}"
${content ? `Current content: ${content}` : ''}

Please provide a detailed explanation or expansion of this concept. Focus on:
- Key aspects and components
- Related ideas and connections
- Practical applications or examples
- Potential implications or consequences

Keep the response concise but comprehensive.
  `.trim(),

  generateRelatedNodes: (label: string, count: number = 3) => `
Generate ${count} related concepts or ideas that connect to: "${label}"

Consider:
- Direct relationships and dependencies
- Complementary or contrasting concepts
- Broader categories or specific examples
- Temporal or causal relationships

Provide only the concept names, one per line, without explanations.
  `.trim(),

  suggestConnections: (nodes: Array<{ id: string; label: string }>) => `
Given these nodes:
${nodes.map(node => `${node.id}: ${node.label}`).join('\n')}

Suggest logical connections between them. For each connection, provide:
- Source node ID
- Target node ID  
- Brief reason for the connection

Format as: sourceId -> targetId: reason

Focus on meaningful, logical relationships that enhance understanding.
  `.trim(),

  summarizeBoard: (nodes: Array<{ label: string; content?: string }>) => `
Summarize this knowledge graph:

${nodes.map(node => `- ${node.label}${node.content ? `: ${node.content}` : ''}`).join('\n')}

Provide a concise summary that captures:
- The main themes or topics
- Key relationships and patterns
- Overall structure or flow
- Potential insights or conclusions
  `.trim(),

  improveNode: (label: string, content: string) => `
Improve and enhance this node:

Label: "${label}"
Current content: "${content}"

Please:
- Clarify and expand the explanation
- Add relevant examples or context
- Improve clarity and organization
- Suggest potential connections to other concepts

Maintain the core meaning while making it more comprehensive and useful.
  `.trim(),

  generateQuestions: (label: string, content?: string) => `
Generate thoughtful questions about: "${label}"
${content ? `Content: ${content}` : ''}

Create questions that:
- Explore different aspects of the concept
- Challenge assumptions or perspectives
- Connect to broader themes or applications
- Encourage deeper thinking and analysis

Provide 3-5 questions, one per line.
  `.trim(),
} as const

export type PromptType = keyof typeof PROMPT_TEMPLATES 