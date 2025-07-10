import localforage from 'localforage'
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

interface StorageConfig {
  storeName?: string
  description?: string
}

class BoardStorage {
  private store: LocalForage
  private config: StorageConfig

  constructor(config: StorageConfig = {}) {
    this.config = {
      storeName: 'nodal-boards',
      description: 'Nodal board data storage',
      ...config,
    }

    this.store = localforage.createInstance({
      name: this.config.storeName,
      description: this.config.description,
    })
  }

  // Generate a unique ID for boards
  private generateBoardId(): string {
    return `board_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Save a named board
  async saveBoard(name: string, data: Omit<BoardData, 'lastModified'>): Promise<string> {
    try {
      const boardData: BoardData = {
        ...data,
        lastModified: Date.now(),
      }
      
      const savedBoard: SavedBoard = {
        id: this.generateBoardId(),
        name,
        data: boardData,
        createdAt: Date.now(),
        lastModified: Date.now(),
        nodeCount: data.nodes.length,
        edgeCount: data.edges.length,
      }
      
      // Save the board
      await this.store.setItem(savedBoard.id, savedBoard)
      
      // Update the board list
      await this.updateBoardList(savedBoard)
      
      console.log(`Board "${name}" saved successfully with ID: ${savedBoard.id}`)
      return savedBoard.id
    } catch (error) {
      console.error('Failed to save board:', error)
      throw error
    }
  }

  // Update an existing board
  async updateBoard(boardId: string, data: Omit<BoardData, 'lastModified'>): Promise<void> {
    try {
      const existingBoard = await this.store.getItem<SavedBoard>(boardId)
      if (!existingBoard) {
        throw new Error(`Board with ID ${boardId} not found`)
      }

      const boardData: BoardData = {
        ...data,
        lastModified: Date.now(),
      }

      const updatedBoard: SavedBoard = {
        ...existingBoard,
        data: boardData,
        lastModified: Date.now(),
        nodeCount: data.nodes.length,
        edgeCount: data.edges.length,
      }

      await this.store.setItem(boardId, updatedBoard)
      await this.updateBoardList(updatedBoard)
      
      console.log(`Board "${existingBoard.name}" updated successfully`)
    } catch (error) {
      console.error('Failed to update board:', error)
      throw error
    }
  }

  // Load a specific board
  async loadBoard(boardId: string): Promise<SavedBoard | null> {
    try {
      const board = await this.store.getItem<SavedBoard>(boardId)
      return board
    } catch (error) {
      console.error('Failed to load board:', error)
      return null
    }
  }

  // Get all saved boards
  async getAllBoards(): Promise<SavedBoard[]> {
    try {
      const boardList = await this.store.getItem<string[]>('board-list')
      if (!boardList) return []

      const boards: SavedBoard[] = []
      for (const boardId of boardList) {
        const board = await this.store.getItem<SavedBoard>(boardId)
        if (board) {
          boards.push(board)
        }
      }

      // Sort by last modified (most recent first)
      return boards.sort((a, b) => b.lastModified - a.lastModified)
    } catch (error) {
      console.error('Failed to get all boards:', error)
      return []
    }
  }

  // Get board names (for duplicate checking)
  async getBoardNames(): Promise<string[]> {
    try {
      const boards = await this.getAllBoards()
      return boards.map(board => board.name)
    } catch (error) {
      console.error('Failed to get board names:', error)
      return []
    }
  }

  // Delete a board
  async deleteBoard(boardId: string): Promise<void> {
    try {
      const board = await this.store.getItem<SavedBoard>(boardId)
      if (!board) {
        throw new Error(`Board with ID ${boardId} not found`)
      }

      await this.store.removeItem(boardId)
      await this.removeBoardFromList(boardId)
      
      console.log(`Board "${board.name}" deleted successfully`)
    } catch (error) {
      console.error('Failed to delete board:', error)
      throw error
    }
  }

  // Rename a board
  async renameBoard(boardId: string, newName: string): Promise<void> {
    try {
      const board = await this.store.getItem<SavedBoard>(boardId)
      if (!board) {
        throw new Error(`Board with ID ${boardId} not found`)
      }

      const updatedBoard: SavedBoard = {
        ...board,
        name: newName,
        lastModified: Date.now(),
      }

      await this.store.setItem(boardId, updatedBoard)
      await this.updateBoardList(updatedBoard)
      
      console.log(`Board renamed to "${newName}" successfully`)
    } catch (error) {
      console.error('Failed to rename board:', error)
      throw error
    }
  }

  // Private method to update the board list
  private async updateBoardList(board: SavedBoard): Promise<void> {
    try {
      let boardList = await this.store.getItem<string[]>('board-list') || []
      
      // Add board ID if not already in list
      if (!boardList.includes(board.id)) {
        boardList.push(board.id)
        await this.store.setItem('board-list', boardList)
      }
    } catch (error) {
      console.error('Failed to update board list:', error)
      throw error
    }
  }

  // Private method to remove board from list
  private async removeBoardFromList(boardId: string): Promise<void> {
    try {
      let boardList = await this.store.getItem<string[]>('board-list') || []
      boardList = boardList.filter(id => id !== boardId)
      await this.store.setItem('board-list', boardList)
    } catch (error) {
      console.error('Failed to remove board from list:', error)
      throw error
    }
  }

  // Legacy methods for backward compatibility
  async saveBoard_legacy(data: Omit<BoardData, 'lastModified'>): Promise<void> {
    try {
      const boardData: BoardData = {
        ...data,
        lastModified: Date.now(),
      }
      
      await this.store.setItem('board-data', boardData)
      console.log('Board saved successfully (legacy)')
    } catch (error) {
      console.error('Failed to save board (legacy):', error)
      throw error
    }
  }

  async loadBoard_legacy(): Promise<BoardData | null> {
    try {
      const data = await this.store.getItem<BoardData>('board-data')
      return data
    } catch (error) {
      console.error('Failed to load board (legacy):', error)
      return null
    }
  }

  async clearAllData(): Promise<void> {
    try {
      await this.store.clear()
      console.log('All board data cleared')
    } catch (error) {
      console.error('Failed to clear board data:', error)
      throw error
    }
  }

  async exportBoard(): Promise<string> {
    try {
      const data = await this.loadBoard_legacy()
      if (!data) {
        throw new Error('No board data to export')
      }
      
      return JSON.stringify(data, null, 2)
    } catch (error) {
      console.error('Failed to export board:', error)
      throw error
    }
  }

  async importBoard(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData) as BoardData
      
      // Validate the data structure
      if (!data.nodes || !data.edges || !data.viewport) {
        throw new Error('Invalid board data format')
      }
      
      await this.saveBoard_legacy(data)
      console.log('Board imported successfully')
    } catch (error) {
      console.error('Failed to import board:', error)
      throw error
    }
  }
}

// Export singleton instance
export const boardStorage = new BoardStorage()
export default BoardStorage
export type { SavedBoard, BoardData } 