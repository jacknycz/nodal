import { supabase } from '../auth/supabaseClient'
import type { BoardData } from './storage'

export interface TemplateRecord {
  id: string
  name: string
  description?: string | null
  coverUrl?: string | null
  data: BoardData
  createdAt: number
  createdBy: string
  nodeCount: number
  edgeCount: number
  published?: boolean
}

class TemplateStorage {
  async saveTemplate(name: string, data: BoardData, description?: string): Promise<string> {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) throw new Error('User not authenticated')

    const payload = {
      name,
      description: description || null,
      data,
      created_at: Date.now(),
      created_by: auth.user.id,
      node_count: data.nodes.length,
      edge_count: data.edges.length,
    }

    const { data: inserted, error } = await supabase
      .from('templates')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return inserted.id as string
  }

  async getAllTemplates(): Promise<TemplateRecord[]> {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      coverUrl: t.cover_url || null,
      data: t.data as BoardData,
      createdAt: t.created_at as number,
      createdBy: t.created_by as string,
      nodeCount: t.node_count as number,
      edgeCount: t.edge_count as number,
      published: !!t.published,
    }))
  }

  async getTemplate(id: string): Promise<TemplateRecord | null> {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    if (!data) return null
    return {
      id: String(data.id),
      name: String(data.name || ''),
      description: data.description as string | null,
      coverUrl: (data.cover_url as string) || null,
      data: data.data as BoardData,
      createdAt: Number(data.created_at || 0),
      createdBy: String(data.created_by || ''),
      nodeCount: Number(data.node_count || 0),
      edgeCount: Number(data.edge_count || 0),
      published: !!data.published,
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) throw new Error('User not authenticated')
    // Deletion rights should be enforced by RLS (admins only)
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id)
    if (error) throw error
  }

  async updateTemplate(id: string, updates: { name?: string; description?: string | null; data?: BoardData; coverUrl?: string | null; published?: boolean }): Promise<TemplateRecord> {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) throw new Error('User not authenticated')

    const payload: any = {}
    if (typeof updates.name !== 'undefined') payload.name = updates.name
    if (typeof updates.description !== 'undefined') payload.description = updates.description
    if (typeof updates.coverUrl !== 'undefined') payload.cover_url = updates.coverUrl
    if (typeof updates.published !== 'undefined') payload.published = updates.published
    if (typeof updates.data !== 'undefined') {
      payload.data = updates.data
      payload.node_count = updates.data.nodes.length
      payload.edge_count = updates.data.edges.length
    }

    const { data, error } = await supabase
      .from('templates')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return {
      id: String(data.id),
      name: String(data.name || ''),
      description: data.description as string | null,
      coverUrl: (data.cover_url as string) || null,
      data: data.data as BoardData,
      createdAt: Number(data.created_at || 0),
      createdBy: String(data.created_by || ''),
      nodeCount: Number(data.node_count || 0),
      edgeCount: Number(data.edge_count || 0),
      published: !!data.published,
    }
  }
}

export const templateStorage = new TemplateStorage()

