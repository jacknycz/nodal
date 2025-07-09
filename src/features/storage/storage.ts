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

interface StorageConfig {
  storeName?: string
  description?: string
}

class BoardStorage {
  private store: LocalForage
  private config: StorageConfig

  constructor(config: StorageConfig = {}) {
    this.config = {
      storeName: 'nodal-board',
      description: 'Nodal board data storage',
      ...config,
    }

    this.store = localforage.createInstance({
      name: this.config.storeName,
      description: this.config.description,
    })
  }

  async saveBoard(data: Omit<BoardData, 'lastModified'>): Promise<void> {
    try {
      const boardData: BoardData = {
        ...data,
        lastModified: Date.now(),
      }
      
      await this.store.setItem('board-data', boardData)
      console.log('Board saved successfully')
    } catch (error) {
      console.error('Failed to save board:', error)
      throw error
    }
  }

  async loadBoard(): Promise<BoardData | null> {
    try {
      const data = await this.store.getItem<BoardData>('board-data')
      return data
    } catch (error) {
      console.error('Failed to load board:', error)
      return null
    }
  }

  async deleteBoard(): Promise<void> {
    try {
      await this.store.removeItem('board-data')
      console.log('Board deleted successfully')
    } catch (error) {
      console.error('Failed to delete board:', error)
      throw error
    }
  }

  async hasBoard(): Promise<boolean> {
    try {
      const data = await this.store.getItem('board-data')
      return data !== null
    } catch (error) {
      console.error('Failed to check board existence:', error)
      return false
    }
  }

  async getLastModified(): Promise<number | null> {
    try {
      const data = await this.store.getItem<BoardData>('board-data')
      return data?.lastModified || null
    } catch (error) {
      console.error('Failed to get last modified date:', error)
      return null
    }
  }

  async exportBoard(): Promise<string> {
    try {
      const data = await this.loadBoard()
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
      
      await this.saveBoard(data)
      console.log('Board imported successfully')
    } catch (error) {
      console.error('Failed to import board:', error)
      throw error
    }
  }

  async clearAllData(): Promise<void> {
    try {
      await this.store.clear()
      console.log('All storage data cleared')
    } catch (error) {
      console.error('Failed to clear storage:', error)
      throw error
    }
  }
}

export default BoardStorage
export type { BoardData, StorageConfig } 