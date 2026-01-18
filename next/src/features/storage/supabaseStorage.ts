import { supabase } from '../auth/supabaseClient'
import type { BoardData } from './storage'

interface SavedBoard {
  id: string
  name: string
  data: BoardData
  createdAt: number
  lastModified: number
  nodeCount: number
  edgeCount: number
  userId: string
  isPublic?: boolean
}

export type BoardSummary = {
  id: string
  name: string
  createdAt: number
  lastModified: number
  nodeCount: number
  edgeCount: number
  userId: string
  isPublic?: boolean
  // Derived fields for boardroom list UI (avoid pulling full boards.data)
  topic?: string | null
  meta?: BoardData['meta']
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

interface DocumentMetadata {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  filePath: string
  extractedText: string
  boardId: string
  nodeId?: string
  userId: string
  uploadedAt: number
}

class SupabaseStorage {
  private stripBoardDataForPersistence(input: any): BoardData {
    const boardData: any = { ...(input || {}) }

    // Remove chat persistence (Phase A)
    try {
      if (boardData?.meta?.chat) {
        boardData.meta = { ...(boardData.meta || {}) }
        delete boardData.meta.chat
      }
    } catch {}

    // Remove extracted text from node data (Phase A) - keep it in documents.extracted_text only
    const nodes: any[] = Array.isArray(boardData?.nodes) ? boardData.nodes : []
    if (nodes.length) {
      const MAX_DOC_CONTENT = 12000 // cap persisted node content to keep boards.data small
      boardData.nodes = nodes.map((n: any) => {
        try {
          const next: any = { ...(n || {}) }
          const data: any = next?.data && typeof next.data === 'object' ? { ...(next.data || {}) } : next.data
          if (data && typeof data === 'object') {
            if (Object.prototype.hasOwnProperty.call(data, 'extractedText')) delete data.extractedText
            if (Object.prototype.hasOwnProperty.call(data, 'extracted_text')) delete data.extracted_text

            // Cap extremely large node content (especially documents) to prevent JSONB bloat
            if (typeof data.content === 'string' && data.content.length > MAX_DOC_CONTENT) {
              data.content = data.content.slice(0, MAX_DOC_CONTENT)
            }

            next.data = data
          }
          return next
        } catch {
          return n
        }
      })
    }

    return boardData as BoardData
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private isTransientStorageError(err: any): boolean {
    const msg = String(err?.message || '').toLowerCase()
    const status = Number(err?.status || 0)
    return (
      status >= 500 ||
      msg.includes('bad gateway') ||
      msg.includes('unexpected token') || // HTML error page parsed as JSON
      msg.includes('502') ||
      msg.includes('temporarily') ||
      msg.includes('timeout')
    )
  }

  private async createSignedUrlWithRetry(filePath: string, expiresInSeconds: number, attempts = 3): Promise<string | null> {
    let lastErr: any = null
    for (let i = 0; i < attempts; i++) {
      try {
        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(String(filePath), expiresInSeconds)
        if (error) throw error
        return data.signedUrl
      } catch (err: any) {
        lastErr = err
        if (i < attempts - 1 && this.isTransientStorageError(err)) {
          const backoff = 250 * Math.pow(2, i)
          try { await this.sleep(backoff) } catch {}
          continue
        }
        break
      }
    }
    // Only warn for non-404 style errors
    const msg = String(lastErr?.message || '')
    const status = Number(lastErr?.status || 0)
    const isNotFound = msg.toLowerCase().includes('object not found') || status === 404 || status === 400
    if (!isNotFound) {
      console.warn('[storage] createSignedUrl failed', { filePath, status, msg: msg.slice(0, 140) })
    }
    return null
  }
  // Save a board to Supabase
  async saveBoard(name: string, data: Omit<BoardData, 'lastModified'>): Promise<string> {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user
      if (!user) throw new Error('User not authenticated')

      // Enforce unique board name per user
      try {
        const { data: exist } = await supabase
          .from('boards')
          .select('id')
          .eq('user_id', user.id)
          .eq('name', name)
          .limit(1)
          .maybeSingle()
        if (exist && (exist as any).id) {
          const err = new Error('A board with that name already exists.');
          ;(err as any).code = 'BOARD_NAME_TAKEN'
          throw err
        }
      } catch (e: any) {
        if ((e as any)?.code === 'BOARD_NAME_TAKEN') throw e
        // proceed on select failure; server will enforce unique if desired
      }

      // compute lightweight task summary
      const taskSummary = Array.isArray((data as any).nodes)
        ? (data as any).nodes
            .filter((n: any) => n?.type === 'task')
            .map((n: any) => ({ id: n?.id, title: (n?.data?.title || 'Untitled') as string, completed: !!n?.data?.completed }))
        : []
      const tasksIncompleteCount = taskSummary.reduce((acc: number, t: any) => acc + (t.completed ? 0 : 1), 0)

      const boardData: BoardData = {
        ...(data as any),
        meta: { ...(data as any).meta, taskSummary, tasksIncompleteCount },
      }
      const boardDataStripped = this.stripBoardDataForPersistence(boardData as any)

      const savedBoard = {
        name,
        data: boardDataStripped,
        created_at: Date.now(),
        last_modified: Date.now(),
        node_count: ((data as any).nodes?.length) || 0,
        edge_count: ((data as any).edges?.length) || 0,
        user_id: user.id,
      }

      const { data: result, error } = await supabase
        .from('boards')
        .insert(savedBoard)
        .select()
        .single()

      if (error) throw error

      console.log(`Board "${name}" saved to Supabase with ID: ${result.id}`)

      // Owner is recorded on boards.user_id; skip creating a duplicate row in board_members
      return result.id as string
    } catch (error) {
      console.error('Failed to save board to Supabase:', error)
      throw error
    }
  }

  // Save a board to Supabase with a specific ID (upsert)
  async saveBoardWithId(id: string, name: string, data: Omit<BoardData, 'lastModified'>): Promise<void> {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user
      if (!user) throw new Error('User not authenticated')

      const taskSummary = Array.isArray((data as any).nodes)
        ? (data as any).nodes
            .filter((n: any) => n?.type === 'task')
            .map((n: any) => ({ id: n?.id, title: (n?.data?.title || 'Untitled') as string, completed: !!n?.data?.completed }))
        : []
      const tasksIncompleteCount = taskSummary.reduce((acc: number, t: any) => acc + (t.completed ? 0 : 1), 0)
      const boardData: BoardData = {
        ...(data as any),
        meta: { ...(data as any).meta, taskSummary, tasksIncompleteCount },
      }
      const boardDataStripped = this.stripBoardDataForPersistence(boardData as any)

      const savedBoard = {
        id,
        name,
        data: boardDataStripped,
        created_at: Date.now(),
        last_modified: Date.now(),
        node_count: ((data as any).nodes?.length) || 0,
        edge_count: ((data as any).edges?.length) || 0,
        user_id: user.id,
      }

      const { error } = await supabase
        .from('boards')
        .upsert([savedBoard], { onConflict: 'id' })

      if (error) throw error
      console.log(`Board "${name}" upserted to Supabase with ID: ${id}`)

      // Owner is recorded on boards.user_id; skip creating a duplicate row in board_members
    } catch (error) {
      console.error('Failed to upsert board to Supabase:', error)
      throw error
    }
  }

  // Update an existing board
  async updateBoard(boardId: string, data: Omit<BoardData, 'lastModified'>): Promise<void> {
    try {
      const incoming: any = data as any

      // Prefer DB-side JSON patch for ALL updates (full saves + partial saves).
      // This avoids fetching existing boards.data (which can be huge) just to preserve fields like topic.
      // If the RPC isn't deployed yet, we fall back to the legacy merge path below.
      const patch = this.stripBoardDataForPersistence(incoming)
      const nodeCount = Array.isArray((patch as any)?.nodes) ? (patch as any).nodes.length : null
      const edgeCount = Array.isArray((patch as any)?.edges) ? (patch as any).edges.length : null
      try {
        const { error } = await supabase.rpc('patch_board_data', {
          p_board_id: boardId,
          p_patch: patch as any,
          p_node_count: nodeCount,
          p_edge_count: edgeCount,
        })
        if (error) throw error
        return
      } catch {
        // Fallback to legacy merge path below if RPC is not deployed yet.
      }

      // Legacy merge path (and/or full saves): fetch existing board data to avoid wiping fields (like topic)
      const { data: existingRow } = await supabase
        .from('boards')
        .select('data')
        .eq('id', boardId)
        .single()

      const existingData = (existingRow && (existingRow as any).data) ? (existingRow as any).data as BoardData : {}

      // Merge existing data with provided data so we don't drop fields like topic
      const mergedDataObj: any = { ...(existingData || {}), ...(data as any) }

      const taskSummary = Array.isArray(mergedDataObj.nodes)
        ? mergedDataObj.nodes
            .filter((n: any) => n?.type === 'task')
            .map((n: any) => ({ id: n?.id, title: (n?.data?.title || 'Untitled') as string, completed: !!n?.data?.completed }))
        : []
      const tasksIncompleteCount = taskSummary.reduce((acc: number, t: any) => acc + (t.completed ? 0 : 1), 0)

      const boardData: BoardData = {
        ...mergedDataObj,
        meta: { ...(mergedDataObj.meta || {}), taskSummary, tasksIncompleteCount },
      }
      const boardDataStripped = this.stripBoardDataForPersistence(boardData as any)

      const { error } = await supabase
        .from('boards')
        .update({
          data: boardDataStripped,
          last_modified: Date.now(),
          node_count: (boardDataStripped.nodes?.length) || 0,
          edge_count: (boardDataStripped.edges?.length) || 0,
        })
        .eq('id', boardId)

      if (error) throw error
      console.log('Board updated in Supabase successfully')
    } catch (error) {
      console.error('Failed to update board in Supabase:', error)
      throw error
    }
  }

  // Load a specific board
  async loadBoard(boardId: string): Promise<SavedBoard | null> {
    try {
      // Remove user check for shared boards.
      // IMPORTANT: avoid returning persisted chat history (meta.chat) which can balloon payloads.
      const { data, error } = await supabase
        .from('boards')
        .select('id, name, data, created_at, last_modified, node_count, edge_count, user_id, is_public, ai_style, edgeType:data->meta->>edgeType')
        .eq('id', boardId)
        .single()

      if (error) throw error

      // Strip chat messages from payload on load (test) to reduce memory / downstream work.
      // We keep edgeType available to hydrate settings even if meta is stripped.
      let boardData = (data as any)?.data as BoardData
      try {
        if (boardData && (boardData as any).meta && (boardData as any).meta.chat) {
          boardData = { ...(boardData as any), meta: { ...((boardData as any).meta || {}) } }
          delete (boardData as any).meta.chat
        }
        // Defensive: strip any persisted extractedText fields from nodes (does not reduce payload size, but prevents downstream bloat)
        if (boardData && Array.isArray((boardData as any).nodes)) {
          const nextNodes = (boardData as any).nodes.map((n: any) => {
            try {
              const nn: any = { ...(n || {}) }
              const d: any = nn?.data && typeof nn.data === 'object' ? { ...(nn.data || {}) } : nn.data
              if (d && typeof d === 'object') {
                if (Object.prototype.hasOwnProperty.call(d, 'extractedText')) delete d.extractedText
                if (Object.prototype.hasOwnProperty.call(d, 'extracted_text')) delete d.extracted_text
                nn.data = d
              }
              return nn
            } catch { return n }
          })
          boardData = { ...(boardData as any), nodes: nextNodes }
        }
        if (boardData && (boardData as any).meta && !(boardData as any).meta.edgeType && (data as any)?.edgeType) {
          ;(boardData as any).meta.edgeType = (data as any).edgeType
        }
      } catch {}
      // Convert snake_case to camelCase
      return data ? {
        id: data.id as string,
        name: data.name as string,
        data: boardData,
        createdAt: data.created_at as number,
        lastModified: data.last_modified as number,
        nodeCount: data.node_count as number,
        edgeCount: data.edge_count as number,
        userId: data.user_id as string,
        isPublic: !!(data as any).is_public,
        aiStyle: (data as any)?.ai_style ? String((data as any).ai_style) : undefined,
      } : null
    } catch (error) {
      console.error('Failed to load board from Supabase:', error)
      return null
    }
  }

  // Get all boards for the current user
  async getAllBoards(): Promise<SavedBoard[]> {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('user_id', user.id)
        .order('last_modified', { ascending: false })

      if (error) throw error
      
      // Convert snake_case to camelCase
      return (data || []).map(board => ({
        id: board.id as string,
        name: board.name as string,
        data: board.data as BoardData,
        createdAt: board.created_at as number,
        lastModified: board.last_modified as number,
        nodeCount: board.node_count as number,
        edgeCount: board.edge_count as number,
        userId: board.user_id as string,
      }))
    } catch (error: any) {
      const message: string = typeof error?.message === 'string' ? error.message : ''
      const details: string = typeof error?.details === 'string' ? error.details : ''
      // Supabase can surface aborted fetches as AbortError – these are benign (e.g. navigation, React tearing)
      if (message.includes('AbortError') || details.includes('AbortError')) {
        // Silently treat as "no result" to avoid noisy console errors in BoardRoom
        return []
      }
      console.error('Failed to get boards from Supabase:', error)
      return []
    }
  }

  // Get lightweight board summaries for the current user (NO full boards.data payload)
  async getAllBoardsSummary(): Promise<BoardSummary[]> {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user
      if (!user) throw new Error('User not authenticated')

      // Note: PostgREST supports JSON path extraction + aliasing. We only need a few fields for the boardroom list.
      const { data, error } = await supabase
        .from('boards')
        .select('id, name, created_at, last_modified, node_count, edge_count, user_id, is_public, topic:data->>topic, meta:data->meta')
        .eq('user_id', user.id)
        .order('last_modified', { ascending: false })
        .limit(25)

      if (error) throw error

      return (data || []).map((row: any) => ({
        id: row.id as string,
        name: row.name as string,
        createdAt: row.created_at as number,
        lastModified: row.last_modified as number,
        nodeCount: row.node_count as number,
        edgeCount: row.edge_count as number,
        userId: row.user_id as string,
        isPublic: typeof row.is_public === 'boolean' ? row.is_public : undefined,
        topic: (typeof row.topic === 'string' ? row.topic : null),
        meta: (row.meta || null) as any,
      }))
    } catch (error: any) {
      const message: string = typeof error?.message === 'string' ? error.message : ''
      const details: string = typeof error?.details === 'string' ? error.details : ''
      if (message.includes('AbortError') || details.includes('AbortError')) {
        return []
      }
      console.error('Failed to get board summaries from Supabase:', error)
      return []
    }
  }

  // Delete a board
  async deleteBoard(boardId: string): Promise<void> {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('boards')
        .delete()
        .eq('id', boardId)
        .eq('user_id', user.id)
        .select('id')

      if (error) throw error
      const deletedCount = Array.isArray(data) ? data.length : (data ? 1 : 0)
      if (deletedCount === 0) {
        throw new Error('Delete did not match any rows (not owner or already deleted)')
      }
      console.log(`Board deleted from Supabase successfully`)
    } catch (error) {
      console.error('Failed to delete board from Supabase:', error)
      throw error
    }
  }

  // Rename a board
  async renameBoard(boardId: string, newName: string): Promise<void> {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user
      if (!user) throw new Error('User not authenticated')

      // Enforce unique name per user on rename
      try {
        const { data: existList } = await supabase
          .from('boards')
          .select('id, name')
          .eq('user_id', user.id)
          .eq('name', newName)
        const existsOther = Array.isArray(existList) && existList.some((b: any) => String(b.id) !== String(boardId))
        if (existsOther) {
          const err = new Error('A board with that name already exists.');
          ;(err as any).code = 'BOARD_NAME_TAKEN'
          throw err
        }
      } catch (e: any) {
        if ((e as any)?.code === 'BOARD_NAME_TAKEN') throw e
      }

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
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user
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

      console.log(`Document "${fileName}" saved to Supabase with ID: ${String(result.id)}`)
      return String(result.id)
    } catch (error) {
      console.error('Failed to save document to Supabase:', error)
      throw error
    }
  }

  // Get documents for a board
  async getBoardDocuments(boardId: string): Promise<DocumentMetadata[]> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('board_id', boardId)
        .order('uploaded_at', { ascending: false })

      if (error) throw error
      
      // Convert snake_case to camelCase
      return (data || []).map((doc: any) => ({
        id: String(doc.id),
        fileName: String(doc.file_name || ''),
        fileType: String(doc.file_type || ''),
        fileSize: Number(doc.file_size || 0),
        filePath: String(doc.file_path || ''),
        extractedText: String(doc.extracted_text || ''),
        boardId: String(doc.board_id || ''),
        nodeId: doc.node_id ? String(doc.node_id) : undefined,
        userId: String(doc.user_id || ''),
        uploadedAt: Number(doc.uploaded_at || 0),
      }))
    } catch (error) {
      console.error('Failed to get board documents from Supabase:', error)
      return []
    }
  }

  // Get a specific document by ID
  async getDocument(documentId: string): Promise<DocumentFile | null> {
    try {
      // Get document metadata from database
      const { data: docData, error: dbError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .maybeSingle()

      if (dbError || !docData) {
        console.error('Document not found or access denied:', dbError)
        return null
      }

      // Download the file from Supabase Storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(String(docData.file_path))

      if (downloadError) {
        console.error('Failed to download document file:', downloadError)
        return null
      }

      // Convert to DocumentFile format
      const documentFile: DocumentFile = {
        id: String(docData.id),
        fileName: String(docData.file_name || ''),
        fileType: String(docData.file_type || ''),
        fileSize: Number(docData.file_size || 0),
        content: fileData as Blob,
        extractedText: String(docData.extracted_text || ''),
        uploadedAt: Number(docData.uploaded_at || 0),
        boardId: String(docData.board_id || ''),
        nodeId: docData.node_id ? String(docData.node_id) : undefined,
        userId: String(docData.user_id || ''),
      }

      console.log(`Document "${docData.file_name}" loaded successfully`)
      return documentFile
    } catch (error) {
      console.error('Failed to get document from Supabase:', error)
      return null
    }
  }

  // Get extracted text only (avoid downloading the file blob)
  async getDocumentExtractedText(documentId: string): Promise<string> {
    try {
      const { data: docData, error } = await supabase
        .from('documents')
        .select('extracted_text')
        .eq('id', documentId)
        .maybeSingle()
      if (error || !docData) return ''
      return String((docData as any).extracted_text || '')
    } catch {
      return ''
    }
  }

  // Delete a document
  async deleteDocument(documentId: string): Promise<void> {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user
      if (!user) throw new Error('User not authenticated')

      // First, get the document metadata to find the file path
      const { data: docData, error: fetchError } = await supabase
        .from('documents')
        .select('file_path, file_name')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .single()

      if (fetchError || !docData) {
        throw new Error('Document not found or access denied')
      }

      // Delete the file from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([String(docData.file_path)])

      if (storageError) {
        console.error('Failed to delete file from storage:', storageError)
        // Continue with database deletion even if storage deletion fails
      }

      // Delete the document record from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('user_id', user.id)

      if (dbError) throw dbError

      console.log(`Document "${docData.file_name}" deleted successfully`)
    } catch (error) {
      console.error('Failed to delete document from Supabase:', error)
      throw error
    }
  }

  async getSignedUrl(documentId: string): Promise<string | null> {
    try {
      // Get document metadata to find the file path
      const { data: docData, error: dbError } = await supabase
        .from('documents')
        .select('file_path')
        .eq('id', documentId)
        .maybeSingle()

      if (dbError || !docData) {
        const msg = String((dbError as any)?.message || '')
        const details = String((dbError as any)?.details || '')
        // Supabase can surface aborted fetches as AbortError – these are benign (navigation, unmount, etc.)
        if (msg.includes('AbortError') || details.includes('AbortError')) {
          // Silent no-op: treat as "no URL yet" without spamming the console
          return null
        }
        console.error('Document not found or access denied:', dbError)
        return null
      }
      // Always use a time-limited signed URL; retry on transient 5xx/HTML errors
      const url = await this.createSignedUrlWithRetry(String(docData.file_path), 86400)
      if (!url) return null
      return url
    } catch (error: any) {
      const msg = String(error?.message || '')
      const details = String(error?.details || '')
      if (msg.includes('AbortError') || details.includes('AbortError')) {
        // Ignore benign aborted requests
        return null
      }
      console.error('Failed to get signed URL from Supabase:', error)
      return null
    }
  }

  async updateDocumentExtractedText(documentId: string, extractedText: string): Promise<void> {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user
      if (!user) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('documents')
        .update({ extracted_text: extractedText })
        .eq('id', documentId)
        .eq('user_id', user.id)

      if (error) throw error
    } catch (error) {
      console.error('Failed to update document extracted text:', error)
      throw error
    }
  }

  // Create or refresh a signed URL for an arbitrary storage path
  async getSignedUrlForPath(filePath: string, expiresInSeconds: number = 86400): Promise<string | null> {
    const url = await this.createSignedUrlWithRetry(String(filePath), expiresInSeconds)
    return url || null
  }

  // Upload an image variant for a given documentId under a stable path
  async uploadImageVariant(documentId: string, blob: Blob, sizeLabel: '800' | '1920'): Promise<string> {
    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData?.session?.user
    if (!user) throw new Error('User not authenticated')
    const path = `${user.id}/variants/${documentId}-${sizeLabel}.webp`
    const { error } = await supabase.storage
      .from('documents')
      .upload(path, blob, { contentType: 'image/webp', upsert: true })
    if (error) throw error
    return path
  }

  async getSignedUrlForVariant(documentId: string, sizeLabel: '800' | '1920', expiresInSeconds: number = 86400): Promise<string | null> {
    try {
      // Lookup original file path to derive uploader directory
      const { data: doc, error } = await supabase
        .from('documents')
        .select('file_path')
        .eq('id', documentId)
        .maybeSingle()
      if (error || !doc?.file_path) return null
      const firstSlash = String(doc.file_path).indexOf('/')
      const uploaderDir = firstSlash > 0 ? String(doc.file_path).slice(0, firstSlash) : ''
      if (!uploaderDir) return null
      const variantPath = `${uploaderDir}/variants/${documentId}-${sizeLabel}.webp`
      return this.getSignedUrlForPath(variantPath, expiresInSeconds)
    } catch {
      return null
    }
  }
}

export const supabaseStorage = new SupabaseStorage() 