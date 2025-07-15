import { supabase } from '../auth/supabaseClient'
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
  userId: string
}

interface DocumentFile {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  content: Blob
  extractedText: string
  uploadedAt: number
  boardId: string
  nodeId?: string
  userId: string
}

class SupabaseStorage {
  // Save a board to Supabase
  async saveBoard(name: string, data: Omit<BoardData, 'lastModified'>): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const boardData: BoardData = {
        ...data,
        lastModified: Date.now(),
      }

      const savedBoard = {
        name,
        data: boardData,
        created_at: Date.now(),
        last_modified: Date.now(),
        node_count: data.nodes.length,
        edge_count: data.edges.length,
        user_id: user.id,
      }

      const { data: result, error } = await supabase
        .from('boards')
        .insert(savedBoard)
        .select()
        .single()

      if (error) throw error

      console.log(`Board "${name}" saved to Supabase with ID: ${result.id}`)
      return result.id
    } catch (error) {
      console.error('Failed to save board to Supabase:', error)
      throw error
    }
  }

  // Update an existing board
  async updateBoard(boardId: string, data: Omit<BoardData, 'lastModified'>): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const boardData: BoardData = {
        ...data,
        lastModified: Date.now(),
      }

      const { error } = await supabase
        .from('boards')
        .update({
          data: boardData,
          last_modified: Date.now(),
          node_count: data.nodes.length,
          edge_count: data.edges.length,
        })
        .eq('id', boardId)
        .eq('user_id', user.id)

      if (error) throw error
      console.log(`Board updated in Supabase successfully`)
    } catch (error) {
      console.error('Failed to update board in Supabase:', error)
      throw error
    }
  }

  // Load a specific board
  async loadBoard(boardId: string): Promise<SavedBoard | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('id', boardId)
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      
      // Convert snake_case to camelCase
      return data ? {
        id: data.id,
        name: data.name,
        data: data.data,
        createdAt: data.created_at,
        lastModified: data.last_modified,
        nodeCount: data.node_count,
        edgeCount: data.edge_count,
        userId: data.user_id,
      } : null
    } catch (error) {
      console.error('Failed to load board from Supabase:', error)
      return null
    }
  }

  // Get all boards for the current user
  async getAllBoards(): Promise<SavedBoard[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('user_id', user.id)
        .order('last_modified', { ascending: false })

      if (error) throw error
      
      // Convert snake_case to camelCase
      return (data || []).map(board => ({
        id: board.id,
        name: board.name,
        data: board.data,
        createdAt: board.created_at,
        lastModified: board.last_modified,
        nodeCount: board.node_count,
        edgeCount: board.edge_count,
        userId: board.user_id,
      }))
    } catch (error) {
      console.error('Failed to get boards from Supabase:', error)
      return []
    }
  }

  // Delete a board
  async deleteBoard(boardId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('boards')
        .delete()
        .eq('id', boardId)
        .eq('user_id', user.id)

      if (error) throw error
      console.log(`Board deleted from Supabase successfully`)
    } catch (error) {
      console.error('Failed to delete board from Supabase:', error)
      throw error
    }
  }

  // Rename a board
  async renameBoard(boardId: string, newName: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('boards')
        .update({ 
          name: newName,
          last_modified: Date.now()
        })
        .eq('id', boardId)
        .eq('user_id', user.id)

      if (error) throw error
      console.log(`Board renamed in Supabase successfully`)
    } catch (error) {
      console.error('Failed to rename board in Supabase:', error)
      throw error
    }
  }

  // Save a document
  async saveDocument(
    fileName: string,
    file: Blob,
    extractedText: string,
    boardId: string,
    nodeId?: string
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Upload file to Supabase Storage
      const fileExt = fileName.split('.').pop()
      const fileNameWithExt = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(`${user.id}/${fileNameWithExt}`, file)

      if (uploadError) throw uploadError

      // Save document metadata to database
      const documentRecord = {
        file_name: fileName,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
        file_path: uploadData.path,
        extracted_text: extractedText,
        board_id: boardId,
        node_id: nodeId,
        user_id: user.id,
        uploaded_at: Date.now(),
      }

      const { data: result, error: dbError } = await supabase
        .from('documents')
        .insert(documentRecord)
        .select()
        .single()

      if (dbError) throw dbError

      console.log(`Document "${fileName}" saved to Supabase with ID: ${result.id}`)
      return result.id
    } catch (error) {
      console.error('Failed to save document to Supabase:', error)
      throw error
    }
  }

  // Get documents for a board
  async getBoardDocuments(boardId: string): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('board_id', boardId)
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })

      if (error) throw error
      
      // Convert snake_case to camelCase
      return (data || []).map(doc => ({
        id: doc.id,
        fileName: doc.file_name,
        fileType: doc.file_type,
        fileSize: doc.file_size,
        filePath: doc.file_path,
        extractedText: doc.extracted_text,
        boardId: doc.board_id,
        nodeId: doc.node_id,
        userId: doc.user_id,
        uploadedAt: doc.uploaded_at,
      }))
    } catch (error) {
      console.error('Failed to get board documents from Supabase:', error)
      return []
    }
  }
}

export const supabaseStorage = new SupabaseStorage() 