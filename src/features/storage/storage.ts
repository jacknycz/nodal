import { supabaseStorage } from './supabaseStorage'
import type { BoardNode, BoardEdge } from '../board/boardTypes'

interface BoardData {
  nodes: BoardNode[]
  edges: BoardEdge[]
  viewport: {
    x: number
    y: number
    zoom: number
  }
  lastModified: number
}

interface SavedBoard {
  id: string
  name: string
  data: BoardData
  createdAt: number
  lastModified: number
  nodeCount: number
  edgeCount: number
}

// Document storage interfaces
export interface DocumentFile {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  content: Blob
  extractedText: string
  uploadedAt: number
  boardId: string
  nodeId?: string // Associated node if any
}

export interface DocumentMetadata {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  uploadedAt: number
  boardId: string
  nodeId?: string
  previewUrl?: string
}

class BoardStorage {
  // Document storage methods
  async saveDocument(
    fileName: string,
    file: Blob,
    extractedText: string,
    boardId: string,
    nodeId?: string
  ): Promise<string> {
    return supabaseStorage.saveDocument(fileName, file, extractedText, boardId, nodeId)
  }

  async getDocument(documentId: string): Promise<DocumentFile | null> {
    return supabaseStorage.getDocument(documentId)
  }

  async getDocumentMetadata(documentId: string): Promise<DocumentMetadata | null> {
    // This would need to be implemented in supabaseStorage
    console.warn('getDocumentMetadata not yet implemented for Supabase storage')
    return null
  }

  async getBoardDocuments(boardId: string): Promise<DocumentMetadata[]> {
    const documents = await supabaseStorage.getBoardDocuments(boardId)
    return documents.map(doc => ({
      id: doc.id,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      uploadedAt: doc.uploadedAt,
      boardId: doc.boardId,
      nodeId: doc.nodeId,
      previewUrl: undefined, // Would need to generate signed URL from Supabase
    }))
  }

  async deleteDocument(documentId: string): Promise<void> {
    return supabaseStorage.deleteDocument(documentId)
  }

  // Save a named board
  async saveBoard(name: string, data: Omit<BoardData, 'lastModified'>): Promise<string> {
    return supabaseStorage.saveBoard(name, data)
  }

  // Update an existing board
  async updateBoard(boardId: string, data: Omit<BoardData, 'lastModified'>): Promise<void> {
    return supabaseStorage.updateBoard(boardId, data)
  }

  // Load a specific board
  async loadBoard(boardId: string): Promise<SavedBoard | null> {
    return supabaseStorage.loadBoard(boardId)
  }

  // Get all saved boards
  async getAllBoards(): Promise<SavedBoard[]> {
    return supabaseStorage.getAllBoards()
  }

  // Get board names (for duplicate checking)
  async getBoardNames(): Promise<string[]> {
    const boards = await this.getAllBoards()
    return boards.map(board => board.name)
  }

  // Delete a board
  async deleteBoard(boardId: string): Promise<void> {
    return supabaseStorage.deleteBoard(boardId)
  }

  // Rename a board
  async renameBoard(boardId: string, newName: string): Promise<void> {
    return supabaseStorage.renameBoard(boardId, newName)
  }

  // Legacy methods for backward compatibility
  async saveBoard_legacy(data: Omit<BoardData, 'lastModified'>): Promise<void> {
    // Create a new board with legacy data
    await this.saveBoard('Legacy Board', data)
  }

  async loadBoard_legacy(): Promise<BoardData | null> {
    // Get the most recent board
    const boards = await this.getAllBoards()
    if (boards.length === 0) return null
    return boards[0].data
  }

  async clearAllData(): Promise<void> {
    // This would need to be implemented in supabaseStorage
    console.warn('clearAllData not yet implemented for Supabase storage')
  }

  async exportBoard(): Promise<string> {
    // Get the most recent board and export it
    const boards = await this.getAllBoards()
    if (boards.length === 0) {
      throw new Error('No boards to export')
    }
    const board = boards[0]
    return JSON.stringify(board.data, null, 2)
  }

  async importBoard(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData) as BoardData
      
      // Validate the data structure
      if (!data.nodes || !data.edges || !data.viewport) {
        throw new Error('Invalid board data format')
      }
      
      await this.saveBoard('Imported Board', data)
      console.log('Board imported successfully')
    } catch (error) {
      console.error('Failed to import board:', error)
      throw error
    }
  }
}

export const boardStorage = new BoardStorage()
export type { SavedBoard, BoardData } 