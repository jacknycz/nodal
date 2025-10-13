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
  welcome?: boolean
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
      welcome: !!t.welcome,
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
      welcome: !!data.welcome,
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

  async updateTemplate(id: string, updates: { name?: string; description?: string | null; data?: BoardData; coverUrl?: string | null; published?: boolean; welcome?: boolean }): Promise<TemplateRecord> {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) throw new Error('User not authenticated')

    const payload: any = {}
    if (typeof updates.name !== 'undefined') payload.name = updates.name
    if (typeof updates.description !== 'undefined') payload.description = updates.description
    if (typeof updates.coverUrl !== 'undefined') payload.cover_url = updates.coverUrl
    if (typeof updates.published !== 'undefined') payload.published = updates.published
    if (typeof updates.welcome !== 'undefined') payload.welcome = updates.welcome
    if (typeof updates.data !== 'undefined') {
      payload.data = updates.data
      payload.node_count = updates.data.nodes.length
      payload.edge_count = updates.data.edges.length
    }

    const runUpdate = async (p: any) => {
      const { error } = await supabase
        .from('templates')
        .update(p, { returning: 'minimal' as any })
        .eq('id', id)
      if (error) throw error
    }

    let data: any | null = null
    try {
      await runUpdate(payload)
    } catch (e: any) {
      // Graceful fallback if 'welcome' column doesn't exist in DB yet
      const includeWelcome = Object.prototype.hasOwnProperty.call(payload, 'welcome')
      const msg = String(e?.message || e)
      if (includeWelcome && (msg.includes('welcome') || String(e?.code) === '42703' || e?.status === 400)) {
        try {
          const { welcome, ...withoutWelcome } = payload
          await runUpdate(withoutWelcome)
          // eslint-disable-next-line no-console
          console.warn('[templateStorage] welcome flag not persisted (missing column). Applied other updates.')
        } catch (e2) {
          throw e2
        }
      } else {
        throw e
      }
    }
    // Try to fetch the updated row (separate SELECT avoids 406 from return=representation)
    try {
      data = await this.getTemplate(id)
    } catch {}
    if (!data) {
      // As a last resort, synthesize a minimal record using provided updates
      return {
        id,
        name: String((payload.name ?? '')),
        description: (payload.description ?? null) as string | null,
        coverUrl: (payload.cover_url ?? null) as string | null,
        data: (payload.data ?? { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }) as BoardData,
        createdAt: Date.now(),
        createdBy: '',
        nodeCount: Number(payload.node_count ?? 0),
        edgeCount: Number(payload.edge_count ?? 0),
        published: !!payload.published,
        welcome: !!payload.welcome,
      }
    }
    return data as TemplateRecord
  }
}

export const templateStorage = new TemplateStorage()

