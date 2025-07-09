import type { BoardNode, BoardEdge } from '../board/boardTypes'

interface ExportOptions {
  format: 'json' | 'csv' | 'markdown' | 'mermaid'
  includeMetadata?: boolean
  includeViewport?: boolean
}

interface ExportData {
  nodes: BoardNode[]
  edges: BoardEdge[]
  viewport?: {
    x: number
    y: number
    zoom: number
  }
  metadata?: {
    nodeCount: number
    edgeCount: number
    exportedAt: string
    version: string
  }
}

class BoardExporter {
  static exportBoard(
    nodes: BoardNode[],
    edges: BoardEdge[],
    viewport?: { x: number; y: number; zoom: number },
    options: ExportOptions = { format: 'json' }
  ): string {
    const { format, includeMetadata = true, includeViewport = true } = options

    const exportData: ExportData = {
      nodes,
      edges,
      ...(includeViewport && viewport && { viewport }),
      ...(includeMetadata && {
        metadata: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
        },
      }),
    }

    switch (format) {
      case 'json':
        return this.exportAsJSON(exportData)
      case 'csv':
        return this.exportAsCSV(nodes, edges)
      case 'markdown':
        return this.exportAsMarkdown(nodes, edges)
      case 'mermaid':
        return this.exportAsMermaid(nodes, edges)
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  private static exportAsJSON(data: ExportData): string {
    return JSON.stringify(data, null, 2)
  }

  private static exportAsCSV(nodes: BoardNode[], edges: BoardEdge[]): string {
    const nodeRows = nodes.map(node => 
      `"${node.id}","${node.data.label}","${node.data.content || ''}","${node.data.type || 'default'}"`
    )
    
    const edgeRows = edges.map(edge => 
      `"${edge.id}","${edge.source}","${edge.target}","${edge.data?.label || ''}"`
    )

    const csv = [
      'Nodes:',
      'id,label,content,type',
      ...nodeRows,
      '',
      'Edges:',
      'id,source,target,label',
      ...edgeRows,
    ].join('\n')

    return csv
  }

  private static exportAsMarkdown(nodes: BoardNode[], edges: BoardEdge[]): string {
    const nodeList = nodes.map(node => 
      `- **${node.data.label}**${node.data.content ? `: ${node.data.content}` : ''}`
    ).join('\n')

    const edgeList = edges.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source)
      const targetNode = nodes.find(n => n.id === edge.target)
      return `- ${sourceNode?.data.label || edge.source} → ${targetNode?.data.label || edge.target}`
    }).join('\n')

    const markdown = [
      '# Board Export',
      '',
      `**Nodes (${nodes.length}):**`,
      nodeList,
      '',
      `**Connections (${edges.length}):**`,
      edgeList,
      '',
      `*Exported on ${new Date().toLocaleString()}*`,
    ].join('\n')

    return markdown
  }

  private static exportAsMermaid(nodes: BoardNode[], edges: BoardEdge[]): string {
    const nodeDefinitions = nodes.map(node => 
      `  ${node.id}["${node.data.label}"]`
    ).join('\n')

    const edgeDefinitions = edges.map(edge => 
      `  ${edge.source} --> ${edge.target}`
    ).join('\n')

    const mermaid = [
      'graph TD',
      nodeDefinitions,
      edgeDefinitions,
    ].join('\n')

    return mermaid
  }

  static createDownloadLink(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  static getFilename(format: string, prefix: string = 'board'): string {
    const timestamp = new Date().toISOString().split('T')[0]
    const extensions = {
      json: '.json',
      csv: '.csv',
      markdown: '.md',
      mermaid: '.mmd',
    }
    return `${prefix}-${timestamp}${extensions[format as keyof typeof extensions] || '.txt'}`
  }

  static getMimeType(format: string): string {
    const mimeTypes = {
      json: 'application/json',
      csv: 'text/csv',
      markdown: 'text/markdown',
      mermaid: 'text/plain',
    }
    return mimeTypes[format as keyof typeof mimeTypes] || 'text/plain'
  }
}

export default BoardExporter
export type { ExportOptions, ExportData } 